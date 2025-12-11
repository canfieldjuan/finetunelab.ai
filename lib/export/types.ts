/**
 * Export System - Type Definitions
 *
 * Defines all interfaces and types for the conversation export and archive system.
 *
 * @module lib/export/types
 */

/**
 * Supported export formats
 */
export type ExportFormat = 'pdf' | 'markdown' | 'json' | 'txt' | 'html' | 'jsonl';

/**
 * JSONL export sub-format for LLM training
 */
export type JsonlSubFormat = 'openai' | 'anthropic' | 'full';

/**
 * Options for exporting conversations
 */
export interface ExportOptions {
  /** Export format to use */
  format: ExportFormat;

  /** IDs of conversations to export */
  conversationIds: string[];

  /** Include message metadata (timestamps, IDs, etc.) */
  includeMetadata?: boolean;

  /** Include system messages in export */
  includeSystemMessages?: boolean;

  /** Only export messages within this date range */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /** Theme to use for styled formats (PDF, HTML) */
  theme?: 'light' | 'dark';

  /** Custom title for the export */
  title?: string;

  /** Filter by widget session type */
  widgetSessionFilter?: 'all' | 'widget' | 'normal';
}

/**
 * Extended export options for JSONL
 */
export interface JsonlExportOptions extends ExportOptions {
  /** Sub-format for JSONL export */
  jsonlFormat?: JsonlSubFormat;

  /** Include Phase 7 metrics */
  includeMetrics?: boolean;

  /** Include human evaluations */
  includeEvaluations?: boolean;
}

/**
 * Result of an export operation
 */
export interface ExportResult {
  /** Unique ID of the export */
  id: string;

  /** File path where export was saved */
  filePath: string;

  /** Size of exported file in bytes */
  fileSize: number;

  /** URL to download the export */
  downloadUrl: string;

  /** When the export file will expire and be deleted */
  expiresAt?: Date;

  /** Format of the export */
  format: ExportFormat;

  /** Number of conversations included */
  conversationCount: number;

  /** Total number of messages exported */
  messageCount: number;
}

/**
 * A conversation with its messages for export
 */
export interface ConversationData {
  /** Conversation ID */
  id: string;

  /** Conversation title */
  title: string;

  /** When conversation was created */
  created_at: Date;

  /** When conversation was last updated */
  updated_at: Date;

  /** Array of messages in the conversation */
  messages: MessageData[];

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A single message for export
 */
export interface MessageData {
  /** Message ID */
  id: string;

  /** Message role (user or assistant) */
  role: 'user' | 'assistant' | 'system';

  /** Message content */
  content: string;

  /** When message was created */
  created_at: Date;

  /** Optional metadata (tool calls, GraphRAG sources, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Archive operation options
 */
export interface ArchiveOptions {
  /** IDs of conversations to archive */
  conversationIds: string[];

  /** Whether to permanently delete after archive (default: false) */
  permanentDelete?: boolean;
}

/**
 * Result of an archive operation
 */
export interface ArchiveResult {
  /** Number of conversations successfully archived */
  archivedCount: number;

  /** IDs of conversations that were archived */
  archivedIds: string[];

  /** Any errors that occurred */
  errors?: Array<{
    conversationId: string;
    error: string;
  }>;
}

/**
 * Options for restoring archived conversations
 */
export interface RestoreOptions {
  /** IDs of conversations to restore */
  conversationIds: string[];
}

/**
 * Result of a restore operation
 */
export interface RestoreResult {
  /** Number of conversations successfully restored */
  restoredCount: number;

  /** IDs of conversations that were restored */
  restoredIds: string[];

  /** Any errors that occurred */
  errors?: Array<{
    conversationId: string;
    error: string;
  }>;
}

/**
 * Shape of archived conversation rows returned from get_archived_conversations
 */
export interface ArchivedConversationRow {
  id: string;
  title: string;
  created_at: string;
  archived_at: string;
  message_count: number;
}

/**
 * Format generator interface
 * All format generators must implement this interface
 */
export interface FormatGenerator {
  /**
   * Generate export in this format
   * @param conversations - Conversations to export
   * @param options - Export options
   * @returns Generated content as string or Buffer
   */
  generate(
    conversations: ConversationData[],
    options: ExportOptions
  ): Promise<string | Buffer>;

  /**
   * Get file extension for this format
   */
  getExtension(): string;

  /**
   * Get MIME type for this format
   */
  getMimeType(): string;
}

/**
 * Export job status for tracking async exports
 */
export interface ExportJob {
  /** Job ID */
  id: string;

  /** User ID who requested export */
  userId: string;

  /** Export options */
  options: ExportOptions;

  /** Current status */
  status: 'pending' | 'processing' | 'completed' | 'failed';

  /** Progress percentage (0-100) */
  progress: number;

  /** Result if completed */
  result?: ExportResult;

  /** Error message if failed */
  error?: string;

  /** When job was created */
  created_at: Date;

  /** When job was completed */
  completed_at?: Date;
}
