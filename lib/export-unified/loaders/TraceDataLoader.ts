/**
 * Trace Data Loader
 * Loads HuggingFace LLM trace data for export
 * Phase 2: Data Loaders
 */

import type {
  DataLoader,
  DataSelector,
  TraceDataSelector,
  ExportData,
  TraceDataset,
  TraceData,
  TraceSummaryData,
  ExportMetadata,
  ValidationResult,
} from '../interfaces';
import { validateTraceSelector, validateUserId, estimateDataSize } from '../utils/validation';
import type { JsonValue } from '@/lib/types';

interface DBTrace {
  trace_id: string;
  operation: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  latency_ms: number;
  cost?: number;
  status: 'success' | 'failure';
  error_type?: string;
  retry_count?: number;
  retry_reason?: string;
  created_at: string;
  metadata?: JsonValue;
}

export class TraceDataLoader implements DataLoader {
  /**
   * Load trace data from database
   */
  async load(selector: DataSelector, userId: string): Promise<ExportData> {
    console.log('[TraceDataLoader] Loading data for user:', userId);

    // Validate inputs
    const userValidation = validateUserId(userId);
    if (!userValidation.valid) {
      throw new Error(`Invalid user ID: ${userValidation.error}`);
    }

    if (selector.type !== 'trace') {
      throw new Error(`Invalid selector type: ${selector.type}. Expected: trace`);
    }

    const traceSelector = selector as TraceDataSelector;

    // Import Supabase client
    const { supabase } = await import('@/lib/supabaseClient');

    // Build query
    let query = supabase
      .from('llm_traces')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', traceSelector.timeRange.start.toISOString())
      .lte('created_at', traceSelector.timeRange.end.toISOString())
      .order('created_at', { ascending: true });

    // Apply filters
    if (traceSelector.traceIds && traceSelector.traceIds.length > 0) {
      query = query.in('trace_id', traceSelector.traceIds);
    }

    if (traceSelector.filters) {
      const filters = traceSelector.filters;

      // Filter by model
      if (filters.models && filters.models.length > 0) {
        query = query.in('model', filters.models);
      }

      // Filter by operation
      if (filters.operations && filters.operations.length > 0) {
        query = query.in('operation', filters.operations);
      }

      // Filter by status
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Filter by duration
      if (filters.minDuration !== undefined) {
        query = query.gte('latency_ms', filters.minDuration);
      }
      if (filters.maxDuration !== undefined) {
        query = query.lte('latency_ms', filters.maxDuration);
      }

      // Filter by tags (if stored in metadata)
      if (filters.tags && filters.tags.length > 0) {
        // This would require JSONB query on metadata column
        // Simplified for now - can be enhanced with proper JSONB queries
        console.warn('[TraceDataLoader] Tag filtering not yet implemented');
      }
    }

    // Execute query
    const { data: dbTraces, error } = await query;

    if (error) {
      throw new Error(`Failed to load traces: ${error.message}`);
    }

    if (!dbTraces || dbTraces.length === 0) {
      console.warn('[TraceDataLoader] No traces found');
      return {
        type: 'trace',
        userId,
        data: {
          traces: [],
        },
        metadata: {
          traceCount: 0,
          dateRange: traceSelector.timeRange,
        },
      };
    }

    // Transform traces
    const traces: TraceData[] = dbTraces.map((trace: DBTrace) => ({
      trace_id: trace.trace_id,
      operation: trace.operation,
      model: trace.model,
      input_tokens: trace.input_tokens,
      output_tokens: trace.output_tokens,
      cache_read_input_tokens: trace.cache_read_input_tokens,
      cache_creation_input_tokens: trace.cache_creation_input_tokens,
      latency_ms: trace.latency_ms,
      cost: trace.cost,
      status: trace.status,
      error_type: trace.error_type,
      retry_count: trace.retry_count,
      retry_reason: trace.retry_reason,
      created_at: new Date(trace.created_at),
      metadata: trace.metadata,
    }));

    // Calculate summary if metrics requested
    let summary: TraceSummaryData | undefined;
    if (traceSelector.includeMetrics) {
      const successCount = traces.filter((t) => t.status === 'success').length;
      const failureCount = traces.filter((t) => t.status === 'failure').length;
      const avgLatency =
        traces.reduce((sum, t) => sum + t.latency_ms, 0) / traces.length;
      const totalTokens = traces.reduce(
        (sum, t) => sum + t.input_tokens + t.output_tokens,
        0
      );
      const totalCost = traces.reduce((sum, t) => sum + (t.cost || 0), 0);

      summary = {
        totalTraces: traces.length,
        successCount,
        failureCount,
        avgLatency,
        totalTokens,
        totalCost,
      };
    }

    // Build dataset
    const dataset: TraceDataset = {
      traces,
      summary,
    };

    // Calculate metadata
    const metadata: ExportMetadata = {
      traceCount: traces.length,
      dateRange: traceSelector.timeRange,
    };

    console.log('[TraceDataLoader] Data loaded successfully:', {
      traces: traces.length,
      dateRange: `${traceSelector.timeRange.start.toISOString()} to ${traceSelector.timeRange.end.toISOString()}`,
    });

    return {
      type: 'trace',
      userId,
      data: dataset,
      metadata,
    };
  }

  /**
   * Validate selector before loading
   */
  validate(selector: DataSelector): ValidationResult {
    if (selector.type !== 'trace') {
      return {
        valid: false,
        error: `Invalid selector type: ${selector.type}. Expected: trace`,
      };
    }

    return validateTraceSelector(selector as TraceDataSelector);
  }

  /**
   * Estimate size of export
   */
  async estimateSize(selector: DataSelector): Promise<number> {
    if (selector.type !== 'trace') {
      throw new Error(`Invalid selector type: ${selector.type}. Expected: trace`);
    }

    const traceSelector = selector as TraceDataSelector;

    // If specific trace IDs provided, estimate based on count
    if (traceSelector.traceIds && traceSelector.traceIds.length > 0) {
      const avgBytesPerTrace = 1000; // 1KB per trace
      return traceSelector.traceIds.length * avgBytesPerTrace;
    }

    // Otherwise use time range estimation
    return estimateDataSize(selector);
  }
}
