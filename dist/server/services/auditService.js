import axios from 'axios';
export class AuditService {
    apiUrl;
    apiKey;
    authToken;
    language;
    enableScreenshots;
    enableHighlight;
    constructor() {
        this.apiUrl = process.env.ACCESSTIVE_API_URL || 'https://api.accesstive.org/nsa-accesstive';
        this.apiKey = process.env.ACCESSTIVE_API_KEY || '';
        this.authToken = process.env.ACCESSTIVE_AUTH_TOKEN || '';
        this.language = process.env.REPORT_LANGUAGE || 'en';
        this.enableScreenshots = process.env.ENABLE_SCREENSHOTS === 'true';
        this.enableHighlight = process.env.ENABLE_HIGHLIGHT === 'true';
        if (!this.apiKey) {
            console.warn('⚠️  ACCESSTIVE_API_KEY not found in environment variables');
        }
        if (!this.authToken) {
            console.warn('⚠️  ACCESSTIVE_AUTH_TOKEN not found in environment variables');
        }
        console.log(`🔐 AuditService initialized with API URL: ${this.apiUrl}`);
        console.log(`🔑 API Key configured: ${this.apiKey ? 'Yes' : 'No'}`);
        console.log(`🎫 Auth Token configured: ${this.authToken ? 'Yes' : 'No'}`);
    }
    async testAuthentication() {
        try {
            console.log('🧪 Testing Accesstive API authentication...');
            if (!this.apiKey) {
                return { valid: false, message: 'API key not configured' };
            }
            const testUrl = 'https://example.com';
            const requestBody = {
                url: testUrl,
                highlight: false,
                screenshots: false,
                language: this.language,
                enableGroupSummaries: false,
            };
            const headers = {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey,
                'Origin': 'http://accesstive-org.ddev.site:3000',
                'User-Agent': 'AutomaticAudit/1.0.0',
            };
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }
            console.log(`🔍 Testing API with URL: ${this.apiUrl}`);
            console.log(`🔑 Using API Key: ${this.apiKey.substring(0, 8)}...`);
            console.log(`🎫 Using Auth Token: ${this.authToken ? 'Yes' : 'No'}`);
            const response = await axios.post(this.apiUrl, requestBody, {
                headers: headers,
                timeout: 30000,
            });
            if (response.status === 200) {
                console.log('✅ Authentication test successful');
                return {
                    valid: true,
                    message: 'Authentication successful',
                    details: {
                        apiUrl: this.apiUrl,
                        hasApiKey: !!this.apiKey,
                        hasAuthToken: !!this.authToken,
                        responseStatus: response.status
                    }
                };
            }
            else {
                console.log(`⚠️  Authentication test returned status: ${response.status}`);
                return {
                    valid: false,
                    message: `API returned status ${response.status}`,
                    details: { responseStatus: response.status }
                };
            }
        }
        catch (error) {
            console.error('❌ Authentication test failed:', error);
            if (axios.isAxiosError(error)) {
                if (error.response) {
                    const status = error.response.status;
                    const errorMessage = error.response.data?.message || error.response.statusText;
                    if (status === 401) {
                        return { valid: false, message: 'Authentication failed: Invalid API key or auth token' };
                    }
                    else if (status === 403) {
                        return { valid: false, message: 'Authentication failed: Access denied' };
                    }
                    else {
                        return { valid: false, message: `API Error: ${errorMessage}`, details: { status } };
                    }
                }
                else if (error.request) {
                    return { valid: false, message: 'Network error: Unable to reach the Accesstive API' };
                }
                else {
                    return { valid: false, message: `Request error: ${error.message}` };
                }
            }
            else {
                return { valid: false, message: `Unexpected error: ${error.message}` };
            }
        }
    }
    async auditPages(urls) {
        const results = [];
        const totalUrls = urls.length;
        console.log(`🔍 Starting accessibility audit for ${totalUrls} pages`);
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            console.log(`📊 Auditing ${i + 1}/${totalUrls}: ${url}`);
            try {
                const auditResult = await this.auditSinglePage(url);
                if (auditResult) {
                    results.push(auditResult);
                }
            }
            catch (error) {
                console.error(`❌ Error auditing ${url}:`, error.message);
                results.push({
                    url: url,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    summary: {
                        totalIssues: 0,
                        errors: 0,
                        warnings: 0,
                        hints: 0,
                        pagesWithIssues: 0,
                        criticalIssues: 0,
                        seriousIssues: 0,
                        moderateIssues: 0
                    },
                    issues: {
                        errors: [],
                        warnings: [],
                        hints: []
                    }
                });
            }
            if (i < urls.length - 1) {
                await this.delay(1000);
            }
        }
        console.log(`✅ Audit completed for ${results.length} pages`);
        return results;
    }
    async auditSinglePage(url) {
        try {
            const requestBody = {
                url: url,
                highlight: this.enableHighlight,
                screenshots: this.enableScreenshots,
                language: this.language,
                enableGroupSummaries: true,
            };
            const headers = {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey,
                'Origin': 'http://accesstive-org.ddev.site:3000',
                'User-Agent': 'AutomaticAudit/1.0.0',
            };
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }
            const response = await axios.post(this.apiUrl, requestBody, {
                headers: headers,
                timeout: 60000,
            });
            if (response.status !== 200) {
                throw new Error(`API returned status ${response.status}`);
            }
            const data = response.data;
            return this.processAuditData(url, data);
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response) {
                    const errorMessage = error.response.data?.message || error.response.statusText;
                    throw new Error(`API Error: ${errorMessage}`);
                }
                else if (error.request) {
                    throw new Error('Network error: Unable to reach the API');
                }
                else {
                    throw new Error(error.message);
                }
            }
            else {
                throw new Error(error.message);
            }
        }
    }
    processAuditData(url, data) {
        const results = data.results || data;
        const filteredData = this.filterExcludedIssues(results);
        const processedData = this.transformAndCategorizeIssues(filteredData);
        const statistics = results.statistics || {};
        return {
            url: url,
            timestamp: new Date().toISOString(),
            summary: {
                totalIssues: processedData.totalIssues,
                errors: processedData.errors.length,
                warnings: processedData.warnings.length,
                hints: processedData.hints.length,
                pagesWithIssues: processedData.totalIssues > 0 ? 1 : 0,
                criticalIssues: statistics.criticalIssues || 0,
                seriousIssues: statistics.seriousIssues || 0,
                moderateIssues: statistics.moderateIssues || 0,
            },
            issues: {
                errors: processedData.errors,
                warnings: processedData.warnings,
                hints: processedData.hints,
            },
            rawData: results,
        };
    }
    filterExcludedIssues(data) {
        const excludedStatuses = ['passed', 'incomplete', 'inapplicable', 'na'];
        const excludedTypes = ['passed', 'incomplete', 'inapplicable', 'na'];
        const filteredViolations = data.violations?.filter((item) => {
            const itemStatus = (item.status || item.type || item.result || '').toLowerCase();
            const itemType = (item.type || item.status || item.result || '').toLowerCase();
            if (excludedStatuses.includes(itemStatus) || excludedTypes.includes(itemType)) {
                return false;
            }
            return item.nodes && item.nodes.length > 0;
        }) || [];
        const filteredIncomplete = data.incomplete?.filter((item) => {
            const itemStatus = (item.status || item.type || item.result || '').toLowerCase();
            const itemType = (item.type || item.status || item.result || '').toLowerCase();
            if (excludedStatuses.includes(itemStatus) || excludedTypes.includes(itemType)) {
                return false;
            }
            return item.nodes && item.nodes.length > 0;
        }) || [];
        const filteredPasses = [];
        return {
            violations: filteredViolations,
            incomplete: filteredIncomplete,
            passes: filteredPasses,
            inapplicable: [],
            url: data.url,
        };
    }
    transformAndCategorizeIssues(data) {
        const errors = [];
        const warnings = [];
        const hints = [];
        if (data.violations) {
            data.violations.forEach((item) => {
                const issues = this.createIssuesFromItem(item, 'error');
                errors.push(...issues);
            });
        }
        if (data.incomplete) {
            data.incomplete.forEach((item) => {
                const issues = this.createIssuesFromItem(item, 'warning');
                warnings.push(...issues);
            });
        }
        if (data.passes) {
            data.passes.forEach((item) => {
                const issues = this.createIssuesFromItem(item, 'hint');
                hints.push(...issues);
            });
        }
        return {
            errors,
            warnings,
            hints,
            totalIssues: errors.length + warnings.length + hints.length,
        };
    }
    createIssuesFromItem(item, level) {
        const issues = [];
        const category = item.category || item.tags?.[0]?.replace('cat.', '') || 'other';
        if (item.nodes && item.nodes.length > 0) {
            item.nodes.forEach((node) => {
                issues.push({
                    id: item.id || item.actRuleId || '',
                    title: this.cleanHtml(item.title || item.id || ''),
                    description: item.description || '',
                    help: item.help || '',
                    category: category,
                    level: level,
                    impact: item.impact || this.getDefaultImpact(level),
                    selector: node.target?.join(', ') || '',
                    html: node.html || '',
                    failureSummary: node.failureSummary || '',
                    tags: item.tags || [],
                    helpUrl: `https://accesstive.com/rules/${item.id}` || '',
                    guidelines: item.guidelines || '',
                    whyImportant: item.whyImportant || '',
                    howToFix: item.howToFix || '',
                    disabilityTypesAffected: Array.isArray(item.disabilityTypesAffected)
                        ? item.disabilityTypesAffected
                        : item.disabilityTypesAffected ? [item.disabilityTypesAffected] : [],
                    wcagReferences: item.wcagReferences || [],
                });
            });
        }
        else {
            issues.push({
                id: item.id || item.actRuleId || '',
                title: this.cleanHtml(item.title || item.id || ''),
                description: item.description || '',
                help: item.help || '',
                category: category,
                level: level,
                impact: item.impact || this.getDefaultImpact(level),
                selector: '',
                html: '',
                failureSummary: '',
                tags: item.tags || [],
                helpUrl: `https://accesstive.com/rules/${item.id}` || '',
                guidelines: item.guidelines || '',
                whyImportant: item.whyImportant || '',
                howToFix: item.howToFix || '',
                disabilityTypesAffected: Array.isArray(item.disabilityTypesAffected)
                    ? item.disabilityTypesAffected
                    : item.disabilityTypesAffected ? [item.disabilityTypesAffected] : [],
                wcagReferences: item.wcagReferences || [],
            });
        }
        return issues;
    }
    getDefaultImpact(level) {
        switch (level) {
            case 'error': return 'serious';
            case 'warning': return 'moderate';
            case 'hint': return 'minor';
            default: return 'moderate';
        }
    }
    cleanHtml(html) {
        if (!html)
            return '';
        return html.replace(/<[^>]*>/g, '').trim();
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=auditService.js.map