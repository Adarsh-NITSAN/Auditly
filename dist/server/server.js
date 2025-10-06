import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { CrawlerService } from './services/crawlerService.js';
import { AuditService } from './services/auditService.js';
import { ReportService } from './services/reportService.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const auditHistory = [];
const crawlerService = new CrawlerService();
const auditService = new AuditService();
const reportService = new ReportService();
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../')));
app.get('/api/health', (_req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.get('/api/test-auth', async (_req, res) => {
    try {
        const authStatus = await auditService.testAuthentication();
        res.json({
            status: 'OK',
            authStatus,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Auth test error:', error);
        res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
app.post('/api/crawl', async (req, res) => {
    try {
        let { mainUrl, maxPages = 100, homepageOnly = false } = req.body;
        if (!mainUrl) {
            return res.status(400).json({ error: 'Main URL is required' });
        }
        maxPages = parseInt(maxPages, 10);
        if (isNaN(maxPages) || maxPages < 1 || maxPages > 500) {
            console.warn(`Invalid maxPages received: ${req.body.maxPages}`);
            return res.status(400).json({ error: 'maxPages must be a number between 1 and 500' });
        }
        console.log(`Received crawl request: mainUrl=${mainUrl}, maxPages=${maxPages}, homepageOnly=${homepageOnly}, raw body:`, JSON.stringify(req.body));
        const pages = await crawlerService.crawlWebsite(mainUrl, maxPages, homepageOnly);
        return res.json({
            success: true,
            pages: pages.map(page => ({
                url: page.url,
                title: page.title,
                selected: true
            }))
        });
    }
    catch (error) {
        console.error('Crawl error:', error);
        return res.status(500).json({ error: error.message });
    }
});
app.post('/api/crawl-multi', async (req, res) => {
    try {
        const { domains, maxPages = 100 } = req.body;
        if (!domains || !Array.isArray(domains) || domains.length === 0) {
            return res.status(400).json({ error: 'At least one domain is required' });
        }
        const validatedMaxPages = parseInt(maxPages, 10);
        if (isNaN(validatedMaxPages) || validatedMaxPages < 1 || validatedMaxPages > 500) {
            return res.status(400).json({ error: 'maxPages must be a number between 1 and 500' });
        }
        console.log(`Received multi-domain crawl request: ${domains.length} domains, maxPages=${validatedMaxPages}`);
        const results = [];
        for (const domain of domains) {
            try {
                console.log(`🔍 Crawling domain: ${domain}`);
                const pages = await crawlerService.crawlWebsite(domain, validatedMaxPages);
                const pageUrls = pages.map(page => page.url);
                const auditResults = await auditService.auditPages(pageUrls);
                const summary = reportService.generateSummary(auditResults);
                results.push({
                    domain,
                    pages: pages.map(page => ({
                        url: page.url,
                        title: page.title,
                        selected: true
                    })),
                    auditResults,
                    summary
                });
                console.log(`✅ Completed domain ${domain}: ${pages.length} pages, ${auditResults.length} audit results`);
            }
            catch (error) {
                console.error(`❌ Error processing domain ${domain}:`, error.message);
                results.push({
                    domain,
                    error: error.message,
                    pages: [],
                    auditResults: [],
                    summary: {
                        totalPages: 0,
                        pagesWithIssues: 0,
                        totalIssues: 0,
                        errors: 0,
                        warnings: 0,
                        hints: 0,
                        criticalIssues: 0,
                        seriousIssues: 0,
                        moderateIssues: 0,
                        categories: {},
                        topIssues: [],
                        timestamp: new Date().toISOString()
                    }
                });
            }
        }
        return res.json({
            success: true,
            results
        });
    }
    catch (error) {
        console.error('Multi-domain crawl error:', error);
        return res.status(500).json({ error: error.message });
    }
});
app.post('/api/audit', async (req, res) => {
    try {
        const { pages, customUrls = [] } = req.body;
        if (!pages || pages.length === 0) {
            return res.status(400).json({ error: 'At least one page must be selected' });
        }
        const allUrls = [...pages, ...customUrls];
        const results = await auditService.auditPages(allUrls);
        const summary = reportService.generateSummary(results);
        const auditData = {
            id: `audit_${Date.now()}`,
            timestamp: new Date().toISOString(),
            summary,
            results,
            pages: allUrls
        };
        auditHistory.push(auditData);
        return res.json({
            success: true,
            results,
            summary,
            auditId: auditData.id
        });
    }
    catch (error) {
        console.error('Audit error:', error);
        return res.status(500).json({ error: error.message });
    }
});
app.get('/api/audit-history', (_req, res) => {
    try {
        const history = auditHistory.map(audit => ({
            id: audit.id,
            timestamp: audit.timestamp,
            summary: audit.summary,
            pageCount: audit.pages.length
        }));
        res.json({ history });
    }
    catch (error) {
        console.error('History error:', error);
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/audit/:id', (req, res) => {
    try {
        const { id } = req.params;
        const audit = auditHistory.find(a => a.id === id);
        if (!audit) {
            return res.status(404).json({ error: 'Audit not found' });
        }
        return res.json({ audit });
    }
    catch (error) {
        console.error('Get audit error:', error);
        return res.status(500).json({ error: error.message });
    }
});
app.post('/api/audit-compare', (req, res) => {
    try {
        const { auditId1, auditId2 } = req.body;
        const audit1 = auditHistory.find(a => a.id === auditId1);
        const audit2 = auditHistory.find(a => a.id === auditId2);
        if (!audit1 || !audit2) {
            return res.status(404).json({ error: 'One or both audits not found' });
        }
        const comparison = reportService.compareAudits(audit1, audit2);
        return res.json({ comparison });
    }
    catch (error) {
        console.error('Compare error:', error);
        return res.status(500).json({ error: error.message });
    }
});
app.post('/api/report', async (req, res) => {
    try {
        const { results, format = 'json' } = req.body;
        if (!results) {
            return res.status(400).json({ error: 'Results data is required' });
        }
        const report = await reportService.generateDetailedReport(results, format);
        if (format === 'json') {
            return res.json(report);
        }
        else {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="accessibility-audit-report.csv"');
            return res.send(report);
        }
    }
    catch (error) {
        console.error('Report generation error:', error);
        return res.status(500).json({ error: error.message });
    }
});
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
app.listen(PORT, () => {
    console.log(`🚀 Automatic Audit Server running on port ${PORT}`);
    console.log(`📊 Access the application at: http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map