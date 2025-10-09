/**
 * @fileoverview Website crawler service for the Automatic Accessibility Audit Tool
 * @description Handles website crawling, link extraction, and sitemap parsing
 * @author Accesstive Team
 * @version 1.0.0
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import URL from 'url-parse';
import { PageData } from '../types/index.js';

export class CrawlerService {
  private maxPages: number; 
  private crawlDelay: number;
  private timeout: number;
  // private maxConcurrent: number; // TODO: Implement concurrent processing

  constructor() {
    this.maxPages = parseInt(process.env.MAX_PAGES_TO_CRAWL || '100');
    this.crawlDelay = parseInt(process.env.CRAWL_DELAY || '1000');
    this.timeout = parseInt(process.env.REQUEST_TIMEOUT || '30000');
    // this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5');
  }

  /**
   * Crawl a website to discover pages for accessibility auditing
   * @param {string} mainUrl - The main URL to start crawling from
   * @param {number} maxPages - Maximum number of pages to crawl (defaults to configured limit)
   * @param {boolean} homepageOnly - If true, only crawl the main URL without discovering additional pages
   * @returns {Promise<PageData[]>} Array of discovered pages with metadata
   * @description Uses both link extraction and sitemap.xml parsing to discover pages
   */
  async crawlWebsite(mainUrl: string, maxPages: number = this.maxPages, homepageOnly: boolean = false): Promise<PageData[]> {
    const baseUrl = this.normalizeUrl(mainUrl);
    const visited = new Set<string>();
    const toVisit: string[] = [baseUrl];
    const pages: PageData[] = [];
    const failedUrls: string[] = [];
    const domain = new URL(baseUrl).hostname;

    console.log(`🔍 Starting crawl of: ${baseUrl}`);
    console.log(`📊 Max pages to crawl (enforced): ${maxPages}`);
    console.log(`🏠 Homepage only mode: ${homepageOnly}`);

    // If homepageOnly is true, skip sitemap discovery and link extraction
    if (!homepageOnly) {
      // First, try to get URLs from sitemap.xml
      const sitemapUrls = await this.getSitemapUrls(baseUrl, domain);
      if (sitemapUrls.length > 0) {
        console.log(`🗺️  Found ${sitemapUrls.length} URLs in sitemap.xml`);
        // Add sitemap URLs to the queue (excluding the main URL which is already there)
        for (const url of sitemapUrls) {
          const normalizedUrl = this.normalizeUrl(url);
          // Skip excluded files and already processed URLs
          if (normalizedUrl !== baseUrl && !this.isExcludedFile(normalizedUrl) && !visited.has(normalizedUrl) && !toVisit.includes(normalizedUrl)) {
            toVisit.push(normalizedUrl);
          }
        }
      } else {
        console.log(`⚠️  No sitemap.xml found or no valid URLs extracted`);
      }
    } else {
      console.log(`🏠 Homepage-only mode: Skipping sitemap discovery and link extraction`);
    }

    // If no additional URLs were found and we're not in homepage-only mode, 
    // ensure we at least have the main URL to crawl
    if (toVisit.length === 0) {
      toVisit.push(baseUrl);
      console.log(`🔄 No additional URLs found, will crawl main URL only: ${baseUrl}`);
    }

    // If we still have no URLs to visit, something went wrong
    if (toVisit.length === 0) {
      console.error(`❌ No URLs to crawl for ${baseUrl}. This might indicate a problem with the initial URL or sitemap parsing.`);
      return pages;
    }

    while (toVisit.length > 0 && pages.length < maxPages) {
      const currentUrl = toVisit.shift()!;
      const normalizedCurrentUrl = this.normalizeUrl(currentUrl);
      
      if (visited.has(normalizedCurrentUrl)) {
        continue;
      }

      visited.add(normalizedCurrentUrl);

      try {
        console.log(`📄 Crawling: ${currentUrl}`);
        const pageData = await this.fetchPage(currentUrl);
        
        if (pageData) {
          // Check if this is a 404 page and skip it
          if (this.is404Page(currentUrl, pageData)) {
            continue;
          }
          
          // Check if this is a robots.txt or sitemap.xml file and skip it
          if (this.isExcludedFile(currentUrl)) {
            console.log(`🚫 Skipping excluded file: ${currentUrl}`);
            continue;
          }
          
          pages.push(pageData);
          
        // Only extract links from pages if we haven't reached the limit and not in homepage-only mode
        if (pages.length < maxPages && !homepageOnly) {
          // Extract links from the page
          const links = this.extractLinks(pageData.html, baseUrl, domain);
          
          // Add new links to the queue
          for (const link of links) {
            const normalizedLink = this.normalizeUrl(link);
            // Skip excluded files and already processed URLs
            if (!this.isExcludedFile(normalizedLink) && !visited.has(normalizedLink) && !toVisit.includes(normalizedLink)) {
              toVisit.push(normalizedLink);
            }
          }
        }
        }

        // Add delay between requests
        if (toVisit.length > 0) {
          await this.delay(this.crawlDelay);
        }

      } catch (error) {
        console.error(`❌ Error crawling ${currentUrl}:`, (error as Error).message);
        failedUrls.push(currentUrl);
      }
    }

    console.log(`✅ Crawl completed. Found ${pages.length} pages (limit was ${maxPages}).`);
    if (failedUrls.length > 0) {
      console.log(`⚠️  Failed to crawl ${failedUrls.length} URLs:`, failedUrls);
    }
    return pages;
  }

  private async fetchPage(url: string): Promise<PageData | null> {
    try {
      console.log(`🌐 Fetching: ${url}`);
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
        validateStatus: (status: number) => status < 400,
      });

      // Log if there was a redirect
      if (response.request.res.responseUrl && response.request.res.responseUrl !== url) {
        console.log(`🔄 Redirected: ${url} → ${response.request.res.responseUrl}`);
        
        // Check for problematic double /en/en/ paths and fix them
        const finalUrl = response.request.res.responseUrl;
        if (finalUrl.includes('/en/en/')) {
          const correctedUrl = finalUrl.replace('/en/en/', '/en/');
          console.log(`⚠️  Detected double /en/en/ path, correcting to: ${correctedUrl}`);
          
          // Try to fetch the corrected URL
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
              validateStatus: (status: number) => status < 400,
            });
            
            // Use the corrected response
            const $ = cheerio.load(correctedResponse.data);
            const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';
            
            return {
              url: correctedUrl, // Use the corrected URL
              title: title,
              html: correctedResponse.data,
              statusCode: correctedResponse.status,
              contentType: correctedResponse.headers['content-type'] || '',
            };
          } catch (correctedError) {
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
    } catch (error) {
      const errorMessage = (error as Error).message;
      const errorCode = (error as any).code;
      const errorStatus = (error as any).response?.status;
      
      console.error(`❌ Failed to fetch ${url}:`, {
        message: errorMessage,
        code: errorCode,
        status: errorStatus,
        type: (error as any).constructor?.name || 'Unknown'
      });
      
      // Log specific error types for debugging
      if (errorCode === 'ECONNABORTED') {
        console.error(`⏰ Request timeout for ${url} (${this.timeout}ms)`);
      } else if (errorCode === 'ENOTFOUND') {
        console.error(`🌐 DNS resolution failed for ${url}`);
      } else if (errorCode === 'ECONNREFUSED') {
        console.error(`🚫 Connection refused for ${url}`);
      } else if (errorStatus) {
        console.error(`📊 HTTP ${errorStatus} error for ${url}`);
      }
      
      return null;
    }
  }

  private extractLinks(html: string, baseUrl: string, domain: string): string[] {
    const $ = cheerio.load(html);
    const links = new Set<string>();
    
    // Extract all href attributes from anchor tags
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

  private resolveUrl(href: string, baseUrl: string): string | null {
    try {
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return href;
      } else if (href.startsWith('//')) {
        return `https:${href}`;
      } else if (href.startsWith('/')) {
        const base = new URL(baseUrl);
        return `${base.protocol}//${base.host}${href}`;
      } else {
        return new URL(href, baseUrl).href;
      }
    } catch (error) {
      return null;
    }
  }

  private isValidUrl(url: string, domain: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // Check if it's the same domain or a known redirect domain
      const allowedDomains = [domain, 't3planet.de', 't3planet.com'];
      if (!allowedDomains.includes(urlObj.hostname)) {
        return false;
      }

      // Exclude common non-content URLs
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
        // Exclude React and JS project URLs
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
    } catch (error) {
      return false;
    }
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    try {
      const urlObj = new URL(url);
      
      // For root paths, ensure consistent trailing slash
      if (urlObj.pathname === '/' || urlObj.pathname === '') {
        return `${urlObj.protocol}//${urlObj.hostname}/`;
      }
      
      // For other paths, remove trailing slash for consistency
      if (urlObj.pathname.endsWith('/') && urlObj.pathname !== '/') {
        const newPath = urlObj.pathname.slice(0, -1);
        return `${urlObj.protocol}//${urlObj.hostname}${newPath}`;
      }
      
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Extract URLs from sitemap.xml file
   * @param {string} baseUrl - The base URL of the website
   * @param {string} domain - The domain for URL validation
   * @returns {Promise<string[]>} Array of valid URLs from sitemap
   * @description Attempts to fetch and parse sitemap.xml, falls back to alternative locations
   */
  private async getSitemapUrls(baseUrl: string, domain: string): Promise<string[]> {
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    const urls: string[] = [];

    try {
      console.log(`🗺️  Attempting to fetch sitemap from: ${sitemapUrl}`);
      const response = await axios.get(sitemapUrl, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AccesstiveBot/1.0; +https://accesstive.org)',
          'Accept': 'application/xml,text/xml,*/*',
        },
        validateStatus: (status: number) => status < 400,
      });

      const $ = cheerio.load(response.data, { xmlMode: true });
      
      // Parse sitemap.xml - look for <loc> tags
      $('loc').each((_index, element) => {
        const url = $(element).text().trim();
        if (url) {
          // Resolve relative URLs to absolute URLs
          const absoluteUrl = this.resolveUrl(url, baseUrl);
          if (absoluteUrl && this.isValidUrl(absoluteUrl, domain)) {
            urls.push(absoluteUrl);
          }
        }
      });

      console.log(`🗺️  Successfully parsed sitemap.xml, found ${urls.length} valid URLs`);
      return urls;

    } catch (error) {
      console.log(`⚠️  Could not fetch sitemap.xml from ${sitemapUrl}: ${(error as Error).message}`);
      
      // Try alternative sitemap locations
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
            validateStatus: (status: number) => status < 400,
          });

          const $alt = cheerio.load(altResponse.data, { xmlMode: true });
          
          $alt('loc').each((_index, element) => {
            const url = $alt(element).text().trim();
            if (url) {
              // Resolve relative URLs to absolute URLs
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
        } catch (altError) {
          console.log(`⚠️  Alternative sitemap ${altSitemap} not found`);
        }
      }

      return urls;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if a page is a 404 error page
   * @param {string} url - The URL of the page
   * @param {PageData} pageData - The page data to check
   * @returns {boolean} True if this is a 404 page
   */
  private is404Page(url: string, pageData: PageData): boolean {
    // Check HTTP status code first - this is the most reliable indicator
    if (pageData.statusCode === 404) {
      return true;
    }

    // Check URL path for 404 indicators (but not if it's a legitimate 404 page in sitemap)
    const urlObj = new URL(url);
    const urlPath = urlObj.pathname.toLowerCase();
    
    // Only filter out if it's clearly an error page, not a legitimate page about 404s
    if (urlPath.includes('/not-found') || urlPath.includes('/error') || 
        urlPath.includes('/page-not-found') || urlPath.includes('/file-not-found')) {
      return true;
    }

    // Check page title for 404 indicators
    const title = pageData.title.toLowerCase();
    if (title.includes('404') || title.includes('not found') || title.includes('page not found')) {
      return true;
    }

    // Check HTML content for 404 indicators (but be more specific)
    const html = pageData.html.toLowerCase();
    if (html.includes('404 error') || html.includes('not found') || 
        html.includes('page not found') || html.includes('file not found')) {
      return true;
    }

    return false;
  }

  /**
   * Check if a URL is an excluded file (robots.txt, sitemap.xml, etc.)
   * @param {string} url - The URL to check
   * @returns {boolean} True if this is an excluded file
   */
  private isExcludedFile(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      // Check for robots.txt
      if (pathname === '/robots.txt' || pathname.endsWith('/robots.txt')) {
        return true;
      }
      
      // Check for sitemap.xml
      if (pathname === '/sitemap.xml' || pathname.endsWith('/sitemap.xml')) {
        return true;
      }
      
      // Check for other common sitemap variations
      if (pathname.includes('/sitemap') && pathname.endsWith('.xml')) {
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }
} 