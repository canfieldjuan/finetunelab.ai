/**
 * Export Service - Core Export Orchestration
 *
 * Main service for handling conversation exports. Coordinates loading data,
 * formatting, file generation, and tracking.
 *
 * @deprecated This service has been replaced by UnifiedExportService (lib/export-unified).
 * Please use /api/export/v2 instead of this service directly.
 * See migration guide: /docs/export-migration.md
 * This class will be removed after 60-day grace period.
 *
 * @module lib/export/exportService
 */

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import {
  ExportOptions,
  ExportResult,
  ConversationData,
  MessageData,
  FormatGenerator,
} from './types';
import {
  exportConfig,
  validateExportLimits,
  getExportFilePath,
  getExpirationDate,
} from './config';
import type { JsonValue } from '../types';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_widget_session: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata: JsonValue;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  tools_called: JsonValue;
  tool_success: boolean;
  fallback_used: boolean;
  error_type: string;
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Main Export Service
 */
export class ExportService {
  private formatGenerators: Map<string, FormatGenerator>;

  constructor() {
    this.formatGenerators = new Map();
  }

  /**
   * Register a format generator
   * @param format - Format name
   * @param generator - Format generator instance
   */
  registerFormatter(format: string, generator: FormatGenerator): void {
    this.formatGenerators.set(format, generator);
  }

  /**
   * Generate an export
   * @param userId - User ID requesting export
   * @param options - Export options
   * @returns Export result with file info
   */
  async generate(userId: string, options: ExportOptions): Promise<ExportResult> {
    // Validate options
    validateExportLimits(options.conversationIds.length);

    // Generate unique export ID
    const exportId = randomUUID();

    try {
      // Load conversation data
      const conversations = await this.loadConversations(
        userId,
        options.conversationIds,
        options
      );

      if (conversations.length === 0) {
        throw new Error('No conversations found to export');
      }

      // Get format generator
      const generator = this.formatGenerators.get(options.format);
      if (!generator) {
        throw new Error(`Unsupported export format: ${options.format}`);
      }

      // Generate export content
      const content = await generator.generate(conversations, options);

      // Ensure export directory exists
      await this.ensureExportDirectory();

      // Write file
      const filePath = getExportFilePath(userId, exportId, options.format);
      await fs.writeFile(filePath, content);

      // Get file size
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      // Calculate expiration
      const expiresAt = getExpirationDate();

      // Count total messages
      const messageCount = conversations.reduce(
        (sum, conv) => sum + conv.messages.length,
        0
      );

      // Save export record to database
      const { error: dbError } = await supabase.from('conversation_exports').insert({
        id: exportId,
        user_id: userId,
        conversation_ids: options.conversationIds,
        format: options.format,
        file_path: filePath,
        file_size: fileSize,
        export_options: options,
        expires_at: expiresAt.toISOString(),
      });

      if (dbError) {
        // Clean up file if database insert fails
        await fs.unlink(filePath).catch(() => {});
        throw new Error(`Failed to save export record: ${dbError.message}`);
      }

      // Return result
      return {
        id: exportId,
        filePath,
        fileSize,
        downloadUrl: `/api/export/download/${exportId}`,
        expiresAt,
        format: options.format,
        conversationCount: conversations.length,
        messageCount,
      };
    } catch (error) {
      throw new Error(
        `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load conversations from database
   * @param userId - User ID
   * @param conversationIds - Conversation IDs to load
   * @param options - Export options for filtering
   * @returns Array of conversation data
   */
  private async loadConversations(
    userId: string,
    conversationIds: string[],
    options: ExportOptions
  ): Promise<ConversationData[]> {
    // Load conversations first (without nested query)
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at, is_widget_session')
      .eq('user_id', userId)
      .in('id', conversationIds)
      .order('created_at', { ascending: true });

    if (convError) {
      throw new Error(`Failed to load conversations: ${convError.message}`);
    }

    if (!conversations || conversations.length === 0) {
      return [];
    }

    // Filter by widget session type if specified
    let filteredConversations = conversations as Conversation[];
    if (options.widgetSessionFilter && options.widgetSessionFilter !== 'all') {
      console.log('[ExportService] Filtering by widget session type:', options.widgetSessionFilter);
      if (options.widgetSessionFilter === 'widget') {
        filteredConversations = conversations.filter((c) => c.is_widget_session === true);
      } else if (options.widgetSessionFilter === 'normal') {
        filteredConversations = conversations.filter((c) => c.is_widget_session === false);
      }
      console.log('[ExportService] Filtered conversations:', {
        before: conversations.length,
        after: filteredConversations.length
      });
    }

    if (filteredConversations.length === 0) {
      return [];
    }

    // Load messages for filtered conversations only
    const filteredConversationIds = filteredConversations.map((c) => c.id);
    const { data: allMessages, error: msgError } = await supabase
      .from('messages')
      .select(`
        id, conversation_id, role, content, created_at, metadata,
        latency_ms, input_tokens, output_tokens, tools_called,
        tool_success, fallback_used, error_type
      `)
      .in('conversation_id', filteredConversationIds)
      .order('created_at', { ascending: true });

    if (msgError) {
      throw new Error(`Failed to load messages: ${msgError.message}`);
    }

    // Group messages by conversation_id
    const messagesByConv = (allMessages || []).reduce((acc: Record<string, Message[]>, msg: Message) => {
      if (!acc[msg.conversation_id]) {
        acc[msg.conversation_id] = [];
      }
      acc[msg.conversation_id].push(msg);
      return acc;
    }, {});

    // Transform and filter data
    return filteredConversations.map((conv) => {
      // Get raw messages and convert to working type for filtering
      const rawMessages: Message[] = messagesByConv[conv.id] || [];

      // Filter by date range if specified
      let filteredMessages = rawMessages;
      if (options.dateRange) {
        filteredMessages = filteredMessages.filter((msg) => {
          const msgDate = new Date(msg.created_at);
          return (
            msgDate >= options.dateRange!.start &&
            msgDate <= options.dateRange!.end
          );
        });
      }

      // Filter out system messages if not included
      if (!options.includeSystemMessages) {
        filteredMessages = filteredMessages.filter((msg) => msg.role !== 'system');
      }

      // Map messages with optional metadata - transform to MessageData
      let messages: MessageData[];
      if (!options.includeMetadata) {
        messages = filteredMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          created_at: new Date(msg.created_at),
        }));
      } else {
        messages = filteredMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          created_at: new Date(msg.created_at),
          metadata: {
            ...(typeof msg.metadata === 'object' && msg.metadata !== null ? msg.metadata as Record<string, unknown> : {}),
            // Add Phase 7 metrics to metadata
            latency_ms: msg.latency_ms,
            input_tokens: msg.input_tokens,
            output_tokens: msg.output_tokens,
            tools_called: msg.tools_called,
            tool_success: msg.tool_success,
            fallback_used: msg.fallback_used,
            error_type: msg.error_type,
          },
        }));
      }

      // Limit messages per conversation
      if (messages.length > exportConfig.maxMessagesPerConversation) {
        messages = messages.slice(0, exportConfig.maxMessagesPerConversation);
      }

      return {
        id: conv.id,
        title: conv.title,
        created_at: new Date(conv.created_at),
        updated_at: new Date(conv.updated_at),
        messages,
      };
    });
  }

  /**
   * Ensure export directory exists
   */
  private async ensureExportDirectory(): Promise<void> {
    try {
      await fs.access(exportConfig.storagePath);
    } catch {
      await fs.mkdir(exportConfig.storagePath, { recursive: true });
    }
  }

  /**
   * Get export by ID
   * @param exportId - Export ID
   * @param userId - User ID (for security)
   * @returns Export info or null
   */
  async getExport(
    exportId: string,
    userId: string
  ): Promise<{ filePath: string; format: string } | null> {
    const { data, error } = await supabase
      .from('conversation_exports')
      .select('file_path, format')
      .eq('id', exportId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      filePath: data.file_path,
      format: data.format,
    };
  }

  /**
   * Track export download
   * @param exportId - Export ID
   */
  async trackDownload(exportId: string): Promise<void> {
    await supabase.rpc('increment_export_downloads', { p_export_id: exportId });
  }

  /**
   * Clean up expired exports
   * @returns Number of exports cleaned up
   */
  async cleanupExpired(): Promise<number> {
    if (!exportConfig.cleanupEnabled) {
      return 0;
    }

    // Get expired exports
    const { data: expired, error } = await supabase
      .from('conversation_exports')
      .select('id, file_path')
      .lt('expires_at', new Date().toISOString());

    if (error || !expired || expired.length === 0) {
      return 0;
    }

    let cleanedCount = 0;

    // Delete files and records
    for (const exp of expired) {
      try {
        // Delete file
        await fs.unlink(exp.file_path);

        // Delete database record
        await supabase.from('conversation_exports').delete().eq('id', exp.id);

        cleanedCount++;
      } catch (err) {
        // Log but continue with other files
        console.error(`Failed to clean up export ${exp.id}:`, err);
      }
    }

    return cleanedCount;
  }
}

// Export singleton instance
export const exportService = new ExportService();
