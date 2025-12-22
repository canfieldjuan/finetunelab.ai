/**
 * JSONL (JSON Lines) Format Generator
 * Phase 3: Format Generators
 *
 * Generates JSONL exports (one JSON object per line)
 * Ideal for streaming and processing large datasets
 */

import type {
  FormatGenerator,
  ExportData,
  ExportOptions,
  ConversationData,
  AnalyticsDataset,
  TraceDataset,
} from '../interfaces';

export class JSONLFormatter implements FormatGenerator {
  /**
   * Generate JSONL export
   */
  async generate(data: ExportData, options?: ExportOptions): Promise<string> {
    const lines: string[] = [];

    // First line: metadata
    lines.push(
      JSON.stringify({
        _type: 'metadata',
        export: {
          version: '2.0',
          format: 'jsonl',
          exportType: data.type,
          exportedAt: new Date().toISOString(),
          title: options?.title || `${data.type} Export`,
        },
        metadata: this.serializeMetadata(data.metadata),
      })
    );

    // Data lines (type-specific)
    switch (data.type) {
      case 'conversation':
        lines.push(
          ...this.generateConversationLines(data.data as ConversationData[], options)
        );
        break;

      case 'analytics':
        lines.push(...this.generateAnalyticsLines(data.data as AnalyticsDataset));
        break;

      case 'trace':
        lines.push(...this.generateTraceLines(data.data as TraceDataset));
        break;

      case 'custom':
        lines.push(...this.generateCustomLines(data.data as Record<string, unknown>[]));
        break;

      default:
        throw new Error(`Unsupported export type for JSONL: ${data.type}`);
    }

    return lines.join('\n');
  }

  /**
   * Serialize metadata
   */
  private serializeMetadata(metadata: ExportData['metadata']): Record<string, unknown> {
    const serialized: Record<string, unknown> = { ...metadata };

    if (metadata.dateRange) {
      serialized.dateRange = {
        start: metadata.dateRange.start.toISOString(),
        end: metadata.dateRange.end.toISOString(),
      };
    }

    return serialized;
  }

  /**
   * Generate conversation JSONL lines
   * One line per message
   */
  private generateConversationLines(
    conversations: ConversationData[],
    options?: ExportOptions
  ): string[] {
    const lines: string[] = [];

    conversations.forEach((conv) => {
      conv.messages.forEach((msg) => {
        const line: Record<string, unknown> = {
          _type: 'message',
          conversationId: options?.includeMetadata !== false ? conv.id : undefined,
          conversationTitle: conv.title,
          conversationCreatedAt: conv.created_at.toISOString(),
          messageId: options?.includeMetadata !== false ? msg.id : undefined,
          role: msg.role,
          content: msg.content,
          createdAt: msg.created_at.toISOString(),
          metadata: options?.includeMetadata !== false ? msg.metadata : undefined,
        };

        lines.push(JSON.stringify(line));
      });
    });

    return lines;
  }

  /**
   * Generate analytics JSONL lines
   * One line per data point
   */
  private generateAnalyticsLines(dataset: AnalyticsDataset): string[] {
    const lines: string[] = [];

    // Token usage
    if (dataset.tokenUsage) {
      dataset.tokenUsage.forEach((item) => {
        lines.push(
          JSON.stringify({
            _type: 'token_usage',
            date: item.date.toISOString(),
            model: item.model,
            inputTokens: item.input_tokens,
            outputTokens: item.output_tokens,
            totalTokens: item.total_tokens,
            cost: item.cost,
          })
        );
      });
    }

    // Quality metrics
    if (dataset.quality) {
      dataset.quality.forEach((item) => {
        lines.push(
          JSON.stringify({
            _type: 'quality',
            date: item.date.toISOString(),
            model: item.model,
            rating: item.rating,
            successRate: item.success_rate,
            failureRate: item.failure_rate,
            errorRate: item.error_rate,
          })
        );
      });
    }

    // Tool usage
    if (dataset.tools) {
      dataset.tools.forEach((item) => {
        lines.push(
          JSON.stringify({
            _type: 'tool_usage',
            toolName: item.tool_name,
            executionCount: item.execution_count,
            successCount: item.success_count,
            failureCount: item.failure_count,
            avgDurationMs: item.avg_duration_ms,
          })
        );
      });
    }

    // Conversation metrics
    if (dataset.conversations) {
      dataset.conversations.forEach((item) => {
        lines.push(
          JSON.stringify({
            _type: 'conversation_metrics',
            conversationId: item.conversation_id,
            messageCount: item.message_count,
            totalTokens: item.total_tokens,
            avgRating: item.avg_rating,
            createdAt: item.created_at.toISOString(),
          })
        );
      });
    }

    // Errors
    if (dataset.errors) {
      dataset.errors.forEach((item) => {
        lines.push(
          JSON.stringify({
            _type: 'error',
            timestamp: item.timestamp.toISOString(),
            errorType: item.error_type,
            errorMessage: item.error_message,
            model: item.model,
            conversationId: item.conversation_id,
          })
        );
      });
    }

    // Latency
    if (dataset.latency) {
      dataset.latency.forEach((item) => {
        lines.push(
          JSON.stringify({
            _type: 'latency',
            timestamp: item.timestamp.toISOString(),
            operation: item.operation,
            latencyMs: item.latency_ms,
            model: item.model,
          })
        );
      });
    }

    // Aggregations (single line)
    if (dataset.aggregations) {
      lines.push(
        JSON.stringify({
          _type: 'aggregations',
          ...dataset.aggregations,
        })
      );
    }

    return lines;
  }

  /**
   * Generate trace JSONL lines
   * One line per trace
   */
  private generateTraceLines(dataset: TraceDataset): string[] {
    const lines: string[] = [];

    // Traces
    dataset.traces.forEach((trace) => {
      lines.push(
        JSON.stringify({
          _type: 'trace',
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
        })
      );
    });

    // Summary (single line)
    if (dataset.summary) {
      lines.push(
        JSON.stringify({
          _type: 'summary',
          ...dataset.summary,
        })
      );
    }

    return lines;
  }

  /**
   * Generate custom JSONL lines
   */
  private generateCustomLines(data: Record<string, unknown>[]): string[] {
    return data.map((item) => JSON.stringify({ _type: 'custom', ...item }));
  }

  /**
   * Get file extension
   */
  getExtension(): string {
    return 'jsonl';
  }

  /**
   * Get MIME type
   */
  getMimeType(): string {
    return 'application/x-ndjson';
  }

  /**
   * Streaming support
   */
  supportsStreaming(): boolean {
    return true; // JSONL is streaming-friendly
  }
}
