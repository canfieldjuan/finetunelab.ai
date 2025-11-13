'use client';

import React, { useState } from 'react';
import { 
  exportToCSV,
  exportToJSON,
  exportToMarkdown,
  exportCitations,
  exportToHTML,
  downloadFile,
  copyToClipboard,
  type ExportOptions
} from '@/lib/utils/export';
import { WebSearchDocument } from '@/lib/tools/web-search/types';
import { SearchFilters } from '@/lib/utils/search-filters';
import { 
  Download, 
  FileText, 
  Code, 
  FileJson,
  Quote,
  Globe,
  Copy,
  Check
} from 'lucide-react';

interface ExportPanelProps {
  results: WebSearchDocument[];
  /**
   * Optional: Current filters to include in metadata
   */
  filters?: SearchFilters;
  /**
   * Display variant
   * @default 'full'
   */
  variant?: 'full' | 'compact';
}

type ExportFormat = 'csv' | 'json' | 'markdown' | 'citations' | 'html';
type CitationStyle = 'apa' | 'mla' | 'chicago';

/**
 * ExportPanel Component
 * 
 * Provides UI for exporting search results in multiple formats:
 * - CSV: Spreadsheet-ready format
 * - JSON: Structured data with metadata
 * - Markdown: Documentation format
 * - Citations: Bibliography (APA/MLA/Chicago)
 * - HTML: Print-ready report
 * 
 * Phase 3: Advanced Search Features
 * Uses export utilities for format conversion
 */
export function ExportPanel({ 
  results, 
  filters,
  variant = 'full'
}: ExportPanelProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('apa');
  const [copied, setCopied] = useState(false);

  const handleExport = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    
    const exportOptions: ExportOptions = {
      includeMetadata: true,
      fields: ['title', 'url', 'snippet', 'publishedAt', 'source', 'confidenceScore']
    };

    let content = '';
    let filename = '';
    let mimeType = '';

    switch (selectedFormat) {
      case 'csv':
        content = exportToCSV(results, exportOptions);
        filename = `search-results-${timestamp}.csv`;
        mimeType = 'text/csv';
        break;
      
      case 'json':
        content = exportToJSON(results, exportOptions);
        filename = `search-results-${timestamp}.json`;
        mimeType = 'application/json';
        break;
      
      case 'markdown':
        content = exportToMarkdown(results, exportOptions);
        filename = `search-results-${timestamp}.md`;
        mimeType = 'text/markdown';
        break;
      
      case 'citations':
        content = exportCitations(results, citationStyle);
        filename = `citations-${citationStyle}-${timestamp}.txt`;
        mimeType = 'text/plain';
        break;
      
      case 'html':
        content = exportToHTML(results, filters, exportOptions);
        filename = `search-report-${timestamp}.html`;
        mimeType = 'text/html';
        break;
    }

    downloadFile(content, filename, mimeType);
  };

  const handleCopy = async () => {
    const exportOptions: ExportOptions = {
      includeMetadata: false,
      fields: ['title', 'url', 'snippet', 'publishedAt', 'source', 'confidenceScore']
    };

    let content = '';

    switch (selectedFormat) {
      case 'csv':
        content = exportToCSV(results, exportOptions);
        break;
      case 'json':
        content = exportToJSON(results, exportOptions);
        break;
      case 'markdown':
        content = exportToMarkdown(results, exportOptions);
        break;
      case 'citations':
        content = exportCitations(results, citationStyle);
        break;
      case 'html':
        content = exportToHTML(results, filters, exportOptions);
        break;
    }

    const success = await copyToClipboard(content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'csv': return <FileText className="w-4 h-4" />;
      case 'json': return <FileJson className="w-4 h-4" />;
      case 'markdown': return <Code className="w-4 h-4" />;
      case 'citations': return <Quote className="w-4 h-4" />;
      case 'html': return <Globe className="w-4 h-4" />;
    }
  };

  const getFormatDescription = (format: ExportFormat) => {
    switch (format) {
      case 'csv': return 'Spreadsheet format (Excel, Sheets)';
      case 'json': return 'Structured data with metadata';
      case 'markdown': return 'Documentation format';
      case 'citations': return 'Bibliography references';
      case 'html': return 'Print-ready report';
    }
  };

  if (variant === 'compact') {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between gap-4">
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="markdown">Markdown</option>
            <option value="citations">Citations</option>
            <option value="html">HTML</option>
          </select>

          {selectedFormat === 'citations' && (
            <select
              value={citationStyle}
              onChange={(e) => setCitationStyle(e.target.value as CitationStyle)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="apa">APA</option>
              <option value="mla">MLA</option>
              <option value="chicago">Chicago</option>
            </select>
          )}

          <button
            onClick={handleExport}
            disabled={results.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Export Results
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Export {results.length} result{results.length !== 1 ? 's' : ''} in your preferred format
        </p>
      </div>

      {/* Format Selection */}
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Export Format
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(['csv', 'json', 'markdown', 'citations', 'html'] as ExportFormat[]).map((format) => (
              <button
                key={format}
                onClick={() => setSelectedFormat(format)}
                className={`
                  p-3 rounded-lg border-2 transition-all text-left
                  ${selectedFormat === format 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 ${selectedFormat === format ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {getFormatIcon(format)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium uppercase ${selectedFormat === format ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      {format}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {getFormatDescription(format)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Citation Style (only for citations format) */}
        {selectedFormat === 'citations' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Citation Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['apa', 'mla', 'chicago'] as CitationStyle[]).map((style) => (
                <button
                  key={style}
                  onClick={() => setCitationStyle(style)}
                  className={`
                    px-4 py-2 rounded-md border transition-colors text-sm font-medium uppercase
                    ${citationStyle === style
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                    }
                  `}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Format Details */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400">
          {selectedFormat === 'csv' && (
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">CSV Export Details:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Opens in Excel, Google Sheets, or any spreadsheet app</li>
                <li>Includes: title, URL, snippet, date, source, confidence</li>
                <li>Properly escaped for special characters</li>
              </ul>
            </div>
          )}
          {selectedFormat === 'json' && (
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">JSON Export Details:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Structured data format for developers</li>
                <li>Includes metadata: export date, total results, avg confidence</li>
                <li>Pretty-printed and ready to use in code</li>
              </ul>
            </div>
          )}
          {selectedFormat === 'markdown' && (
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Markdown Export Details:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Human-readable documentation format</li>
                <li>Each result numbered with metadata</li>
                <li>Compatible with GitHub, Notion, and docs platforms</li>
              </ul>
            </div>
          )}
          {selectedFormat === 'citations' && (
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Citations Export Details:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Bibliography format for research papers</li>
                <li>Formatted according to {citationStyle.toUpperCase()} style</li>
                <li>Ready to paste into your reference list</li>
              </ul>
            </div>
          )}
          {selectedFormat === 'html' && (
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">HTML Export Details:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Print-ready report with embedded styling</li>
                <li>Color-coded confidence badges</li>
                <li>Includes filter information and metadata</li>
              </ul>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleExport}
            disabled={results.length === 0}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download {selectedFormat.toUpperCase()}
            {selectedFormat === 'citations' && ` (${citationStyle.toUpperCase()})`}
          </button>
          
          <button
            onClick={handleCopy}
            disabled={results.length === 0}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 rounded-md font-medium transition-colors flex items-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
        </div>

        {results.length === 0 && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
            No results to export. Try adjusting your filters.
          </div>
        )}
      </div>
    </div>
  );
}
