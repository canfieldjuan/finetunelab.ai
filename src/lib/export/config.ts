/**
 * Export System - Configuration
 *
 * Environment-based configuration for the export and archive system.
 * All values can be overridden via environment variables.
 *
 * @module lib/export/config
 */

/**
 * Export system configuration
 */
export const exportConfig = {
  /**
   * Directory where exports are temporarily stored
   * Can be overridden with EXPORT_STORAGE_PATH env var
   */
  storagePath: process.env.EXPORT_STORAGE_PATH || '/tmp/exports',

  /**
   * Maximum export file size in MB
   * Can be overridden with EXPORT_MAX_SIZE_MB env var
   */
  maxSizeMB: parseInt(process.env.EXPORT_MAX_SIZE_MB || '50', 10),

  /**
   * How long exports are kept before automatic cleanup (in hours)
   * Can be overridden with EXPORT_EXPIRATION_HOURS env var
   */
  expirationHours: parseInt(process.env.EXPORT_EXPIRATION_HOURS || '24', 10),

  /**
   * Whether automatic cleanup of expired exports is enabled
   * Can be overridden with EXPORT_CLEANUP_ENABLED env var
   */
  cleanupEnabled: process.env.EXPORT_CLEANUP_ENABLED !== 'false',

  /**
   * Maximum number of conversations in a single export
   * Can be overridden with EXPORT_MAX_CONVERSATIONS env var
   */
  maxConversations: parseInt(process.env.EXPORT_MAX_CONVERSATIONS || '100', 10),

  /**
   * Maximum number of messages per conversation to export
   * Can be overridden with EXPORT_MAX_MESSAGES_PER_CONVERSATION env var
   */
  maxMessagesPerConversation: parseInt(
    process.env.EXPORT_MAX_MESSAGES_PER_CONVERSATION || '10000',
    10
  ),

  /**
   * Whether to include metadata by default
   * Can be overridden with EXPORT_INCLUDE_METADATA_DEFAULT env var
   */
  includeMetadataDefault: process.env.EXPORT_INCLUDE_METADATA_DEFAULT !== 'false',

  /**
   * Whether to include system messages by default
   * Can be overridden with EXPORT_INCLUDE_SYSTEM_MESSAGES_DEFAULT env var
   */
  includeSystemMessagesDefault:
    process.env.EXPORT_INCLUDE_SYSTEM_MESSAGES_DEFAULT === 'true',

  /**
   * Default theme for styled exports (PDF, HTML)
   * Can be overridden with EXPORT_DEFAULT_THEME env var
   */
  defaultTheme: (process.env.EXPORT_DEFAULT_THEME || 'light') as 'light' | 'dark',

  /**
   * PDF generation options
   */
  pdf: {
    /**
     * Page size for PDF exports
     * Can be overridden with EXPORT_PDF_PAGE_SIZE env var
     */
    pageSize: process.env.EXPORT_PDF_PAGE_SIZE || 'A4',

    /**
     * Font family for PDF exports
     * Can be overridden with EXPORT_PDF_FONT env var
     */
    font: process.env.EXPORT_PDF_FONT || 'Helvetica',

    /**
     * Font size for PDF body text
     * Can be overridden with EXPORT_PDF_FONT_SIZE env var
     */
    fontSize: parseInt(process.env.EXPORT_PDF_FONT_SIZE || '11', 10),

    /**
     * Whether to add page numbers
     * Can be overridden with EXPORT_PDF_PAGE_NUMBERS env var
     */
    pageNumbers: process.env.EXPORT_PDF_PAGE_NUMBERS !== 'false',

    /**
     * Margins (in points)
     */
    margins: {
      top: 72,
      bottom: 72,
      left: 72,
      right: 72,
    },
  },

  /**
   * HTML export options
   */
  html: {
    /**
     * Whether to inline CSS styles
     * Can be overridden with EXPORT_HTML_INLINE_CSS env var
     */
    inlineCSS: process.env.EXPORT_HTML_INLINE_CSS !== 'false',

    /**
     * Whether to add syntax highlighting for code blocks
     * Can be overridden with EXPORT_HTML_SYNTAX_HIGHLIGHT env var
     */
    syntaxHighlight: process.env.EXPORT_HTML_SYNTAX_HIGHLIGHT !== 'false',
  },

  /**
   * Markdown export options
   */
  markdown: {
    /**
     * Whether to add front matter (YAML metadata at top)
     * Can be overridden with EXPORT_MD_FRONTMATTER env var
     */
    frontMatter: process.env.EXPORT_MD_FRONTMATTER !== 'false',

    /**
     * Whether to add table of contents
     * Can be overridden with EXPORT_MD_TOC env var
     */
    tableOfContents: process.env.EXPORT_MD_TOC === 'true',
  },
} as const;

/**
 * Archive configuration
 */
export const archiveConfig = {
  /**
   * Whether to auto-archive old conversations
   * Can be overridden with ARCHIVE_AUTO_ENABLED env var
   */
  autoArchiveEnabled: process.env.ARCHIVE_AUTO_ENABLED === 'true',

  /**
   * Age in days after which conversations are auto-archived
   * Can be overridden with ARCHIVE_AUTO_DAYS env var
   */
  autoArchiveDays: parseInt(process.env.ARCHIVE_AUTO_DAYS || '90', 10),

  /**
   * Whether to permanently delete archived conversations after a period
   * Can be overridden with ARCHIVE_PERMANENT_DELETE_ENABLED env var
   */
  permanentDeleteEnabled:
    process.env.ARCHIVE_PERMANENT_DELETE_ENABLED === 'true',

  /**
   * Days to keep archived conversations before permanent deletion
   * Can be overridden with ARCHIVE_PERMANENT_DELETE_DAYS env var
   */
  permanentDeleteDays: parseInt(
    process.env.ARCHIVE_PERMANENT_DELETE_DAYS || '365',
    10
  ),
} as const;

/**
 * Get calculated expiration date for a new export
 * @returns Date when export should expire
 */
export function getExpirationDate(): Date {
  const now = new Date();
  const expirationMs = exportConfig.expirationHours * 60 * 60 * 1000;
  return new Date(now.getTime() + expirationMs);
}

/**
 * Validate export options against configuration limits
 * @param conversationCount - Number of conversations to export
 * @throws Error if validation fails
 */
export function validateExportLimits(conversationCount: number): void {
  if (conversationCount > exportConfig.maxConversations) {
    throw new Error(
      `Export limit exceeded: Cannot export more than ${exportConfig.maxConversations} conversations at once`
    );
  }

  if (conversationCount === 0) {
    throw new Error('Export must include at least one conversation');
  }
}

/**
 * Get file path for an export
 * @param userId - User ID
 * @param exportId - Export ID
 * @param format - Export format
 * @returns Full file path
 */
export function getExportFilePath(
  userId: string,
  exportId: string,
  format: string
): string {
  const extension = getFileExtension(format);
  const fileName = `export_${userId}_${exportId}.${extension}`;
  return `${exportConfig.storagePath}/${fileName}`;
}

/**
 * Get file extension for a format
 * @param format - Export format
 * @returns File extension (without dot)
 */
export function getFileExtension(format: string): string {
  const extensions: Record<string, string> = {
    pdf: 'pdf',
    markdown: 'md',
    json: 'json',
    txt: 'txt',
    html: 'html',
  };

  return extensions[format] || 'txt';
}

/**
 * Get MIME type for a format
 * @param format - Export format
 * @returns MIME type string
 */
export function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    markdown: 'text/markdown',
    json: 'application/json',
    txt: 'text/plain',
    html: 'text/html',
  };

  return mimeTypes[format] || 'application/octet-stream';
}
