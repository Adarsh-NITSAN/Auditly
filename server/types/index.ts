// Page and crawling types
export interface PageData {
  url: string;
  title: string;
  html: string;
  statusCode: number;
  contentType: string;
}

export interface CrawledPage {
  url: string;
  title: string;
  selected: boolean;
}

// Accessibility issue types
export interface AccessibilityIssue {
  id: string;
  title: string;
  description: string;
  help: string;
  category: string;
  level: 'error' | 'warning' | 'hint';
  impact: 'critical' | 'serious' | 'moderate' | 'minor' | 'passed';
  selector: string;
  html: string;
  failureSummary: string;
  tags: string[];
  helpUrl: string;
  guidelines: string;
  whyImportant: string;
  howToFix: string;
  disabilityTypesAffected: string[];
  wcagReferences: string[];
}

// Audit result types
export interface AuditResult {
  url: string;
  timestamp: string;
  summary: {
    totalIssues: number;
    errors: number;
    warnings: number;
    hints: number;
    pagesWithIssues: number;
  };
  issues: {
    errors: AccessibilityIssue[];
    warnings: AccessibilityIssue[];
    hints: AccessibilityIssue[];
  };
  rawData?: any;
  error?: string;
}

// Summary types
export interface AuditSummary {
  totalPages: number;
  pagesWithIssues: number;
  totalIssues: number;
  errors: number;
  warnings: number;
  hints: number;
  categories: Record<string, CategorySummary>;
  topIssues: TopIssue[];
  timestamp: string;
}

export interface CategorySummary {
  name: string;
  count: number;
  percentage: number;
}

export interface TopIssue {
  id: string;
  title: string;
  level: string;
  category: string;
  count: number;
  pages: string[];
  pageCount: number;
  impact: string;
}

// API request/response types
export interface CrawlRequest {
  mainUrl: string;
  maxPages?: number;
}

export interface CrawlResponse {
  success: boolean;
  pages: CrawledPage[];
}

export interface AuditRequest {
  pages: string[];
  customUrls?: string[];
}

export interface AuditResponse {
  success: boolean;
  results: AuditResult[];
  summary: AuditSummary;
}

export interface ReportRequest {
  results: AuditResult[];
  format?: 'json' | 'csv';
}

// Environment configuration types
export interface EnvironmentConfig {
  // Server Configuration
  PORT: string;
  NODE_ENV: string;
  
  // Accesstive API Configuration
  ACCESSTIVE_API_URL: string;
  ACCESSTIVE_API_KEY: string;
  ACCESSTIVE_AUTH_TOKEN: string;
  
  // Crawler Configuration
  MAX_PAGES_TO_CRAWL: string;
  CRAWL_DELAY: string;
  REQUEST_TIMEOUT: string;
  MAX_CONCURRENT_REQUESTS: string;
  
  // Report Configuration
  REPORT_LANGUAGE: string;
  ENABLE_SCREENSHOTS: string;
  ENABLE_HIGHLIGHT: string;
} 