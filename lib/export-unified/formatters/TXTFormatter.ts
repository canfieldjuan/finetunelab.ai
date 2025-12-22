/**
 * Plain Text Format Generator
 * Phase 3: Format Generators
 *
 * Generates simple plain text exports
 * Ideal for basic conversation transcripts
 */

import type {
  FormatGenerator,
  ExportData,
  ExportOptions,
  ConversationData,
  AnalyticsDataset,
  TraceDataset,
} from '../interfaces';

export class TXTFormatter implements FormatGenerator {
  /**
   * Generate plain text export
   */
  async generate(data: ExportData, options?: ExportOptions): Promise<string> {
    const parts: string[] = [];

    // Header
    const title = options?.title || `${this.capitalizeFirst(data.type)} Export`;
    parts.push(title.toUpperCase());
    parts.push('='.repeat(title.length));
    parts.push('');
    parts.push(`Exported: ${new Date().toISOString()}`);
    parts.push(`Type: ${data.type}`);

    if (data.metadata.conversationCount !== undefined) {
      parts.push(`Conversations: ${data.metadata.conversationCount}`);
    }
    if (data.metadata.messageCount !== undefined) {
      parts.push(`Messages: ${data.metadata.messageCount}`);
    }
    if (data.metadata.traceCount !== undefined) {
      parts.push(`Traces: ${data.metadata.traceCount}`);
    }

    parts.push('');
    parts.push('-'.repeat(80));
    parts.push('');

    // Data section (type-specific)
    switch (data.type) {
      case 'conversation':
        parts.push(this.generateConversationText(data.data as ConversationData[], options));
        break;

      case 'analytics':
        parts.push(this.generateAnalyticsText(data.data as AnalyticsDataset));
        break;

      case 'trace':
        parts.push(this.generateTraceText(data.data as TraceDataset));
        break;

      case 'custom':
        parts.push(this.generateCustomText(data.data as Record<string, unknown>[]));
        break;

      default:
        throw new Error(`Unsupported export type for TXT: ${data.type}`);
    }

    return parts.join('\n');
  }

  /**
   * Generate conversation text
   */
  private generateConversationText(
    conversations: ConversationData[],
    options?: ExportOptions
  ): string {
    const parts: string[] = [];

    conversations.forEach((conv, convIndex) => {
      // Conversation header
      parts.push(`CONVERSATION ${convIndex + 1}: ${conv.title}`);
      parts.push(`Created: ${conv.created_at.toISOString()}`);
      if (options?.includeMetadata !== false) {
        parts.push(`ID: ${conv.id}`);
      }
      parts.push('');

      // Messages
      conv.messages.forEach((msg, msgIndex) => {
        const roleLabel = msg.role.toUpperCase();
        const timestamp = msg.created_at.toISOString();

        parts.push(`[${roleLabel}] (${timestamp})`);
        parts.push(msg.content);
        parts.push('');
      });

      // Separator between conversations
      if (convIndex < conversations.length - 1) {
        parts.push('-'.repeat(80));
        parts.push('');
      }
    });

    return parts.join('\n');
  }

  /**
   * Generate analytics text
   */
  private generateAnalyticsText(dataset: AnalyticsDataset): string {
    const parts: string[] = [];

    // Aggregations summary
    if (dataset.aggregations) {
      const agg = dataset.aggregations;
      parts.push('SUMMARY');
      parts.push('');
      parts.push(`Total Messages:       ${agg.totalMessages || 0}`);
      parts.push(`Total Conversations:  ${agg.totalConversations || 0}`);
      parts.push(`Total Tokens:         ${agg.totalTokens?.toLocaleString() || 0}`);
      if (agg.totalCost) {
        parts.push(`Total Cost:           $${agg.totalCost.toFixed(4)}`);
      }
      if (agg.avgRating) {
        parts.push(`Average Rating:       ${agg.avgRating.toFixed(2)} / 5`);
      }
      if (agg.avgLatency) {
        parts.push(`Average Latency:      ${agg.avgLatency.toFixed(0)} ms`);
      }
      if (agg.successRate !== undefined) {
        parts.push(`Success Rate:         ${(agg.successRate * 100).toFixed(1)}%`);
      }
      parts.push('');
    }

    // Token usage (simple list)
    if (dataset.tokenUsage && dataset.tokenUsage.length > 0) {
      parts.push('TOKEN USAGE');
      parts.push('');

      dataset.tokenUsage.slice(0, 10).forEach((item) => {
        const date = item.date.toISOString().split('T')[0];
        parts.push(
          `${date} | ${item.model || 'N/A'} | In: ${item.input_tokens.toLocaleString()} | Out: ${item.output_tokens.toLocaleString()} | Total: ${item.total_tokens.toLocaleString()}`
        );
      });

      if (dataset.tokenUsage.length > 10) {
        parts.push(`... and ${dataset.tokenUsage.length - 10} more entries`);
      }

      parts.push('');
    }

    // Tool usage
    if (dataset.tools && dataset.tools.length > 0) {
      parts.push('TOOL USAGE');
      parts.push('');

      dataset.tools.forEach((item) => {
        parts.push(
          `${item.tool_name}: ${item.execution_count} executions (${item.success_count} success, ${item.failure_count} failure) - Avg: ${item.avg_duration_ms.toFixed(0)}ms`
        );
      });

      parts.push('');
    }

    // Errors
    if (dataset.errors && dataset.errors.length > 0) {
      parts.push('ERRORS');
      parts.push('');

      dataset.errors.slice(0, 10).forEach((item) => {
        const time = item.timestamp.toISOString();
        parts.push(`[${time}] ${item.error_type}: ${item.error_message}`);
      });

      if (dataset.errors.length > 10) {
        parts.push(`... and ${dataset.errors.length - 10} more errors`);
      }

      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Generate trace text
   */
  private generateTraceText(dataset: TraceDataset): string {
    const parts: string[] = [];

    // Summary
    if (dataset.summary) {
      const s = dataset.summary;
      parts.push('SUMMARY');
      parts.push('');
      parts.push(`Total Traces:     ${s.totalTraces}`);
      parts.push(`Success:          ${s.successCount} (${((s.successCount / s.totalTraces) * 100).toFixed(1)}%)`);
      parts.push(`Failure:          ${s.failureCount} (${((s.failureCount / s.totalTraces) * 100).toFixed(1)}%)`);
      parts.push(`Average Latency:  ${s.avgLatency.toFixed(0)} ms`);
      parts.push(`Total Tokens:     ${s.totalTokens.toLocaleString()}`);
      parts.push(`Total Cost:       $${s.totalCost.toFixed(4)}`);
      parts.push('');
    }

    // Traces (simple list)
    if (dataset.traces.length > 0) {
      parts.push('TRACES');
      parts.push('');

      dataset.traces.slice(0, 20).forEach((trace) => {
        const totalTokens = trace.input_tokens + trace.output_tokens;
        const status = trace.status === 'success' ? 'SUCCESS' : 'FAILURE';
        const time = trace.created_at.toISOString();

        parts.push(`[${time}] ${trace.trace_id}`);
        parts.push(
          `  Operation: ${trace.operation} | Model: ${trace.model} | Status: ${status}`
        );
        parts.push(
          `  Tokens: ${totalTokens.toLocaleString()} | Latency: ${trace.latency_ms}ms | Cost: $${(trace.cost || 0).toFixed(4)}`
        );

        if (trace.error_type) {
          parts.push(`  Error: ${trace.error_type}`);
        }

        parts.push('');
      });

      if (dataset.traces.length > 20) {
        parts.push(`... and ${dataset.traces.length - 20} more traces`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Generate custom text
   */
  private generateCustomText(data: Record<string, unknown>[]): string {
    const parts: string[] = [];

    parts.push('DATA');
    parts.push('');

    if (data.length === 0) {
      parts.push('No data available');
    } else {
      data.forEach((item, index) => {
        parts.push(`Entry ${index + 1}:`);
        Object.entries(item).forEach(([key, value]) => {
          parts.push(`  ${key}: ${JSON.stringify(value)}`);
        });
        parts.push('');
      });
    }

    return parts.join('\n');
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Get file extension
   */
  getExtension(): string {
    return 'txt';
  }

  /**
   * Get MIME type
   */
  getMimeType(): string {
    return 'text/plain';
  }

  /**
   * Streaming support
   */
  supportsStreaming(): boolean {
    return false;
  }
}
