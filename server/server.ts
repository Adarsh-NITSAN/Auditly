/**
 * @fileoverview Express server for the Automatic Accessibility Audit Tool
 * @description Main server file that handles API endpoints for crawling, auditing, and reporting
 * @author Accesstive Team
 * @version 1.0.0
 */

import express, { Request, Response, NextFunction } from 'express';
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

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for audit history (in production, use a database)
const auditHistory: Array<{
  id: string;
  timestamp: string;
  summary: any;
  results: any[];
  pages: string[];
}> = [];

// Initialize services
const crawlerService = new CrawlerService();
const auditService = new AuditService();
const reportService = new ReportService();

// Middleware
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
app.use(compression() as any);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../')));

// API Routes

/**
 * Health check endpoint
 * @route GET /api/health
 * @returns {Object} Server status and timestamp
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test Accesstive API connection
app.get('/api/test-auth', async (_req: Request, res: Response) => {
  try {
    const authStatus = await auditService.testAuthentication();
    res.json({ 
      status: 'OK', 
      authStatus,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Auth test error:', error);
    res.status(500).json({ 
      error: (error as Error).message,
      timestamp: new Date().toISOString() 
    });
  }
});

/**
 * Crawl website for pages
 * @route POST /api/crawl
 * @param {string} mainUrl - The main URL to start crawling from
 * @param {number} maxPages - Maximum number of pages to crawl (1-500)
 * @returns {Object} Array of discovered pages with URLs and titles
 */
app.post('/api/crawl', async (req: Request, res: Response) => {
  try {
    let { mainUrl, maxPages = 100 } = req.body;
    
    if (!mainUrl) {
      return res.status(400).json({ error: 'Main URL is required' });
    }

    // Validate maxPages
    maxPages = parseInt(maxPages, 10);
    if (isNaN(maxPages) || maxPages < 1 || maxPages > 500) {
      console.warn(`Invalid maxPages received: ${req.body.maxPages}`);
      return res.status(400).json({ error: 'maxPages must be a number between 1 and 500' });
    }
    console.log(`Received crawl request: mainUrl=${mainUrl}, maxPages=${maxPages}, raw body:`, JSON.stringify(req.body));

    const pages = await crawlerService.crawlWebsite(mainUrl, maxPages);
    return res.json({ 
      success: true, 
      pages: pages.map(page => ({
        url: page.url,
        title: page.title,
        selected: true
      }))
    });
  } catch (error) {
    console.error('Crawl error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Crawl multiple domains for pages and run accessibility audits
 * @route POST /api/crawl-multi
 * @param {string[]} domains - Array of domain URLs to crawl
 * @param {number} maxPages - Maximum number of pages to crawl per domain (1-500)
 * @returns {Object} Combined results from all domains
 */
app.post('/api/crawl-multi', async (req: Request, res: Response) => {
  try {
    const { domains, maxPages = 100 } = req.body;
    
    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ error: 'At least one domain is required' });
    }

    // Validate maxPages
    const validatedMaxPages = parseInt(maxPages, 10);
    if (isNaN(validatedMaxPages) || validatedMaxPages < 1 || validatedMaxPages > 500) {
      return res.status(400).json({ error: 'maxPages must be a number between 1 and 500' });
    }

    console.log(`Received multi-domain crawl request: ${domains.length} domains, maxPages=${validatedMaxPages}`);

    const results = [];
    
    // Process each domain
    for (const domain of domains) {
      try {
        console.log(`🔍 Crawling domain: ${domain}`);
        
        // Crawl the domain
        const pages = await crawlerService.crawlWebsite(domain, validatedMaxPages);
        
        // Run accessibility audit on discovered pages
        const pageUrls = pages.map(page => page.url);
        const auditResults = await auditService.auditPages(pageUrls);
        
        // Generate summary for this domain
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
        
      } catch (error) {
        console.error(`❌ Error processing domain ${domain}:`, (error as Error).message);
        results.push({
          domain,
          error: (error as Error).message,
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
  } catch (error) {
    console.error('Multi-domain crawl error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Run accessibility audit on selected pages
 * @route POST /api/audit
 * @param {string[]} pages - Array of page URLs to audit
 * @param {string[]} customUrls - Additional custom URLs to audit
 * @returns {Object} Audit results with violations and summary
 */
app.post('/api/audit', async (req: Request, res: Response) => {
  try {
    const { pages, customUrls = [] } = req.body;
    
    if (!pages || pages.length === 0) {
      return res.status(400).json({ error: 'At least one page must be selected' });
    }

    const allUrls = [...pages, ...customUrls];
    const results = await auditService.auditPages(allUrls);
    
    // Generate summary with only violations
    const summary = reportService.generateSummary(results);
    
    // Store audit data for comparison
    const auditData = {
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      summary,
      results,
      pages: allUrls
    };
    
    // Store in memory (in production, use a database)
    auditHistory.push(auditData);
    
    return res.json({ 
      success: true, 
      results,
      summary,
      auditId: auditData.id
    });
  } catch (error) {
    console.error('Audit error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get audit history
app.get('/api/audit-history', (_req: Request, res: Response) => {
  try {
    const history = auditHistory.map(audit => ({
      id: audit.id,
      timestamp: audit.timestamp,
      summary: audit.summary,
      pageCount: audit.pages.length
    }));
    
    res.json({ history });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get specific audit data
app.get('/api/audit/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const audit = auditHistory.find(a => a.id === id);
    
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }
    
    return res.json({ audit });
  } catch (error) {
    console.error('Get audit error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Compare two audits
app.post('/api/audit-compare', (req: Request, res: Response) => {
  try {
    const { auditId1, auditId2 } = req.body;
    
    const audit1 = auditHistory.find(a => a.id === auditId1);
    const audit2 = auditHistory.find(a => a.id === auditId2);
    
    if (!audit1 || !audit2) {
      return res.status(404).json({ error: 'One or both audits not found' });
    }
    
    const comparison = reportService.compareAudits(audit1, audit2);
    
    return res.json({ comparison });
  } catch (error) {
    console.error('Compare error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Generate detailed report
app.post('/api/report', async (req: Request, res: Response) => {
  try {
    const { results, format = 'json' } = req.body;
    
    if (!results) {
      return res.status(400).json({ error: 'Results data is required' });
    }

    const report = await reportService.generateDetailedReport(results, format);
    
    if (format === 'json') {
      return res.json(report);
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="accessibility-audit-report.csv"');
      return res.send(report);
    }
  } catch (error) {
    console.error('Report generation error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Serve the main application
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Automatic Audit Server running on port ${PORT}`);
  console.log(`📊 Access the application at: http://localhost:${PORT}`);
}); 