/**
 * @fileoverview Main application logic for the Automatic Accessibility Audit Tool
 * @description Handles UI interactions, API calls, and data management for the frontend
 * @author Accesstive Team
 * @version 1.0.0
 */

// Types for the frontend
interface CrawledPage {
  url: string;
  title: string;
  selected: boolean;
}

interface AuditResult {
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
    errors: any[];
    warnings: any[];
    hints: any[];
  };
  error?: string;
  rawData?: any; // Store complete JSON data for comparison
}

interface AuditSummary {
  totalPages: number;
  pagesWithIssues: number;
  totalIssues: number;
  errors: number;
  warnings: number;
  hints: number;
  categories: Record<string, any>;
  topIssues: any[];
  timestamp: string;
}

// New interfaces for page-wise data
interface PageIssueCategory {
  category: string;
  count: number;
  issues: any[];
}

interface PageAuditData {
  url: string;
  title: string;
  timestamp: string;
  summary: {
    totalViolations: number;
    errors: number;
    warnings: number;
    hints: number;
  };
  categories: PageIssueCategory[];
  rawData: any;
}

// Interface for stored audit data
interface StoredAuditData {
  id: string;
  timestamp: string;
  summary: AuditSummary;
  pages: PageAuditData[];
  rawResults: AuditResult[];
}

/**
 * Main application class for the Automatic Accessibility Audit Tool
 * @class AutomaticAuditApp
 * @description Manages the entire application lifecycle including crawling, auditing, and reporting
 */
export class AutomaticAuditApp {
  // private _currentStep: number = 1; // TODO: Track current step if needed
  private pages: CrawledPage[] = [];
  private customUrls: string[] = [];
  private auditResults: AuditResult[] | null = null;
  private auditSummary: AuditSummary | null = null;
  private pageAuditData: PageAuditData[] = [];
  private auditHistory: StoredAuditData[] = [];
  private localStorageEnabled: boolean = true; // Flag to disable localStorage if needed
  
  constructor() {
    this.initializeEventListeners();
    this.loadAuditHistory();
  }

  private initializeEventListeners(): void {
    // Step 1: Start crawling
    document.getElementById('startCrawl')?.addEventListener('click', () => this.startCrawling());
    
    // Step 2: Page selection
    document.getElementById('selectAll')?.addEventListener('click', () => this.selectAllPages());
    document.getElementById('deselectAll')?.addEventListener('click', () => this.deselectAllPages());
    document.getElementById('addCustomUrl')?.addEventListener('click', () => this.addCustomUrl());
    document.getElementById('startAudit')?.addEventListener('click', () => this.startAudit());
    document.getElementById('backToStep1')?.addEventListener('click', () => this.goToStep(1));
    
    // Step 3: Results
    document.getElementById('backToStep2')?.addEventListener('click', () => this.goToStep(2));
    document.getElementById('exportJson')?.addEventListener('click', () => this.exportResults('json'));
    document.getElementById('exportCsv')?.addEventListener('click', () => this.exportResults('csv'));
    document.getElementById('newAudit')?.addEventListener('click', () => this.resetApp());
    
    // Modal
    document.querySelector('.modal-close')?.addEventListener('click', () => this.closeErrorModal());
    document.getElementById('customUrl')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addCustomUrl();
    });
  }

  private async startCrawling(): Promise<void> {
    const mainUrl = (document.getElementById('mainUrl') as HTMLInputElement)?.value.trim();
    const maxPages = parseInt((document.getElementById('maxPages') as HTMLInputElement)?.value || '100');

    if (!mainUrl) {
      this.showError('Please enter a valid URL');
      return;
    }

    if (!this.isValidUrl(mainUrl)) {
      this.showError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    this.showLoading('Crawling website to discover pages...');
    this.setButtonLoading('startCrawl', true);

    try {
      console.log(`Frontend sending: mainUrl=${mainUrl}, maxPages=${maxPages}`);
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mainUrl: mainUrl,
          maxPages: maxPages
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to crawl website');
      }

      this.pages = data.pages;
      this.renderPagesList();
      this.goToStep(2);

    } catch (error) {
      this.showError((error as Error).message);
    } finally {
      this.hideLoading();
      this.setButtonLoading('startCrawl', false);
    }
  }

  private renderPagesList(): void {
    const pagesList = document.getElementById('pagesList');
    const pageCount = document.getElementById('pageCount');

    if (!pagesList || !pageCount) return;

    if (this.pages.length === 0) {
      pagesList.innerHTML = '<div class="page-item"><p>No pages found. Please check the URL and try again.</p></div>';
      pageCount.textContent = '0 pages selected';
      return;
    }

    pagesList.innerHTML = this.pages.map((page, index) => `
      <div class="page-item">
        <input type="checkbox" 
               class="page-checkbox" 
               id="page-${index}" 
               data-url="${page.url}"
               ${page.selected ? 'checked' : ''}>
        <div class="page-info">
          <div class="page-title">${page.title || 'Untitled'}</div>
          <div class="page-url">${page.url}</div>
        </div>
      </div>
    `).join('');

    // Add event listeners to checkboxes
    this.pages.forEach((_page, index) => {
      document.getElementById(`page-${index}`)?.addEventListener('change', () => {
        this.updatePageCount();
      });
    });

    this.updatePageCount();
  }

  private updatePageCount(): void {
    const selectedPages = this.getSelectedPages();
    const pageCount = document.getElementById('pageCount');
    if (pageCount) {
      pageCount.textContent = `${selectedPages.length} pages selected`;
    }
  }

  private getSelectedPages(): string[] {
    const selectedPages: string[] = [];
    this.pages.forEach((page, index) => {
      const checkbox = document.getElementById(`page-${index}`) as HTMLInputElement;
      if (checkbox && checkbox.checked) {
        selectedPages.push(page.url);
      }
    });
    return [...selectedPages, ...this.customUrls];
  }

  private selectAllPages(): void {
    this.pages.forEach((_page, index) => {
      const checkbox = document.getElementById(`page-${index}`) as HTMLInputElement;
      if (checkbox) checkbox.checked = true;
    });
    this.updatePageCount();
  }

  private deselectAllPages(): void {
    this.pages.forEach((_page, index) => {
      const checkbox = document.getElementById(`page-${index}`) as HTMLInputElement;
      if (checkbox) checkbox.checked = false;
    });
    this.updatePageCount();
  }

  private addCustomUrl(): void {
    const customUrlInput = document.getElementById('customUrl') as HTMLInputElement;
    const url = customUrlInput?.value.trim();

    if (!url) {
      this.showError('Please enter a URL');
      return;
    }

    if (!this.isValidUrl(url)) {
      this.showError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    if (this.customUrls.includes(url)) {
      this.showError('This URL has already been added');
      return;
    }

    this.customUrls.push(url);
    this.renderCustomUrls();
    if (customUrlInput) customUrlInput.value = '';
    this.updatePageCount();
  }

  private renderCustomUrls(): void {
    const customUrlsList = document.getElementById('customUrlsList');
    if (!customUrlsList) return;

    customUrlsList.innerHTML = this.customUrls.map((url, index) => `
      <div class="badge bg-primary d-inline-flex align-items-center gap-2">
        <span>${url}</span>
        <button type="button" class="btn-close btn-close-white btn-sm" data-remove-index="${index}"></button>
      </div>
    `).join('');
    this.attachRemoveCustomUrlListeners();
  }

  public removeCustomUrl(index: number): void {
    this.customUrls.splice(index, 1);
    this.renderCustomUrls();
    this.updatePageCount();
    // Re-attach event listeners for remove buttons
    this.attachRemoveCustomUrlListeners();
  }

  private async startAudit(): Promise<void> {
    const selectedPages = this.getSelectedPages();

    if (selectedPages.length === 0) {
      this.showError('Please select at least one page to audit');
      return;
    }

    this.showLoading('Starting accessibility audit...');
    this.setButtonLoading('startAudit', true);

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pages: selectedPages.filter(url => !this.customUrls.includes(url)),
          customUrls: this.customUrls
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start audit');
      }

      this.auditResults = data.results;
      this.auditSummary = data.summary;
      
      // Process page-wise data
      this.processPageWiseData();
      
      // Store audit data for comparison
      this.storeAuditData();
      
      this.renderResults();
      this.goToStep(3);

    } catch (error) {
      this.showError((error as Error).message);
    } finally {
      this.hideLoading();
      this.setButtonLoading('startAudit', false);
    }
  }

  private processPageWiseData(): void {
    if (!this.auditResults) return;
    
    this.pageAuditData = this.auditResults
      .filter(result => !result.error)
      .map(result => this.createPageAuditData(result));
  }

  private createPageAuditData(result: AuditResult): PageAuditData {
    // STRICT VALIDATION: Only count violations (errors, warnings, hints) - exclude passed, incomplete, inapplicable
    const violations = {
      errors: this.filterViolationsOnly(result.issues.errors || []),
      warnings: this.filterViolationsOnly(result.issues.warnings || []),
      hints: this.filterViolationsOnly(result.issues.hints || [])
    };

    // Group issues by category - only violations
    const categoryMap = new Map<string, any[]>();
    
    Object.values(violations).flat().forEach(issue => {
      // Additional validation to ensure only violations are included
      if (this.isViolationIssue(issue)) {
        const category = issue.category || 'other';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(issue);
      }
    });

    const categories: PageIssueCategory[] = Array.from(categoryMap.entries()).map(([category, issues]) => ({
      category,
      count: issues.length,
      issues
    })).sort((a, b) => b.count - a.count);

    return {
      url: result.url,
      title: this.extractPageTitle(result.url),
      timestamp: result.timestamp,
      summary: {
        totalViolations: violations.errors.length + violations.warnings.length + violations.hints.length,
        errors: violations.errors.length,
        warnings: violations.warnings.length,
        hints: violations.hints.length
      },
      categories,
      rawData: result.rawData || result
    };
  }

  private filterViolationsOnly(issues: any[]): any[] {
    // Additional frontend validation to ensure only violations are included
    return issues.filter(issue => this.isViolationIssue(issue));
  }

  private isViolationIssue(issue: any): boolean {
    // Check if the issue is actually a violation (not passed, incomplete, inapplicable)
    if (!issue) return false;
    
    // Check for excluded statuses/types - EXCLUDE needs review from this list
    const excludedStatuses = ['passed', 'incomplete', 'inapplicable', 'na'];
    const issueStatus = (issue.status || issue.type || issue.result || '').toLowerCase();
    const issueType = (issue.type || issue.status || issue.result || '').toLowerCase();
    
    // Exclude if status/type indicates non-violation
    if (excludedStatuses.includes(issueStatus) || excludedStatuses.includes(issueType)) {
      return false;
    }
    
    // Ensure the issue has meaningful content
    return !!(issue.title || issue.description || issue.help || issue.howToFix);
  }

  private storeAuditData(): void {
    if (!this.auditResults || !this.auditSummary) return;

    // Store only essential data to prevent localStorage quota issues
    const auditData: StoredAuditData = {
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      summary: this.auditSummary,
      pages: this.pageAuditData.map(page => ({
        ...page,
        // Remove rawData to save space - only keep essential info
        rawData: undefined
      })),
      // Store only essential raw results data
      rawResults: this.auditResults.map(result => ({
        url: result.url,
        timestamp: result.timestamp,
        summary: result.summary,
        // Only keep essential issue data, not full raw data
        issues: result.issues,
        error: result.error
      }))
    };

    this.auditHistory.push(auditData);
    this.saveAuditHistory();
  }

  private loadAuditHistory(): void {
    if (!this.localStorageEnabled) {
      console.log('localStorage disabled, skipping audit history load');
      return;
    }

    try {
      const stored = localStorage.getItem('auditHistory');
      if (stored) {
        this.auditHistory = JSON.parse(stored);
        
        // Validate and clean up corrupted data
        if (!Array.isArray(this.auditHistory)) {
          console.warn('Invalid audit history format, resetting');
          this.auditHistory = [];
          localStorage.removeItem('auditHistory');
          return;
        }
        
        // Remove any invalid entries
        this.auditHistory = this.auditHistory.filter(audit => 
          audit && 
          typeof audit === 'object' && 
          audit.id && 
          audit.timestamp && 
          audit.summary
        );
      }
    } catch (error) {
      console.error('Failed to load audit history:', error);
      this.auditHistory = [];
      // Clear corrupted data
      try {
        localStorage.removeItem('auditHistory');
      } catch (clearError) {
        console.error('Failed to clear corrupted audit history:', clearError);
      }
    }
  }

  private saveAuditHistory(): void {
    if (!this.localStorageEnabled) {
      console.log('localStorage disabled, skipping audit history save');
      return;
    }

    try {
      // More aggressive limits for localStorage
      const MAX_AUDIT_HISTORY = 5; // Keep only last 5 audits
      const MAX_AUDIT_SIZE = 2 * 1024 * 1024; // 2MB limit total
      
      // Clean up old audits if we have too many
      if (this.auditHistory.length > MAX_AUDIT_HISTORY) {
        this.auditHistory = this.auditHistory.slice(-MAX_AUDIT_HISTORY);
      }
      
      // Check if current audit data is too large
      const auditDataString = JSON.stringify(this.auditHistory);
      if (auditDataString.length > MAX_AUDIT_SIZE) {
        console.warn('Audit data too large, removing oldest audits to fit in localStorage');
        // Remove oldest audits until we're under the limit
        while (this.auditHistory.length > 1 && JSON.stringify(this.auditHistory).length > MAX_AUDIT_SIZE) {
          this.auditHistory.shift(); // Remove oldest audit
        }
      }
      
      localStorage.setItem('auditHistory', JSON.stringify(this.auditHistory));
    } catch (error) {
      console.error('Failed to save audit history:', error);
      
      // If it's a quota error, try to clean up and save again
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        try {
          console.warn('localStorage quota exceeded, clearing old audit history');
          // Clear all audit history and try to save just the current one
          this.auditHistory = this.auditHistory.slice(-1); // Keep only the most recent
          localStorage.setItem('auditHistory', JSON.stringify(this.auditHistory));
        } catch (retryError) {
          console.error('Failed to save audit history even after cleanup:', retryError);
          // If still failing, disable localStorage and clear it
          try {
            localStorage.removeItem('auditHistory');
            this.auditHistory = [];
            this.localStorageEnabled = false; // Disable localStorage for future operations
            console.warn('localStorage disabled due to quota issues. Audit history will not be persisted.');
          } catch (clearError) {
            console.error('Failed to clear localStorage:', clearError);
          }
        }
      }
    }
  }

  private renderResults(): void {
    this.renderSummary();
    this.renderDetailedResults();
  }

  private renderSummary(): void {
    const summaryContainer = document.getElementById('resultsSummary');
    if (!summaryContainer || !this.auditSummary) return;
    
    summaryContainer.innerHTML = `
      <div class="row text-center mb-4">
        <div class="col-md-2 col-6 mb-3">
          <div class="card shadow-sm">
            <div class="card-body">
              <div class="display-4">${this.auditSummary.totalPages}</div>
              <div class="text-muted">Pages Audited</div>
            </div>
          </div>
        </div>
        <div class="col-md-2 col-6 mb-3">
          <div class="card shadow-sm">
            <div class="card-body">
              <div class="display-4">${this.auditSummary.pagesWithIssues}</div>
              <div class="text-muted">Pages with Issues</div>
            </div>
          </div>
        </div>
        <div class="col-md-2 col-4 mb-3">
          <div class="card border-danger shadow-sm">
            <div class="card-body">
              <div class="display-4 text-danger">${this.auditSummary.errors}</div>
              <div class="text-danger">Errors</div>
            </div>
          </div>
        </div>
        <div class="col-md-2 col-4 mb-3">
          <div class="card border-warning shadow-sm">
            <div class="card-body">
              <div class="display-4 text-warning">${this.auditSummary.warnings}</div>
              <div class="text-warning">Warnings</div>
            </div>
          </div>
        </div>
        <div class="col-md-2 col-4 mb-3">
          <div class="card border-info shadow-sm">
            <div class="card-body">
              <div class="display-4 text-info">${this.auditSummary.hints}</div>
              <div class="text-info">Hints</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- PUBLIC METHODS FOR HTML/GLOBAL ACCESS ---
  public clearAuditHistory(): void {
    try {
      this.auditHistory = [];
      if (this.localStorageEnabled) {
        localStorage.removeItem('auditHistory');
      }
      console.log('Audit history cleared successfully');
    } catch (error) {
      console.error('Failed to clear audit history:', error);
    }
  }

  public enableLocalStorage(): void {
    this.localStorageEnabled = true;
    console.log('localStorage re-enabled for audit history');
  }

  public disableLocalStorage(): void {
    this.localStorageEnabled = false;
    console.log('localStorage disabled for audit history');
  }

  public exportPageData(pageIndex: number): void {
    const pageData = this.pageAuditData[pageIndex];
    if (!pageData) return;
    const exportData = {
      page: pageData,
      exportDate: new Date().toISOString(),
      tool: 'Automatic Accessibility Audit Tool'
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const filename = `audit-${pageData.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.json`;
    this.downloadFile(blob, filename);
  }

  public showPageDetails(pageIndex: number): void {
    const pageData = this.pageAuditData[pageIndex];
    if (!pageData) return;
    // Remove any existing modal
    document.querySelectorAll('.modal').forEach(m => m.remove());
    const modal = document.createElement('div');
    modal.className = 'modal fade show d-block';
    modal.tabIndex = -1;
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${pageData.title}</h5>
            <button type="button" class="close" aria-label="Close" onclick="this.closest('.modal').remove()">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="mb-2"><strong>URL:</strong> <a href="${pageData.url}" target="_blank">${pageData.url}</a></div>
            <div class="mb-2"><strong>Audited:</strong> ${new Date(pageData.timestamp).toLocaleString()}</div>
            <div class="mb-3"><strong>Total Violations:</strong> <span class="badge bg-dark">${pageData.summary.totalViolations}</span></div>
            ${pageData.categories.length > 0 ? `
              <div class="mb-3">
                ${pageData.categories.map(category => this.renderCategoryDetails(category)).join('')}
              </div>
            ` : `
              <div class="alert alert-success">✅ No accessibility violations found on this page.</div>
            `}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
            <button class="btn btn-primary export-page-data-btn" data-page-index="${pageIndex}">Export Page Data</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    // Dismiss modal on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    // Attach event listener for export button
    const exportBtn = modal.querySelector('.export-page-data-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exportPageData(pageIndex);
      });
    }
  }

  private renderCategoryDetails(category: PageIssueCategory): string {
    return `
      <div class="mb-3">
        <h6>${this.formatCategoryName(category.category)} <span class="badge bg-secondary rounded-pill">${category.count} issues</span></h6>
        <div class="list-group">
          ${category.issues.map(issue => `
            <div class="list-group-item list-group-item-action flex-column align-items-start ${issue.level === 'error' ? 'list-group-item-danger' : issue.level === 'warning' ? 'list-group-item-warning' : 'list-group-item-info'}">
              <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1">${issue.title}</h6>
                <small class="text-muted">${issue.impact || 'Unknown'}</small>
              </div>
              <p class="mb-1">${issue.description || 'No description available'}</p>
              ${issue.help ? `<p class="mb-1"><strong>Help:</strong> ${issue.help}</p>` : ''}
              ${issue.howToFix ? `<p class="mb-1"><strong>How to Fix:</strong> ${issue.howToFix}</p>` : ''}
              ${issue.selector ? `<p class="mb-1"><strong>Selector:</strong> <code>${issue.selector}</code></p>` : ''}
              ${issue.wcagReferences && issue.wcagReferences.length > 0 ? 
                `<p class="mb-1"><strong>WCAG References:</strong> ${issue.wcagReferences.join(', ')}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private async exportResults(format: 'json' | 'csv'): Promise<void> {
    if (!this.auditResults) {
      this.showError('No results to export');
      return;
    }

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          results: this.auditResults,
          format: format
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate report');
      }

      if (format === 'csv') {
        const blob = new Blob([await response.text()], { type: 'text/csv' });
        this.downloadFile(blob, 'accessibility-audit-report.csv');
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.downloadFile(blob, 'accessibility-audit-report.json');
      }

    } catch (error) {
      this.showError((error as Error).message);
    }
  }

  private downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  private goToStep(step: number): void {
    // Hide all steps
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    
    // Show target step
    const targetStep = document.getElementById(`step${step}`);
    if (targetStep) {
      targetStep.classList.add('active');
    }
    
    // this._currentStep = step;
  }

  private resetApp(): void {
    this.pages = [];
    this.customUrls = [];
    this.auditResults = null;
    this.auditSummary = null;
    
    // Reset form
    const mainUrlInput = document.getElementById('mainUrl') as HTMLInputElement;
    const maxPagesInput = document.getElementById('maxPages') as HTMLInputElement;
    const customUrlInput = document.getElementById('customUrl') as HTMLInputElement;
    
    if (mainUrlInput) mainUrlInput.value = '';
    if (maxPagesInput) maxPagesInput.value = '100';
    if (customUrlInput) customUrlInput.value = '';
    
    // Clear displays
    const pagesList = document.getElementById('pagesList');
    const customUrlsList = document.getElementById('customUrlsList');
    const resultsSummary = document.getElementById('resultsSummary');
    const resultsDetails = document.getElementById('resultsDetails');
    
    if (pagesList) pagesList.innerHTML = '';
    if (customUrlsList) customUrlsList.innerHTML = '';
    if (resultsSummary) resultsSummary.innerHTML = '';
    if (resultsDetails) resultsDetails.innerHTML = '';
    
    this.goToStep(1);
  }

  private showLoading(message: string): void {
    console.log('showLoading called with message:', message);
    const loadingMessage = document.getElementById('loadingMessage');
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    if (loadingMessage) loadingMessage.textContent = message;
    if (loadingOverlay) {
      loadingOverlay.classList.remove('d-none');
      loadingOverlay.classList.add('d-flex');
      console.log('Loading overlay classes:', loadingOverlay.className);
    } else {
      console.error('Loading overlay element not found');
    }
  }

  private hideLoading(): void {
    console.log('hideLoading called');
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.remove('d-flex');
      loadingOverlay.classList.add('d-none');
      console.log('Loading overlay hidden');
    } else {
      console.error('Loading overlay element not found');
    }
  }

  private setButtonLoading(buttonId: string, loading: boolean): void {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    const text = button.querySelector('.btn-text');
    const loadingEl = button.querySelector('.btn-loading');
    
    if (loading) {
      if (text) {
        (text as HTMLElement).classList.remove('d-flex');
        (text as HTMLElement).classList.add('d-none');
      }
      if (loadingEl) {
        (loadingEl as HTMLElement).classList.remove('d-none');
        (loadingEl as HTMLElement).classList.add('d-flex');
      }
      button.setAttribute('disabled', 'true');
    } else {
      if (text) {
        (text as HTMLElement).classList.remove('d-none');
        (text as HTMLElement).classList.add('d-flex');
      }
      if (loadingEl) {
        (loadingEl as HTMLElement).classList.remove('d-flex');
        (loadingEl as HTMLElement).classList.add('d-none');
      }
      button.removeAttribute('disabled');
    }
  }

  private showError(message: string): void {
    const errorMessage = document.getElementById('errorMessage');
    const errorModal = document.getElementById('errorModal');
    if (errorMessage) errorMessage.innerHTML = `<div class='alert alert-danger'>${message}</div>`;
    if (errorModal) {
      errorModal.classList.remove('d-none');
      errorModal.classList.add('d-block');
    }
  }

  public closeErrorModal(): void {
    const errorModal = document.getElementById('errorModal');
    if (errorModal) {
      errorModal.classList.remove('d-block');
      errorModal.classList.add('d-none');
    }
  }

  private isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }

  private extractPageTitle(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      if (pathname === '/' || pathname === '') {
        return urlObj.hostname;
      }
      return pathname.split('/').pop() || urlObj.hostname;
    } catch {
      return url;
    }
  }

  // --- CATEGORY NAME FORMATTER ---
  private formatCategoryName(category: string): string {
    const categoryMap: Record<string, string> = {
      'cat.forms': 'Forms & Inputs',
      'cat.navigation': 'Navigation',
      'cat.images': 'Images & Media',
      'cat.text': 'Text & Typography',
      'cat.structure': 'Page Structure',
      'cat.interactive': 'Interactive Elements',
      'cat.color': 'Color & Contrast',
      'cat.keyboard': 'Keyboard Navigation',
      'cat.semantics': 'Semantic HTML',
      'cat.tables': 'Tables',
      'cat.aria': 'ARIA',
      'cat.parsing': 'HTML Parsing',
      'cat.time-and-media': 'Time & Media',
      'cat.name-role-value': 'Name, Role, Value',
      'cat.other': 'Other'
    };
    return categoryMap[category] || category.replace('cat.', '').replace(/([A-Z])/g, ' $1').trim();
  }

  // --- EVENT ATTACHMENT HELPERS ---
  private attachRemoveCustomUrlListeners(): void {
    const customUrlsList = document.getElementById('customUrlsList');
    if (!customUrlsList) return;
    customUrlsList.querySelectorAll('button[data-remove-index]').forEach(btn => {
      btn.removeEventListener('click', this._removeCustomUrlHandler);
      btn.addEventListener('click', this._removeCustomUrlHandler);
    });
  }
  private _removeCustomUrlHandler = (e: Event) => {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLButtonElement;
    const index = btn.getAttribute('data-remove-index');
    if (index !== null) {
      this.removeCustomUrl(Number(index));
    }
  };

  // --- RENDERING ---
  private renderDetailedResults(): void {
    const detailsContainer = document.getElementById('resultsDetails');
    if (!detailsContainer) return;
    if (!this.pageAuditData || this.pageAuditData.length === 0) {
      detailsContainer.innerHTML = '<div class="alert alert-info">No results to display.</div>';
      return;
    }
    detailsContainer.innerHTML = `
      <div class="row">
        ${this.pageAuditData.map((pageData, index) => `
          <div class="col-md-6 col-lg-4 mb-4">
            ${this.renderPageCard(pageData, index)}
          </div>
        `).join('')}
      </div>
    `;
    this.attachViewDetailsListeners();
  }

  private renderPageCard(pageData: PageAuditData, index: number): string {
    const hasViolations = pageData.summary.totalViolations > 0;
    const cardBorder = hasViolations ? 'border-danger' : 'border-success';
    const cardHeaderClass = hasViolations ? 'bg-danger text-white' : 'bg-success text-white';
    return `
      <div id="page-card-${index}" class="card ${cardBorder} h-100 shadow-sm" data-page-index="${index}" style="cursor:pointer;">
        <div class="card-header ${cardHeaderClass} d-flex flex-column flex-md-row justify-content-between align-items-md-center">
          <div class="fw-bold">${pageData.title}</div>
          <div class="small">${new Date(pageData.timestamp).toLocaleString()}</div>
        </div>
        <div class="card-body">
          <div class="mb-2"><a href="${pageData.url}" target="_blank" class="text-decoration-none">${pageData.url}</a></div>
          <div class="mb-2">
            <span class="badge bg-danger me-1">${pageData.summary.errors} Errors</span>
            <span class="badge bg-warning me-1">${pageData.summary.warnings} Warnings</span>
            <span class="badge bg-info">${pageData.summary.hints} Hints</span>
          </div>
          <div class="mb-2">
            <span class="badge bg-dark">${pageData.summary.totalViolations} Total Violations</span>
          </div>
          ${hasViolations ? `
            <div class="mb-2">
              <strong>Issues by Category:</strong>
              <div class="d-flex flex-wrap mt-1">
                ${pageData.categories.map(category => `
                  <span class="badge bg-secondary me-2 mb-1">
                    ${this.formatCategoryName(category.category)}: ${category.count}
                  </span>
                `).join('')}
              </div>
            </div>
          ` : `
            <div class="alert alert-success p-2 mb-0">✅ No accessibility violations found on this page.</div>
          `}
        </div>
        <div class="card-footer bg-white border-top-0 d-flex justify-content-end">
          <button class="btn btn-outline-primary btn-sm view-details-btn" data-page-index="${index}">
            View Details
          </button>
        </div>
      </div>
    `;
  }

  // After rendering all page cards, attach event listeners for View Details
  private attachViewDetailsListeners(): void {
    document.querySelectorAll('.view-details-btn').forEach(btn => {
      btn.removeEventListener('click', this._viewDetailsHandler);
      btn.addEventListener('click', this._viewDetailsHandler);
    });
  }
  private _viewDetailsHandler = (e: Event) => {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLButtonElement;
    const index = btn.getAttribute('data-page-index');
    if (index !== null) {
      this.showPageDetails(Number(index));
    }
  };
}

// Global function for modal close
declare global {
  function closeErrorModal(): void;
}

window.closeErrorModal = function() {
  window.app.closeErrorModal();
}; 