import axios from 'axios';
import * as cheerio from 'cheerio';
import URL from 'url-parse';
export class CrawlerService {
    maxPages;
    crawlDelay;
    timeout;
    constructor() {
        this.maxPages = parseInt(process.env.MAX_PAGES_TO_CRAWL || '100');
        this.crawlDelay = parseInt(process.env.CRAWL_DELAY || '1000');
        this.timeout = parseInt(process.env.REQUEST_TIMEOUT || '30000');
    }
    async crawlWebsite(mainUrl, maxPages = this.maxPages) {
        const baseUrl = this.normalizeUrl(mainUrl);
        const visited = new Set();
        const toVisit = [baseUrl];
        const pages = [];
        const domain = new URL(baseUrl).hostname;
        console.log(`🔍 Starting crawl of: ${baseUrl}`);
        console.log(`📊 Max pages to crawl (enforced): ${maxPages}`);
        const sitemapUrls = await this.getSitemapUrls(baseUrl, domain);
        if (sitemapUrls.length > 0) {
            console.log(`🗺️  Found ${sitemapUrls.length} URLs in sitemap.xml`);
            for (const url of sitemapUrls) {
                if (url !== baseUrl && !visited.has(url) && !toVisit.includes(url)) {
                    toVisit.push(url);
                }
            }
        }
        else {
            console.log(`⚠️  No sitemap.xml found or no valid URLs extracted`);
        }
        while (toVisit.length > 0 && pages.length < maxPages) {
            const currentUrl = toVisit.shift();
            if (visited.has(currentUrl)) {
                continue;
            }
            visited.add(currentUrl);
            try {
                console.log(`📄 Crawling: ${currentUrl}`);
                const pageData = await this.fetchPage(currentUrl);
                if (pageData) {
                    pages.push(pageData);
                    if (pages.length < maxPages) {
                        const links = this.extractLinks(pageData.html, baseUrl, domain);
                        for (const link of links) {
                            if (!visited.has(link) && !toVisit.includes(link)) {
                                toVisit.push(link);
                            }
                        }
                    }
                }
                if (toVisit.length > 0) {
                    await this.delay(this.crawlDelay);
                }
            }
            catch (error) {
                console.error(`❌ Error crawling ${currentUrl}:`, error.message);
            }
        }
        console.log(`✅ Crawl completed. Found ${pages.length} pages (limit was ${maxPages}).`);
        return pages;
    }
    async fetchPage(url) {
        try {
            const response = await axios.get(url, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; AccesstiveBot/1.0; +https://accesstive.org)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                },
                maxRedirects: 5,
                validateStatus: (status) => status < 400,
            });
            if (response.request.res.responseUrl && response.request.res.responseUrl !== url) {
                console.log(`🔄 Redirected: ${url} → ${response.request.res.responseUrl}`);
                const finalUrl = response.request.res.responseUrl;
                if (finalUrl.includes('/en/en/')) {
                    const correctedUrl = finalUrl.replace('/en/en/', '/en/');
                    console.log(`⚠️  Detected double /en/en/ path, correcting to: ${correctedUrl}`);
                    try {
                        const correctedResponse = await axios.get(correctedUrl, {
                            timeout: this.timeout,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (compatible; AccesstiveBot/1.0; +https://accesstive.org)',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                'Accept-Language': 'en-US,en;q=0.5',
                                'Accept-Encoding': 'gzip, deflate',
                                'Connection': 'keep-alive',
                            },
                            maxRedirects: 5,
                            validateStatus: (status) => status < 400,
                        });
                        const $ = cheerio.load(correctedResponse.data);
                        const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';
                        return {
                            url: correctedUrl,
                            title: title,
                            html: correctedResponse.data,
                            statusCode: correctedResponse.status,
                            contentType: correctedResponse.headers['content-type'] || '',
                        };
                    }
                    catch (correctedError) {
                        console.log(`❌ Corrected URL also failed: ${correctedUrl}`);
                    }
                }
            }
            const $ = cheerio.load(response.data);
            const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';
            return {
                url: url,
                title: title,
                html: response.data,
                statusCode: response.status,
                contentType: response.headers['content-type'] || '',
            };
        }
        catch (error) {
            console.error(`Failed to fetch ${url}:`, error.message);
            return null;
        }
    }
    extractLinks(html, baseUrl, domain) {
        const $ = cheerio.load(html);
        const links = new Set();
        $('a[href]').each((_index, element) => {
            const href = $(element).attr('href');
            if (href) {
                const absoluteUrl = this.resolveUrl(href, baseUrl);
                if (absoluteUrl && this.isValidUrl(absoluteUrl, domain)) {
                    links.add(absoluteUrl);
                }
            }
        });
        return Array.from(links);
    }
    resolveUrl(href, baseUrl) {
        try {
            if (href.startsWith('http://') || href.startsWith('https://')) {
                return href;
            }
            else if (href.startsWith('//')) {
                return `https:${href}`;
            }
            else if (href.startsWith('/')) {
                const base = new URL(baseUrl);
                return `${base.protocol}//${base.host}${href}`;
            }
            else {
                return new URL(href, baseUrl).href;
            }
        }
        catch (error) {
            return null;
        }
    }
    isValidUrl(url, domain) {
        try {
            const urlObj = new URL(url);
            const allowedDomains = [domain, 't3planet.de', 't3planet.com'];
            if (!allowedDomains.includes(urlObj.hostname)) {
                return false;
            }
            const excludedPatterns = [
                /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|exe|dmg|pkg)$/i,
                /\.(jpg|jpeg|png|gif|svg|ico|webp|bmp)$/i,
                /\.(css|js|xml|json|txt|log)$/i,
                /mailto:/,
                /tel:/,
                /javascript:/,
                /#/,
                /\?.*logout/i,
                /\?.*signout/i,
                /\/react\//i,
                /\/js\//i,
                /\/javascript\//i,
                /\/node_modules\//i,
                /\/package\.json/i,
                /\/package-lock\.json/i,
                /\/yarn\.lock/i,
                /\/webpack\.config/i,
                /\/vite\.config/i,
                /\/tsconfig/i,
                /\/\.env/i,
                /\/\.git/i,
                /\/\.github/i,
                /\/\.vscode/i,
                /\/\.idea/i,
                /\/dist\//i,
                /\/build\//i,
                /\/coverage\//i,
                /\/docs\//i,
                /\/examples\//i,
                /\/demo\//i,
                /\/test\//i,
                /\/tests\//i,
                /\/spec\//i,
                /\/__tests__\//i,
                /\/__mocks__\//i,
                /\/\.storybook\//i,
                /\/\.next\//i,
                /\/\.nuxt\//i,
                /\/\.vuepress\//i,
                /\/\.docusaurus\//i,
                /\/\.gatsby\//i,
                /\/\.angular\//i,
                /\/\.svelte\//i,
                /\/\.astro\//i,
                /\/\.remix\//i,
                /\/\.solid\//i,
                /\/\.qwik\//i,
                /\/\.lit\//i,
                /\/\.preact\//i,
                /\/\.inferno\//i,
                /\/\.hyperapp\//i,
                /\/\.marko\//i,
                /\/\.riot\//i,
                /\/\.mint\//i,
                /\/\.elm\//i,
                /\/\.clojure\//i,
                /\/\.reason\//i,
                /\/\.re\//i,
                /\/\.ml\//i,
                /\/\.fs\//i,
                /\/\.hs\//i,
                /\/\.scala\//i,
                /\/\.java\//i,
                /\/\.kt\//i,
                /\/\.swift\//i,
                /\/\.go\//i,
                /\/\.rs\//i,
                /\/\.py\//i,
                /\/\.rb\//i,
                /\/\.php\//i,
                /\/\.asp\//i,
                /\/\.jsp\//i,
                /\/\.aspx\//i,
                /\/\.cshtml\//i,
                /\/\.razor\//i,
                /\/\.blazor\//i,
                /\/\.vue\//i,
                /\/\.svelte\//i,
                /\/\.astro\//i,
                /\/\.lit\//i,
                /\/\.preact\//i,
                /\/\.inferno\//i,
                /\/\.hyperapp\//i,
                /\/\.marko\//i,
                /\/\.riot\//i,
                /\/\.mint\//i,
                /\/\.elm\//i,
                /\/\.clojure\//i,
                /\/\.reason\//i,
                /\/\.re\//i,
                /\/\.ml\//i,
                /\/\.fs\//i,
                /\/\.hs\//i,
                /\/\.scala\//i,
                /\/\.java\//i,
                /\/\.kt\//i,
                /\/\.swift\//i,
                /\/\.go\//i,
                /\/\.rs\//i,
                /\/\.py\//i,
                /\/\.rb\//i,
                /\/\.php\//i,
                /\/\.asp\//i,
                /\/\.jsp\//i,
                /\/\.aspx\//i,
                /\/\.cshtml\//i,
                /\/\.razor\//i,
                /\/\.blazor\//i,
            ];
            for (const pattern of excludedPatterns) {
                if (pattern.test(url)) {
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            return false;
        }
    }
    normalizeUrl(url) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return `https://${url}`;
        }
        return url;
    }
    async getSitemapUrls(baseUrl, domain) {
        const sitemapUrl = `${baseUrl}/sitemap.xml`;
        const urls = [];
        try {
            console.log(`🗺️  Attempting to fetch sitemap from: ${sitemapUrl}`);
            const response = await axios.get(sitemapUrl, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; AccesstiveBot/1.0; +https://accesstive.org)',
                    'Accept': 'application/xml,text/xml,*/*',
                },
                validateStatus: (status) => status < 400,
            });
            const $ = cheerio.load(response.data, { xmlMode: true });
            $('loc').each((_index, element) => {
                const url = $(element).text().trim();
                if (url) {
                    const absoluteUrl = this.resolveUrl(url, baseUrl);
                    if (absoluteUrl && this.isValidUrl(absoluteUrl, domain)) {
                        urls.push(absoluteUrl);
                    }
                }
            });
            console.log(`🗺️  Successfully parsed sitemap.xml, found ${urls.length} valid URLs`);
            return urls;
        }
        catch (error) {
            console.log(`⚠️  Could not fetch sitemap.xml from ${sitemapUrl}: ${error.message}`);
            const alternativeSitemaps = [
                `${baseUrl}/sitemap_index.xml`,
                `${baseUrl}/sitemap/`,
                `${baseUrl}/sitemaps/`,
                `${baseUrl}/sitemap/sitemap.xml`,
            ];
            for (const altSitemap of alternativeSitemaps) {
                try {
                    console.log(`🗺️  Trying alternative sitemap: ${altSitemap}`);
                    const altResponse = await axios.get(altSitemap, {
                        timeout: this.timeout,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; AccesstiveBot/1.0; +https://accesstive.org)',
                            'Accept': 'application/xml,text/xml,*/*',
                        },
                        validateStatus: (status) => status < 400,
                    });
                    const $alt = cheerio.load(altResponse.data, { xmlMode: true });
                    $alt('loc').each((_index, element) => {
                        const url = $alt(element).text().trim();
                        if (url) {
                            const absoluteUrl = this.resolveUrl(url, baseUrl);
                            if (absoluteUrl && this.isValidUrl(absoluteUrl, domain)) {
                                urls.push(absoluteUrl);
                            }
                        }
                    });
                    if (urls.length > 0) {
                        console.log(`🗺️  Found ${urls.length} URLs in alternative sitemap: ${altSitemap}`);
                        break;
                    }
                }
                catch (altError) {
                    console.log(`⚠️  Alternative sitemap ${altSitemap} not found`);
                }
            }
            return urls;
        }
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=crawlerService.js.map