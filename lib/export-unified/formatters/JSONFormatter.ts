/**
 * JSON Format Generator
 * Phase 3: Format Generators
 *
 * Generates structured JSON exports with full metadata
 * Supports all export types: conversation, analytics, trace, custom
 */

import type {
  FormatGenerator,
  ExportData,
  ExportOptions,
  ConversationData,
  AnalyticsDataset,
  TraceDataset,
} from '../interfaces';

export class JSONFormatter implements FormatGenerator {
  /**
   * Generate JSON export
   */
  async generate(data: ExportData, options?: ExportOptions): Promise<string> {
    const exportDoc = {
      // Export metadata
      export: {
        version: '2.0',
        format: 'json',
        exportType: data.type,
        exportedAt: new Date().toISOString(),
        title: options?.title || `${data.type} Export`,
      },

      // Export options (if provided)
      options: options
        ? {
            includeMetadata: options.includeMetadata,
            includeSystemMessages: options.includeSystemMessages,
            compressionFormat: options.compressionFormat,
            theme: options.theme,
            customOptions: options.customOptions,
          }
        : undefined,

      // Data metadata
      metadata: this.serializeMetadata(data.metadata),

      // Data payload (type-specific)
      data: this.serializeData(data, options),
    };

    // Pretty print JSON with 2-space indentation
    return JSON.stringify(exportDoc, null, 2);
  }

  /**
   * Serialize metadata for JSON
   */
  private serializeMetadata(metadata: ExportData['metadata']): Record<string, unknown> {
    const serialized: Record<string, unknown> = { ...metadata };

    // Convert dates to ISO strings
    if (metadata.dateRange) {
      serialized.dateRange = {
        start: metadata.dateRange.start.toISOString(),
        end: metadata.dateRange.end.toISOString(),
      };
    }

    return serialized;
  }

  /**
   * Serialize data payload based on export type
   */
  private serializeData(
    exportData: ExportData,
    options?: ExportOptions
  ): unknown {
    switch (exportData.type) {
      case 'conversation':
        return this.serializeConversationData(
          exportData.data as ConversationData[],
          options
        );

      case 'analytics':
        return this.serializeAnalyticsData(exportData.data as AnalyticsDataset);

      case 'trace':
        return this.serializeTraceData(exportData.data as TraceDataset);

      case 'custom':
        return exportData.data;

      default:
        return exportData.data;
    }
  }

  /**
   * Serialize conversation data
   */
  private serializeConversationData(
    conversations: ConversationData[],
    options?: ExportOptions
  ): unknown {
    return {
      conversationCount: conversations.length,
      conversations: conversations.map((conv) => ({
        id: options?.includeMetadata !== false ? conv.id : undefined,
        title: conv.title,
        createdAt: conv.created_at.toISOString(),
        updatedAt: conv.updated_at.toISOString(),
        messageCount: conv.messages.length,
        messages: conv.messages.map((msg) => ({
          id: options?.includeMetadata !== false ? msg.id : undefined,
          role: msg.role,
          content: msg.content,
          createdAt: msg.created_at.toISOString(),
          metadata: options?.includeMetadata !== false ? msg.metadata : undefined,
        })),
      })),
    };
  }

  /**
   * Serialize analytics data
   */
  private serializeAnalyticsData(dataset: AnalyticsDataset): unknown {
    const serialized: Record<string, unknown> = {};

    // Token usage
    if (dataset.tokenUsage) {
      serialized.tokenUsage = dataset.tokenUsage.map((item) => ({
        date: item.date.toISOString(),
        model: item.model,
        inputTokens: item.input_tokens,
        outputTokens: item.output_tokens,
        totalTokens: item.total_tokens,
        cost: item.cost,
      }));
    }

    // Quality metrics
    if (dataset.quality) {
      serialized.quality = dataset.quality.map((item) => ({
        date: item.date.toISOString(),
        model: item.model,
        rating: item.rating,
        successRate: item.success_rate,
        failureRate: item.failure_rate,
        errorRate: item.error_rate,
      }));
    }

    // Tool usage
    if (dataset.tools) {
      serialized.tools = dataset.tools;
    }

    // Conversation metrics
    if (dataset.conversations) {
      serialized.conversations = dataset.conversations.map((item) => ({
        conversationId: item.conversation_id,
        messageCount: item.message_count,
        totalTokens: item.total_tokens,
        avgRating: item.avg_rating,
        createdAt: item.created_at.toISOString(),
      }));
    }

    // Errors
    if (dataset.errors) {
      serialized.errors = dataset.errors.map((item) => ({
        timestamp: item.timestamp.toISOString(),
        errorType: item.error_type,
        errorMessage: item.error_message,
        model: item.model,
        conversationId: item.conversation_id,
      }));
    }

    // Latency
    if (dataset.latency) {
      serialized.latency = dataset.latency.map((item) => ({
        timestamp: item.timestamp.toISOString(),
        operation: item.operation,
        latencyMs: item.latency_ms,
        model: item.model,
      }));
    }

    // Aggregations
    if (dataset.aggregations) {
      serialized.aggregations = dataset.aggregations;
    }

    return serialized;
  }

  /**
   * Serialize trace data
   */
  private serializeTraceData(dataset: TraceDataset): unknown {
    return {
      traceCount: dataset.traces.length,
      traces: dataset.traces.map((trace) => ({
        traceId: trace.trace_id,
        operation: trace.operation,
        model: trace.model,
        inputTokens: trace.input_tokens,
        outputTokens: trace.output_tokens,
        cacheReadInputTokens: trace.cache_read_input_tokens,
        cacheCreationInputTokens: trace.cache_creation_input_tokens,
        latencyMs: trace.latency_ms,
        cost: trace.cost,
        status: trace.status,
        errorType: trace.error_type,
        retryCount: trace.retry_count,
        retryReason: trace.retry_reason,
        createdAt: trace.created_at.toISOString(),
        metadata: trace.metadata,
      })),
      summary: dataset.summary
        ? {
            totalTraces: dataset.summary.totalTraces,
            successCount: dataset.summary.successCount,
            failureCount: dataset.summary.failureCount,
            avgLatency: dataset.summary.avgLatency,
            totalTokens: dataset.summary.totalTokens,
            totalCost: dataset.summary.totalCost,
          }
        : undefined,
    };
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

  /**
   * Streaming support
   */
  supportsStreaming(): boolean {
    return false; // JSON requires full document
  }
}
