/**
 * CSV Format Generator
 * Phase 3: Format Generators
 *
 * Generates CSV exports for spreadsheet analysis
 * Supports conversation, analytics, and trace data
 */

import type {
  FormatGenerator,
  ExportData,
  ExportOptions,
  ConversationData,
  AnalyticsDataset,
  TraceDataset,
} from '../interfaces';
import {
  escapeCSVValue,
  arrayToCSV,
  addUTF8BOM,
  formatDateForCSV,
  formatJSONForCSV,
  createMultiSectionCSV,
} from '../utils/csv-helpers';

export class CSVFormatter implements FormatGenerator {
  /**
   * Generate CSV export
   */
  async generate(data: ExportData, options?: ExportOptions): Promise<string> {
    let csvContent: string;

    switch (data.type) {
      case 'conversation':
        csvContent = this.generateConversationCSV(
          data.data as ConversationData[],
          options
        );
        break;

      case 'analytics':
        csvContent = this.generateAnalyticsCSV(data.data as AnalyticsDataset);
        break;

      case 'trace':
        csvContent = this.generateTraceCSV(data.data as TraceDataset);
        break;

      case 'custom':
        csvContent = this.generateCustomCSV(data.data as Record<string, unknown>[]);
        break;

      default:
        throw new Error(`Unsupported export type for CSV: ${data.type}`);
    }

    // Add UTF-8 BOM for Excel compatibility
    return addUTF8BOM(csvContent);
  }

  /**
   * Generate conversation CSV
   */
  private generateConversationCSV(
    conversations: ConversationData[],
    options?: ExportOptions
  ): string {
    const rows: Record<string, unknown>[] = [];

    conversations.forEach((conv) => {
      conv.messages.forEach((msg) => {
        const row: Record<string, unknown> = {
          conversation_id: options?.includeMetadata !== false ? conv.id : '',
          conversation_title: conv.title,
          conversation_created_at: formatDateForCSV(conv.created_at),
          message_role: msg.role,
          message_content: msg.content,
          message_created_at: formatDateForCSV(msg.created_at),
        };

        // Add metadata if requested
        if (options?.includeMetadata !== false && msg.metadata) {
          row.message_id = msg.id;
          row.metadata = formatJSONForCSV(msg.metadata);
        }

        rows.push(row);
      });
    });

    const headers = options?.includeMetadata !== false
      ? [
          'conversation_id',
          'conversation_title',
          'conversation_created_at',
          'message_id',
          'message_role',
          'message_content',
          'message_created_at',
          'metadata',
        ]
      : [
          'conversation_title',
          'conversation_created_at',
          'message_role',
          'message_content',
          'message_created_at',
        ];

    return arrayToCSV(rows, headers);
  }

  /**
   * Generate analytics CSV (multi-section)
   */
  private generateAnalyticsCSV(dataset: AnalyticsDataset): string {
    const sections: {
      title: string;
      data: Record<string, unknown>[];
      headers: string[];
    }[] = [];

    // Token usage section
    if (dataset.tokenUsage && dataset.tokenUsage.length > 0) {
      sections.push({
        title: 'Token Usage',
        data: dataset.tokenUsage.map((item) => ({
          date: formatDateForCSV(item.date),
          model: item.model || '',
          input_tokens: item.input_tokens,
          output_tokens: item.output_tokens,
          total_tokens: item.total_tokens,
          cost: item.cost || '',
        })),
        headers: ['date', 'model', 'input_tokens', 'output_tokens', 'total_tokens', 'cost'],
      });
    }

    // Quality metrics section
    if (dataset.quality && dataset.quality.length > 0) {
      sections.push({
        title: 'Quality Metrics',
        data: dataset.quality.map((item) => ({
          date: formatDateForCSV(item.date),
          model: item.model || '',
          rating: item.rating || '',
          success_rate: item.success_rate,
          failure_rate: item.failure_rate,
          error_rate: item.error_rate,
        })),
        headers: ['date', 'model', 'rating', 'success_rate', 'failure_rate', 'error_rate'],
      });
    }

    // Tool usage section
    if (dataset.tools && dataset.tools.length > 0) {
      sections.push({
        title: 'Tool Usage',
        data: dataset.tools.map((item) => ({
          tool_name: item.tool_name,
          execution_count: item.execution_count,
          success_count: item.success_count,
          failure_count: item.failure_count,
          avg_duration_ms: item.avg_duration_ms.toFixed(2),
        })),
        headers: [
          'tool_name',
          'execution_count',
          'success_count',
          'failure_count',
          'avg_duration_ms',
        ],
      });
    }

    // Conversation metrics section
    if (dataset.conversations && dataset.conversations.length > 0) {
      sections.push({
        title: 'Conversation Metrics',
        data: dataset.conversations.map((item) => ({
          conversation_id: item.conversation_id,
          message_count: item.message_count,
          total_tokens: item.total_tokens,
          avg_rating: item.avg_rating || '',
          created_at: formatDateForCSV(item.created_at),
        })),
        headers: ['conversation_id', 'message_count', 'total_tokens', 'avg_rating', 'created_at'],
      });
    }

    // Errors section
    if (dataset.errors && dataset.errors.length > 0) {
      sections.push({
        title: 'Errors',
        data: dataset.errors.map((item) => ({
          timestamp: formatDateForCSV(item.timestamp),
          error_type: item.error_type,
          error_message: item.error_message,
          model: item.model || '',
          conversation_id: item.conversation_id || '',
        })),
        headers: ['timestamp', 'error_type', 'error_message', 'model', 'conversation_id'],
      });
    }

    // Latency section
    if (dataset.latency && dataset.latency.length > 0) {
      sections.push({
        title: 'Latency',
        data: dataset.latency.map((item) => ({
          timestamp: formatDateForCSV(item.timestamp),
          operation: item.operation,
          latency_ms: item.latency_ms,
          model: item.model || '',
        })),
        headers: ['timestamp', 'operation', 'latency_ms', 'model'],
      });
    }

    // Aggregations section
    if (dataset.aggregations) {
      const agg = dataset.aggregations;
      sections.push({
        title: 'Aggregations',
        data: [
          { metric: 'Total Messages', value: agg.totalMessages || 0 },
          { metric: 'Total Conversations', value: agg.totalConversations || 0 },
          { metric: 'Total Tokens', value: agg.totalTokens || 0 },
          { metric: 'Total Cost', value: agg.totalCost || 0 },
          { metric: 'Average Rating', value: agg.avgRating || '' },
          { metric: 'Average Latency (ms)', value: agg.avgLatency || 0 },
          { metric: 'Success Rate', value: agg.successRate || 0 },
        ],
        headers: ['metric', 'value'],
      });
    }

    if (sections.length === 0) {
      return 'No data available';
    }

    return createMultiSectionCSV(sections);
  }

  /**
   * Generate trace CSV
   */
  private generateTraceCSV(dataset: TraceDataset): string {
    const rows = dataset.traces.map((trace) => ({
      trace_id: trace.trace_id,
      operation: trace.operation,
      model: trace.model,
      input_tokens: trace.input_tokens,
      output_tokens: trace.output_tokens,
      cache_read_input_tokens: trace.cache_read_input_tokens || '',
      cache_creation_input_tokens: trace.cache_creation_input_tokens || '',
      latency_ms: trace.latency_ms,
      cost: trace.cost || '',
      status: trace.status,
      error_type: trace.error_type || '',
      retry_count: trace.retry_count || '',
      retry_reason: trace.retry_reason || '',
      created_at: formatDateForCSV(trace.created_at),
      metadata: formatJSONForCSV(trace.metadata),
    }));

    const headers = [
      'trace_id',
      'operation',
      'model',
      'input_tokens',
      'output_tokens',
      'cache_read_input_tokens',
      'cache_creation_input_tokens',
      'latency_ms',
      'cost',
      'status',
      'error_type',
      'retry_count',
      'retry_reason',
      'created_at',
      'metadata',
    ];

    let csv = arrayToCSV(rows, headers);

    // Add summary section if available
    if (dataset.summary) {
      const summary = dataset.summary;
      csv += '\n\n# Summary\n\n';
      csv += arrayToCSV(
        [
          { metric: 'Total Traces', value: summary.totalTraces },
          { metric: 'Success Count', value: summary.successCount },
          { metric: 'Failure Count', value: summary.failureCount },
          { metric: 'Average Latency (ms)', value: summary.avgLatency.toFixed(2) },
          { metric: 'Total Tokens', value: summary.totalTokens },
          { metric: 'Total Cost', value: summary.totalCost.toFixed(4) },
        ],
        ['metric', 'value']
      );
    }

    return csv;
  }

  /**
   * Generate custom CSV
   */
  private generateCustomCSV(data: Record<string, unknown>[]): string {
    if (data.length === 0) {
      return 'No data available';
    }

    // Extract headers from first object
    const headers = Object.keys(data[0]);

    return arrayToCSV(data, headers);
  }

  /**
   * Get file extension
   */
  getExtension(): string {
    return 'csv';
  }

  /**
   * Get MIME type
   */
  getMimeType(): string {
    return 'text/csv';
  }

  /**
   * Streaming support
   */
  supportsStreaming(): boolean {
    return true; // CSV can be streamed row by row
  }
}
