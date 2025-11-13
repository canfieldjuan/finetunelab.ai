/**
 * Export Utilities for Search Results
 * 
 * Provides functions to export search results in various formats:
 * - CSV (for spreadsheets)
 * - JSON (for programmatic use)
 * - Markdown (for documentation)
 * - Citations (APA, MLA, Chicago)
 * - HTML (for reports/printing)
 * 
 * @module export
 */

import { WebSearchDocument } from '../tools/web-search/types';
import { SearchFilters } from './search-filters';

export interface ExportOptions {
  includeMetadata?: boolean;
  includeFilters?: boolean;
  fields?: string[];
  citationStyle?: 'apa' | 'mla' | 'chicago';
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSV(value: string | undefined | null): string {
  if (value === undefined || value === null) return '';
  
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export search results to CSV format
 * 
 * @param results - Results to export
 * @param options - Export options
 * @returns CSV string
 * 
 * @example
 * ```ts
 * const csv = exportToCSV(results, { includeMetadata: true });
 * downloadFile(csv, 'search-results.csv', 'text/csv');
 * ```
 */
export function exportToCSV(
  results: WebSearchDocument[],
  options: ExportOptions = {}
): string {
  const {
    includeMetadata = true,
    fields = ['title', 'url', 'snippet', 'source', 'publishedAt', 'confidenceScore']
  } = options;

  // Build header row
  const headers = fields.map(field => {
    const headerNames: Record<string, string> = {
      title: 'Title',
      url: 'URL',
      snippet: 'Snippet',
      source: 'Source',
      publishedAt: 'Published Date',
      confidenceScore: 'Confidence Score',
      summary: 'Summary',
      fullContent: 'Full Content',
      imageUrl: 'Image URL'
    };
    return headerNames[field] || field;
  });

  const rows: string[] = [headers.join(',')];

  // Add data rows
  results.forEach(result => {
    const row = fields.map(field => {
      let value: string | number | undefined | null;
      
      switch (field) {
        case 'title':
          value = result.title;
          break;
        case 'url':
          value = result.url;
          break;
        case 'snippet':
          value = result.snippet;
          break;
        case 'source':
          value = result.source;
          break;
        case 'publishedAt':
          value = result.publishedAt;
          break;
        case 'confidenceScore':
          value = result.confidenceScore;
          break;
        case 'summary':
          value = result.summary;
          break;
        case 'fullContent':
          value = result.fullContent;
          break;
        case 'imageUrl':
          value = result.imageUrl;
          break;
        default:
          value = undefined;
      }
      
      if (field === 'confidenceScore' && typeof value === 'number') {
        return (value * 100).toFixed(1) + '%';
      }
      
      if (field === 'publishedAt' && value) {
        return new Date(value as string).toLocaleDateString();
      }
      
      return escapeCSV(value as string | undefined | null);
    });
    
    rows.push(row.join(','));
  });

  // Add metadata footer if requested
  if (includeMetadata) {
    rows.push('');
    rows.push(`"Exported on:",${escapeCSV(new Date().toLocaleString())}`);
    rows.push(`"Total Results:",${results.length}`);
  }

  return rows.join('\n');
}

/**
 * Export search results to JSON format
 * 
 * @param results - Results to export
 * @param options - Export options
 * @returns JSON string (formatted)
 */
export function exportToJSON(
  results: WebSearchDocument[],
  options: ExportOptions = {}
): string {
  const {
    includeMetadata = true
  } = options;

  interface ExportData {
    results: Partial<WebSearchDocument>[];
    metadata?: {
      exportedAt: string;
      totalResults: number;
      averageConfidence: number;
    };
  }

  const data: ExportData = {
    results: results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      source: r.source,
      publishedAt: r.publishedAt,
      confidenceScore: r.confidenceScore,
      summary: r.summary,
      fullContent: r.fullContent,
      imageUrl: r.imageUrl
    }))
  };

  if (includeMetadata) {
    data.metadata = {
      exportedAt: new Date().toISOString(),
      totalResults: results.length,
      averageConfidence: results.reduce((sum, r) => sum + (r.confidenceScore || 0), 0) / results.length
    };
  }

  return JSON.stringify(data, null, 2);
}

/**
 * Export search results to Markdown format
 * 
 * @param results - Results to export
 * @param options - Export options
 * @returns Markdown string
 */
export function exportToMarkdown(
  results: WebSearchDocument[],
  options: ExportOptions = {}
): string {
  const { includeMetadata = true } = options;

  const lines: string[] = [];

  // Title
  lines.push('# Search Results\n');

  if (includeMetadata) {
    lines.push(`*Exported: ${new Date().toLocaleDateString()}*`);
    lines.push(`*Total Results: ${results.length}*\n`);
    lines.push('---\n');
  }

  // Results
  results.forEach((result, index) => {
    lines.push(`## ${index + 1}. ${result.title}\n`);
    
    // Metadata line
    const meta: string[] = [];
    if (result.source) meta.push(`**Source:** ${result.source}`);
    if (result.publishedAt) {
      meta.push(`**Date:** ${new Date(result.publishedAt).toLocaleDateString()}`);
    }
    if (result.confidenceScore !== undefined) {
      const conf = (result.confidenceScore * 100).toFixed(0);
      meta.push(`**Confidence:** ${conf}%`);
    }
    if (meta.length > 0) {
      lines.push(meta.join(' | ') + '\n');
    }

    // URL
    lines.push(`**URL:** ${result.url}\n`);

    // Snippet or summary
    if (result.summary) {
      lines.push(`**Summary:** ${result.summary}\n`);
    } else if (result.snippet) {
      lines.push(`**Snippet:** ${result.snippet}\n`);
    }

    lines.push('---\n');
  });

  return lines.join('\n');
}

/**
 * Format citation in APA style
 */
function formatAPACitation(result: WebSearchDocument): string {
  const author = result.source || 'Unknown';
  const year = result.publishedAt ? new Date(result.publishedAt).getFullYear() : 'n.d.';
  const title = result.title;
  const url = result.url;
  const retrieved = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `${author}. (${year}). ${title}. Retrieved ${retrieved}, from ${url}`;
}

/**
 * Format citation in MLA style
 */
function formatMLACitation(result: WebSearchDocument): string {
  const author = result.source || 'Unknown';
  const title = `"${result.title}"`;
  const website = result.source || new URL(result.url).hostname;
  const date = result.publishedAt 
    ? new Date(result.publishedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'n.d.';
  const url = result.url;

  return `${author}. ${title} ${website}, ${date}, ${url}.`;
}

/**
 * Format citation in Chicago style
 */
function formatChicagoCitation(result: WebSearchDocument): string {
  const author = result.source || 'Unknown';
  const title = `"${result.title}"`;
  const website = result.source || new URL(result.url).hostname;
  const date = result.publishedAt 
    ? new Date(result.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'n.d.';
  const url = result.url;

  return `${author}. ${title} ${website}. ${date}. ${url}.`;
}

/**
 * Export citations in selected style
 * 
 * @param results - Results to cite
 * @param style - Citation style
 * @returns Formatted bibliography
 */
export function exportCitations(
  results: WebSearchDocument[],
  style: 'apa' | 'mla' | 'chicago' = 'apa'
): string {
  const lines: string[] = [];

  lines.push(`# Bibliography (${style.toUpperCase()})\n`);
  lines.push(`*Generated: ${new Date().toLocaleDateString()}*\n`);
  lines.push('---\n');

  const formatter = {
    apa: formatAPACitation,
    mla: formatMLACitation,
    chicago: formatChicagoCitation
  }[style];

  results.forEach((result, index) => {
    const citation = formatter(result);
    lines.push(`${index + 1}. ${citation}\n`);
  });

  return lines.join('\n');
}

/**
 * Export to HTML report format
 * 
 * @param results - Results to export
 * @param filters - Filter configuration (optional)
 * @param options - Export options
 * @returns HTML string
 */
export function exportToHTML(
  results: WebSearchDocument[],
  filters?: SearchFilters,
  options: ExportOptions = {}
): string {
  const { includeMetadata = true, includeFilters = false } = options;

  const html: string[] = [];

  // HTML header
  html.push('<!DOCTYPE html>');
  html.push('<html lang="en">');
  html.push('<head>');
  html.push('  <meta charset="UTF-8">');
  html.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  html.push('  <title>Search Results Report</title>');
  html.push('  <style>');
  html.push('    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }');
  html.push('    h1 { color: #1a202c; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }');
  html.push('    .result { margin: 30px 0; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; }');
  html.push('    .result h2 { margin-top: 0; color: #2d3748; }');
  html.push('    .meta { color: #718096; font-size: 0.9em; margin: 10px 0; }');
  html.push('    .confidence { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600; }');
  html.push('    .confidence.high { background: #c6f6d5; color: #22543d; }');
  html.push('    .confidence.medium { background: #fef3c7; color: #78350f; }');
  html.push('    .confidence.low { background: #fed7d7; color: #742a2a; }');
  html.push('    .url { word-break: break-all; color: #3182ce; }');
  html.push('    .summary { margin: 15px 0; line-height: 1.6; }');
  html.push('    .metadata { background: #f7fafc; padding: 15px; border-radius: 8px; margin: 20px 0; }');
  html.push('    @media print { .result { page-break-inside: avoid; } }');
  html.push('  </style>');
  html.push('</head>');
  html.push('<body>');

  // Title
  html.push('  <h1>Search Results Report</h1>');

  // Metadata
  if (includeMetadata) {
    html.push('  <div class="metadata">');
    html.push(`    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>`);
    html.push(`    <p><strong>Total Results:</strong> ${results.length}</p>`);
    const avgConf = results.reduce((sum, r) => sum + (r.confidenceScore || 0), 0) / results.length;
    html.push(`    <p><strong>Average Confidence:</strong> ${(avgConf * 100).toFixed(1)}%</p>`);
    html.push('  </div>');
  }

  // Filter info
  if (includeFilters && filters) {
    html.push('  <div class="metadata">');
    html.push('    <p><strong>Filters Applied:</strong></p>');
    html.push('    <ul>');
    html.push(`      <li>Confidence: ${(filters.confidence.min * 100).toFixed(0)}% - ${(filters.confidence.max * 100).toFixed(0)}%</li>`);
    if (filters.dateRange.start || filters.dateRange.end) {
      html.push(`      <li>Date Range: ${filters.dateRange.start?.toLocaleDateString() || 'Any'} to ${filters.dateRange.end?.toLocaleDateString() || 'Present'}</li>`);
    }
    html.push('    </ul>');
    html.push('  </div>');
  }

  // Results
  results.forEach((result, index) => {
    html.push('  <div class="result">');
    html.push(`    <h2>${index + 1}. ${result.title}</h2>`);
    
    // Meta line
    html.push('    <div class="meta">');
    if (result.source) {
      html.push(`      <strong>Source:</strong> ${result.source} | `);
    }
    if (result.publishedAt) {
      html.push(`      <strong>Published:</strong> ${new Date(result.publishedAt).toLocaleDateString()} | `);
    }
    if (result.confidenceScore !== undefined) {
      const conf = result.confidenceScore;
      const level = conf >= 0.8 ? 'high' : conf >= 0.5 ? 'medium' : 'low';
      html.push(`      <span class="confidence ${level}">${(conf * 100).toFixed(0)}% Confidence</span>`);
    }
    html.push('    </div>');

    // URL
    html.push(`    <p class="url"><strong>URL:</strong> <a href="${result.url}" target="_blank">${result.url}</a></p>`);

    // Summary or snippet
    if (result.summary) {
      html.push(`    <div class="summary">${result.summary}</div>`);
    } else if (result.snippet) {
      html.push(`    <div class="summary">${result.snippet}</div>`);
    }

    html.push('  </div>');
  });

  // Footer
  html.push('  <hr style="margin-top: 40px;">');
  html.push(`  <p style="text-align: center; color: #a0aec0; font-size: 0.9em;">Generated on ${new Date().toLocaleString()}</p>`);
  html.push('</body>');
  html.push('</html>');

  return html.join('\n');
}

/**
 * Download content as file
 * 
 * @param content - File content
 * @param filename - Name for downloaded file
 * @param mimeType - MIME type
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy content to clipboard
 * 
 * @param content - Content to copy
 * @returns Promise that resolves to success boolean
 */
export async function copyToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
