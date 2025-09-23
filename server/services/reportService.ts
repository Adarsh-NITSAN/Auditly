import { AuditResult, AuditSummary, CategorySummary, TopIssue } from '../types/index.js';

export class ReportService {
  private categories: Record<string, string>;

  constructor() {
    this.categories = {
      'forms': 'Forms & Inputs',
      'navigation': 'Navigation',
      'images': 'Images & Media',
      'text': 'Text & Typography',
      'structure': 'Page Structure',
      'interactive': 'Interactive Elements',
      'other': 'Other'
    };
  }

  generateSummary(results: AuditResult[]): AuditSummary {
    const summary: AuditSummary = {
      totalPages: results.length,
      pagesWithIssues: 0,
      totalIssues: 0,
      errors: 0,
      warnings: 0,
      hints: 0,
      categories: {},
      topIssues: [],
      timestamp: new Date().toISOString(),
    };

    const allIssues: Array<any> = [];
    const categoryCounts: Record<string, number> = {};

    results.forEach(result => {
      if (result.error) {
        // Skip pages with errors
        return;
      }

      const pageSummary = result.summary;
      
      if (pageSummary.totalIssues > 0) {
        summary.pagesWithIssues++;
      }

      summary.totalIssues += pageSummary.totalIssues;
      summary.errors += pageSummary.errors;
      summary.warnings += pageSummary.warnings;
      summary.hints += pageSummary.hints;

      // Collect all issues for analysis - STRICT VALIDATION: only violations
      if (result.issues) {
        Object.values(result.issues).flat().forEach(issue => {
          // Additional validation to ensure only violations are included
          if (this.isViolationIssue(issue)) {
            allIssues.push({
              ...issue,
              pageUrl: result.url,
              pageTitle: this.extractPageTitle(result.url),
            });

            // Count by category - only violations
            const category = issue.category || 'other';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
          }
        });
      }
    });

    // Generate category summary
    summary.categories = this.generateCategorySummary(categoryCounts);

    // Generate top issues
    summary.topIssues = this.generateTopIssues(allIssues);

    return summary;
  }

  private isViolationIssue(issue: any): boolean {
    // Check if the issue is actually a violation (not passed, incomplete, inapplicable)
    if (!issue) return false;
    
    // Check for excluded statuses/types - INCLUDE needs review as valid issues
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

  private generateCategorySummary(categoryCounts: Record<string, number>): Record<string, CategorySummary> {
    const summary: Record<string, CategorySummary> = {};
    
    Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        summary[category] = {
          name: this.categories[category] || this.capitalizeFirst(category),
          count: count,
          percentage: 0, // Will be calculated later
        };
      });

    const total = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
    
    Object.values(summary).forEach(category => {
      category.percentage = total > 0 ? Math.round((category.count / total) * 100) : 0;
    });

    return summary;
  }

  private generateTopIssues(allIssues: Array<any>): TopIssue[] {
    const issueCounts: Record<string, any> = {};
    
    allIssues.forEach(issue => {
      const key = `${issue.id}-${issue.level}`;
      if (!issueCounts[key]) {
        issueCounts[key] = {
          id: issue.id,
          title: issue.title,
          level: issue.level,
          category: issue.category,
          count: 0,
          pages: new Set<string>(),
          impact: issue.impact,
        };
      }
      issueCounts[key].count++;
      issueCounts[key].pages.add(issue.pageUrl);
    });

    return Object.values(issueCounts)
      .map(issue => ({
        ...issue,
        pages: Array.from(issue.pages),
        pageCount: issue.pages.size,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  async generateDetailedReport(results: AuditResult[], format: 'json' | 'csv' = 'json'): Promise<any> {
    const summary = this.generateSummary(results);
    
    if (format === 'csv') {
      return this.generateCsvReport(results, summary);
    } else {
      return this.generateJsonReport(results, summary);
    }
  }

  private generateJsonReport(results: AuditResult[], summary: AuditSummary): any {
    const detailedResults = results.map(result => {
      if (result.error) {
        return {
          url: result.url,
          error: result.error,
          timestamp: result.timestamp,
        };
      }

      return {
        url: result.url,
        timestamp: result.timestamp,
        summary: result.summary,
        issues: this.flattenIssues(result.issues, result.url),
      };
    });

    return {
      report: {
        summary,
        results: detailedResults,
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  }

  private generateCsvReport(results: AuditResult[], _summary: AuditSummary): string {
    const csvRows: string[] = [];
    
    // Header - Clean data with severity breakdown
    csvRows.push([
      'Page URL',
      'Critical Issues',
      'Serious Issues', 
      'Moderate Issues',
      'Total Score'
    ].join(','));

    // Data rows - One row per page with clean data
    results.forEach(result => {
      if (result.error) {
        // For pages with errors, show error status
        csvRows.push([
          this.escapeCsvField(result.url),
          'ERROR',
          'ERROR',
          'ERROR',
          '0'
        ].join(','));
        return;
      }

      // Calculate severity counts by impact level
      const severityCounts = this.calculatePageSeverityCounts(result);
      const totalIssues = severityCounts.critical + severityCounts.serious + severityCounts.moderate;
      
      // Calculate total score (100 - total issues, minimum 0)
      const totalScore = Math.max(0, 100 - totalIssues);

      csvRows.push([
        this.escapeCsvField(result.url),
        severityCounts.critical.toString(),
        severityCounts.serious.toString(),
        severityCounts.moderate.toString(),
        totalScore.toString()
      ].join(','));
    });

    return csvRows.join('\n');
  }

  private calculatePageSeverityCounts(result: AuditResult): { critical: number; serious: number; moderate: number } {
    let critical = 0;
    let serious = 0;
    let moderate = 0;

    if (!result.issues) {
      return { critical, serious, moderate };
    }

    // Count issues by their actual impact levels
    Object.values(result.issues).flat().forEach(issue => {
      const impact = (issue.impact || 'serious').toLowerCase();
      if (impact === 'critical') {
        critical++;
      } else if (impact === 'serious') {
        serious++;
      } else if (impact === 'moderate') {
        moderate++;
      } else {
        // Default mapping based on issue level
        if (issue.level === 'error') {
          serious++; // Default errors to serious
        } else if (issue.level === 'warning') {
          moderate++; // Default warnings to moderate
        } else {
          moderate++; // Default hints to moderate
        }
      }
    });

    return { critical, serious, moderate };
  }

  private flattenIssues(issues: any, pageUrl: string): any[] {
    const flattened: any[] = [];
    
    Object.entries(issues).forEach(([level, levelIssues]) => {
      (levelIssues as any[]).forEach(issue => {
        flattened.push({
          ...issue,
          pageUrl,
          level,
        });
      });
    });

    return flattened;
  }

  private escapeCsvField(field: any): string {
    if (!field) return '';
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
  }

  private extractPageTitle(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.split('/').pop() || urlObj.hostname;
    } catch {
      return url;
    }
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  compareAudits(audit1: any, audit2: any): any {
    const comparison = {
      audit1: {
        id: audit1.id,
        timestamp: audit1.timestamp,
        summary: audit1.summary
      },
      audit2: {
        id: audit2.id,
        timestamp: audit2.timestamp,
        summary: audit2.summary
      },
      changes: {
        totalIssues: audit2.summary.totalIssues - audit1.summary.totalIssues,
        errors: audit2.summary.errors - audit1.summary.errors,
        warnings: audit2.summary.warnings - audit1.summary.warnings,
        hints: audit2.summary.hints - audit1.summary.hints,
        pagesWithIssues: audit2.summary.pagesWithIssues - audit1.summary.pagesWithIssues
      },
      improvement: {
        totalIssues: audit2.summary.totalIssues < audit1.summary.totalIssues,
        errors: audit2.summary.errors < audit1.summary.errors,
        warnings: audit2.summary.warnings < audit1.summary.warnings,
        hints: audit2.summary.hints < audit1.summary.hints
      },
      pageComparisons: this.comparePages(audit1.results, audit2.results)
    };

    return comparison;
  }

  private comparePages(pages1: any[], pages2: any[]): any[] {
    const comparisons = [];
    const pageMap1 = new Map(pages1.map(p => [p.url, p]));
    const pageMap2 = new Map(pages2.map(p => [p.url, p]));

    // Compare pages that exist in both audits
    for (const [url, page1] of pageMap1) {
      const page2 = pageMap2.get(url);
      if (page2) {
        comparisons.push({
          url,
          page1: {
            errors: page1.summary?.errors || 0,
            warnings: page1.summary?.warnings || 0,
            hints: page1.summary?.hints || 0,
            totalIssues: page1.summary?.totalIssues || 0
          },
          page2: {
            errors: page2.summary?.errors || 0,
            warnings: page2.summary?.warnings || 0,
            hints: page2.summary?.hints || 0,
            totalIssues: page2.summary?.totalIssues || 0
          },
          changes: {
            errors: (page2.summary?.errors || 0) - (page1.summary?.errors || 0),
            warnings: (page2.summary?.warnings || 0) - (page1.summary?.warnings || 0),
            hints: (page2.summary?.hints || 0) - (page1.summary?.hints || 0),
            totalIssues: (page2.summary?.totalIssues || 0) - (page1.summary?.totalIssues || 0)
          }
        });
      }
    }

    return comparisons;
  }

  // Generate a simple HTML report
  generateHtmlReport(results: AuditResult[], summary: AuditSummary): string {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Audit Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .summary-item { background: white; padding: 15px; border-radius: 5px; text-align: center; }
        .summary-number { font-size: 2em; font-weight: bold; }
        .error { color: #d32f2f; }
        .warning { color: #f57c00; }
        .hint { color: #1976d2; }
        .page-results { margin-top: 30px; }
        .page-item { border: 1px solid #ddd; margin-bottom: 15px; border-radius: 5px; }
        .page-header { background: #f9f9f9; padding: 10px; border-bottom: 1px solid #ddd; }
        .issues-list { padding: 15px; }
        .issue-item { margin-bottom: 10px; padding: 10px; border-left: 4px solid #ddd; }
        .issue-item.error { border-left-color: #d32f2f; }
        .issue-item.warning { border-left-color: #f57c00; }
        .issue-item.hint { border-left-color: #1976d2; }
    </style>
</head>
<body>
    <h1>Accessibility Audit Report</h1>
    <p>Generated on: ${new Date(summary.timestamp).toLocaleString()}</p>
    
    <div class="summary">
        <h2>Summary</h2>
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-number">${summary.totalPages}</div>
                <div>Pages Audited</div>
            </div>
            <div class="summary-item">
                <div class="summary-number">${summary.pagesWithIssues}</div>
                <div>Pages with Issues</div>
            </div>
            <div class="summary-item">
                <div class="summary-number error">${summary.errors}</div>
                <div>Errors</div>
            </div>
            <div class="summary-item">
                <div class="summary-number warning">${summary.warnings}</div>
                <div>Warnings</div>
            </div>
            <div class="summary-item">
                <div class="summary-number hint">${summary.hints}</div>
                <div>Hints</div>
            </div>
        </div>
    </div>

    <div class="page-results">
        <h2>Page Results</h2>
        ${results.map(result => this.generatePageHtml(result)).join('')}
    </div>
</body>
</html>`;

    return html;
  }

  private generatePageHtml(result: AuditResult): string {
    if (result.error) {
      return `
        <div class="page-item">
            <div class="page-header">
                <h3>${result.url}</h3>
                <span class="error">Error: ${result.error}</span>
            </div>
        </div>
      `;
    }

    const issuesHtml: string[] = [];
    
    if (result.issues) {
      Object.entries(result.issues).forEach(([level, issues]) => {
        issues.forEach(issue => {
          issuesHtml.push(`
            <div class="issue-item ${level}">
                <h4>${issue.title}</h4>
                <p><strong>Category:</strong> ${issue.category}</p>
                <p><strong>Impact:</strong> ${issue.impact}</p>
                <p><strong>Description:</strong> ${issue.description}</p>
                ${issue.help ? `<p><strong>Help:</strong> ${issue.help}</p>` : ''}
                ${issue.howToFix ? `<p><strong>How to Fix:</strong> ${issue.howToFix}</p>` : ''}
                ${issue.selector ? `<p><strong>Selector:</strong> <code>${issue.selector}</code></p>` : ''}
            </div>
          `);
        });
      });
    }

    return `
        <div class="page-item">
            <div class="page-header">
                <h3>${this.extractPageTitle(result.url)}</h3>
                <p>Issues: ${result.summary.totalIssues} (${result.summary.errors} errors, ${result.summary.warnings} warnings, ${result.summary.hints} hints)</p>
            </div>
            <div class="issues-list">
                ${issuesHtml.length > 0 ? issuesHtml.join('') : '<p>No issues found.</p>'}
            </div>
        </div>
    `;
  }
} 