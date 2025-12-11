/**
 * JSON Format Generator
 *
 * Generates structured JSON exports with full metadata.
 *
 * @module lib/export/formatters/jsonFormatter
 */

import {
  FormatGenerator,
  ConversationData,
  ExportOptions,
} from '../types';

/**
 * JSON formatter
 */
export class JsonFormatter implements FormatGenerator {
  /**
   * Generate JSON export
   */
  async generate(
    conversations: ConversationData[],
    options: ExportOptions
  ): Promise<string> {
    const exportData = {
      // Export metadata
      export: {
        version: '1.0',
        format: 'json',
        exported_at: new Date().toISOString(),
        title: options.title || 'Conversation Export',
        conversation_count: conversations.length,
        message_count: conversations.reduce(
          (sum, conv) => sum + conv.messages.length,
          0
        ),
      },

      // Export options used
      options: {
        include_metadata: options.includeMetadata,
        include_system_messages: options.includeSystemMessages,
        date_range: options.dateRange
          ? {
              start: options.dateRange.start.toISOString(),
              end: options.dateRange.end.toISOString(),
            }
          : null,
        theme: options.theme,
      },

      // Conversations data
      conversations: conversations.map((conv) => ({
        id: options.includeMetadata ? conv.id : undefined,
        title: conv.title,
        created_at: conv.created_at.toISOString(),
        updated_at: conv.updated_at.toISOString(),
        message_count: conv.messages.length,
        messages: conv.messages.map((msg) => ({
          id: options.includeMetadata ? msg.id : undefined,
          role: msg.role,
          content: msg.content,
          created_at: msg.created_at.toISOString(),
          metadata: options.includeMetadata ? msg.metadata : undefined,
        })),
        metadata: options.includeMetadata ? conv.metadata : undefined,
      })),
    };

    // Pretty print JSON with 2-space indentation
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Get file extension
   */
  getExtension(): string {
    return 'json';
  }

  /**
   * Get MIME type
   */
  getMimeType(): string {
    return 'application/json';
  }
}
