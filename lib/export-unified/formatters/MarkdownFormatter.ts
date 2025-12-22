/**
 * Markdown Format Generator
 * Phase 3: Format Generators
 *
 * Generates human-readable Markdown exports
 * Ideal for documentation and sharing
 */

import type {
  FormatGenerator,
  ExportData,
  ExportOptions,
  ConversationData,
  AnalyticsDataset,
  TraceDataset,
} from '../interfaces';

export class MarkdownFormatter implements FormatGenerator {
  /**
   * Generate Markdown export
   */
  async generate(data: ExportData, options?: ExportOptions): Promise<string> {
    const parts: string[] = [];

    // Frontmatter (YAML-style metadata)
    parts.push(this.generateFrontmatter(data, options));
    parts.push('');

    // Title
    const title = options?.title || `${this.capitalizeFirst(data.type)} Export`;
    parts.push(`# ${title}`);
    parts.push('');

    // Description
    if (options?.description) {
      parts.push(options.description);
      parts.push('');
    }

    // Metadata section
    parts.push('## Export Information');
    parts.push('');
    parts.push(`- **Export Type:** ${data.type}`);
    parts.push(`- **Exported At:** ${new Date().toISOString()}`);

    if (data.metadata.conversationCount !== undefined) {
      parts.push(`- **Conversations:** ${data.metadata.conversationCount}`);
    }
    if (data.metadata.messageCount !== undefined) {
      parts.push(`- **Messages:** ${data.metadata.messageCount}`);
    }
    if (data.metadata.traceCount !== undefined) {
      parts.push(`- **Traces:** ${data.metadata.traceCount}`);
    }
    if (data.metadata.dateRange) {
      parts.push(
        `- **Date Range:** ${data.metadata.dateRange.start.toISOString()} to ${data.metadata.dateRange.end.toISOString()}`
      );
    }

    parts.push('');
    parts.push('---');
    parts.push('');

    // Data section (type-specific)
    switch (data.type) {
      case 'conversation':
        parts.push(this.generateConversationMarkdown(data.data as ConversationData[], options));
        break;

      case 'analytics':
        parts.push(this.generateAnalyticsMarkdown(data.data as AnalyticsDataset));
        break;

      case 'trace':
        parts.push(this.generateTraceMarkdown(data.data as TraceDataset));
        break;

      case 'custom':
        parts.push(this.generateCustomMarkdown(data.data as Record<string, unknown>[]));
        break;

      default:
        throw new Error(`Unsupported export type for Markdown: ${data.type}`);
    }

    return parts.join('\n');
  }

  /**
   * Generate YAML frontmatter
   */
  private generateFrontmatter(data: ExportData, options?: ExportOptions): string {
    const lines: string[] = [];

    lines.push('---');
    lines.push(`title: "${options?.title || `${this.capitalizeFirst(data.type)} Export`}"`);
    lines.push(`export_type: ${data.type}`);
    lines.push(`format: markdown`);
    lines.push(`version: "2.0"`);
    lines.push(`exported_at: ${new Date().toISOString()}`);

    if (data.metadata.conversationCount !== undefined) {
      lines.push(`conversation_count: ${data.metadata.conversationCount}`);
    }
    if (data.metadata.messageCount !== undefined) {
      lines.push(`message_count: ${data.metadata.messageCount}`);
    }
    if (data.metadata.traceCount !== undefined) {
      lines.push(`trace_count: ${data.metadata.traceCount}`);
    }

    lines.push('---');

    return lines.join('\n');
  }

  /**
   * Generate conversation markdown
   */
  private generateConversationMarkdown(
    conversations: ConversationData[],
    options?: ExportOptions
  ): string {
    const parts: string[] = [];

    conversations.forEach((conv, convIndex) => {
      // Conversation header
      parts.push(`## Conversation ${convIndex + 1}: ${conv.title}`);
      parts.push('');

      if (options?.includeMetadata !== false) {
        parts.push(`**ID:** ${conv.id}  `);
        parts.push(`**Created:** ${conv.created_at.toISOString()}  `);
        parts.push(`**Updated:** ${conv.updated_at.toISOString()}  `);
        parts.push(`**Messages:** ${conv.messages.length}`);
        parts.push('');
      }

      // Messages
      conv.messages.forEach((msg, msgIndex) => {
        const roleIcon =
          msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '⚙️';

        parts.push(`### ${roleIcon} ${this.capitalizeFirst(msg.role)} (${msgIndex + 1})`);
        parts.push('');
        parts.push(msg.content);
        parts.push('');

        if (options?.includeMetadata !== false) {
          parts.push(`<small>_${msg.created_at.toISOString()}_</small>`);
          parts.push('');
        }
      });

      // Separator between conversations
      if (convIndex < conversations.length - 1) {
        parts.push('---');
        parts.push('');
      }
    });

    return parts.join('\n');
  }

  /**
   * Generate analytics markdown
   */
  private generateAnalyticsMarkdown(dataset: AnalyticsDataset): string {
    const parts: string[] = [];

    // Aggregations summary
    if (dataset.aggregations) {
      const agg = dataset.aggregations;
      parts.push('## Summary');
      parts.push('');
      parts.push(`- **Total Messages:** ${agg.totalMessages || 0}`);
      parts.push(`- **Total Conversations:** ${agg.totalConversations || 0}`);
      parts.push(`- **Total Tokens:** ${agg.totalTokens?.toLocaleString() || 0}`);
      if (agg.totalCost) {
        parts.push(`- **Total Cost:** $${agg.totalCost.toFixed(4)}`);
      }
      if (agg.avgRating) {
        parts.push(`- **Average Rating:** ${agg.avgRating.toFixed(2)} / 5`);
      }
      if (agg.avgLatency) {
        parts.push(`- **Average Latency:** ${agg.avgLatency.toFixed(0)} ms`);
      }
      if (agg.successRate !== undefined) {
        parts.push(`- **Success Rate:** ${(agg.successRate * 100).toFixed(1)}%`);
      }
      parts.push('');
    }

    // Token usage table
    if (dataset.tokenUsage && dataset.tokenUsage.length > 0) {
      parts.push('## Token Usage');
      parts.push('');
      parts.push('| Date | Model | Input | Output | Total | Cost |');
      parts.push('|------|-------|-------|--------|-------|------|');

      dataset.tokenUsage.slice(0, 20).forEach((item) => {
        parts.push(
          `| ${item.date.toISOString().split('T')[0]} | ${item.model || '-'} | ${item.input_tokens.toLocaleString()} | ${item.output_tokens.toLocaleString()} | ${item.total_tokens.toLocaleString()} | $${(item.cost || 0).toFixed(4)} |`
        );
      });

      if (dataset.tokenUsage.length > 20) {
        parts.push(`\n_... and ${dataset.tokenUsage.length - 20} more rows_`);
      }

      parts.push('');
    }

    // Tool usage
    if (dataset.tools && dataset.tools.length > 0) {
      parts.push('## Tool Usage');
      parts.push('');
      parts.push('| Tool | Executions | Success | Failure | Avg Duration |');
      parts.push('|------|-----------|---------|---------|--------------|');

      dataset.tools.forEach((item) => {
        parts.push(
          `| ${item.tool_name} | ${item.execution_count} | ${item.success_count} | ${item.failure_count} | ${item.avg_duration_ms.toFixed(0)} ms |`
        );
      });

      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Generate trace markdown
   */
  private generateTraceMarkdown(dataset: TraceDataset): string {
    const parts: string[] = [];

    // Summary
    if (dataset.summary) {
      const s = dataset.summary;
      parts.push('## Summary');
      parts.push('');
      parts.push(`- **Total Traces:** ${s.totalTraces}`);
      parts.push(`- **Success:** ${s.successCount} (${((s.successCount / s.totalTraces) * 100).toFixed(1)}%)`);
      parts.push(`- **Failure:** ${s.failureCount} (${((s.failureCount / s.totalTraces) * 100).toFixed(1)}%)`);
      parts.push(`- **Average Latency:** ${s.avgLatency.toFixed(0)} ms`);
      parts.push(`- **Total Tokens:** ${s.totalTokens.toLocaleString()}`);
      parts.push(`- **Total Cost:** $${s.totalCost.toFixed(4)}`);
      parts.push('');
    }

    // Traces table (first 20)
    if (dataset.traces.length > 0) {
      parts.push('## Traces');
      parts.push('');
      parts.push('| Trace ID | Operation | Model | Tokens | Latency | Status |');
      parts.push('|----------|-----------|-------|--------|---------|--------|');

      dataset.traces.slice(0, 20).forEach((trace) => {
        const totalTokens = trace.input_tokens + trace.output_tokens;
        const status = trace.status === 'success' ? '✅' : '❌';
        parts.push(
          `| ${trace.trace_id.substring(0, 8)}... | ${trace.operation} | ${trace.model} | ${totalTokens.toLocaleString()} | ${trace.latency_ms} ms | ${status} |`
        );
      });

      if (dataset.traces.length > 20) {
        parts.push(`\n_... and ${dataset.traces.length - 20} more traces_`);
      }

      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Generate custom markdown
   */
  private generateCustomMarkdown(data: Record<string, unknown>[]): string {
    const parts: string[] = [];

    parts.push('## Data');
    parts.push('');

    if (data.length === 0) {
      parts.push('_No data available_');
    } else {
      // Display as JSON code block
      parts.push('```json');
      parts.push(JSON.stringify(data, null, 2));
      parts.push('```');
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
    return 'md';
  }

  /**
   * Get MIME type
   */
  getMimeType(): string {
    return 'text/markdown';
  }

  /**
   * Streaming support
   */
  supportsStreaming(): boolean {
    return false;
  }
}
