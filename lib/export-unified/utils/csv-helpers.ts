/**
 * CSV Formatting Utilities
 * Phase 3: Format Generators
 *
 * Utilities for creating properly formatted CSV exports
 */

/**
 * Escape CSV value
 * Handles commas, quotes, and newlines
 */
export function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert array of objects to CSV string
 */
export function arrayToCSV(
  data: Record<string, unknown>[],
  headers: string[]
): string {
  if (data.length === 0) {
    return headers.map((h) => escapeCSVValue(h)).join(',');
  }

  const headerRow = headers.map((h) => escapeCSVValue(h)).join(',');

  const dataRows = data.map((row) => {
    return headers
      .map((header) => {
        const value = row[header];
        return escapeCSVValue(value);
      })
      .join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Add UTF-8 BOM for Excel compatibility
 */
export function addUTF8BOM(content: string): string {
  return '\uFEFF' + content;
}

/**
 * Format date for CSV
 */
export function formatDateForCSV(date: Date): string {
  return date.toISOString();
}

/**
 * Format JSON value for CSV (stringify objects/arrays)
 */
export function formatJSONForCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Create CSV from flat data with automatic header detection
 */
export function createCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) {
    return '';
  }

  // Extract headers from first object
  const headers = Object.keys(data[0]);

  return arrayToCSV(data, headers);
}

/**
 * Create multi-section CSV (multiple tables in one file)
 */
export function createMultiSectionCSV(sections: {
  title: string;
  data: Record<string, unknown>[];
  headers: string[];
}[]): string {
  const parts: string[] = [];

  sections.forEach((section, index) => {
    // Add blank line between sections (except first)
    if (index > 0) {
      parts.push('');
    }

    // Add section title as a comment
    parts.push(`# ${section.title}`);
    parts.push('');

    // Add section data
    parts.push(arrayToCSV(section.data, section.headers));
  });

  return parts.join('\n');
}
