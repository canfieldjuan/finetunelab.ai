/**
 * Analytics Data Loader
 * Loads and aggregates analytics data from llm_traces table
 * Phase 2: Data Loaders
 */

import type {
  DataLoader,
  DataSelector,
  AnalyticsDataSelector,
  ExportData,
  AnalyticsDataset,
  TokenUsageData,
  QualityMetricsData,
  ToolUsageData,
  ConversationMetricsData,
  ErrorData,
  LatencyData,
  AggregationsData,
  TrendData,
  ExportMetadata,
  ValidationResult,
} from '../interfaces';
import { validateAnalyticsSelector, validateUserId, estimateDataSize } from '../utils/validation';
import type { JsonValue } from '@/lib/types';

interface DBTrace {
  trace_id: string;
  user_id: string;
  conversation_id?: string;
  operation: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  cost?: number;
  status: 'success' | 'failure';
  error_type?: string;
  tools_called?: JsonValue;
  rating?: number;
  created_at: string;
}

export class AnalyticsDataLoader implements DataLoader {
  /**
   * Load analytics data from database
   */
  async load(selector: DataSelector, userId: string): Promise<ExportData> {
    console.log('[AnalyticsDataLoader] Loading data for user:', userId);

    // Validate inputs
    const userValidation = validateUserId(userId);
    if (!userValidation.valid) {
      throw new Error(`Invalid user ID: ${userValidation.error}`);
    }

    if (selector.type !== 'analytics') {
      throw new Error(`Invalid selector type: ${selector.type}. Expected: analytics`);
    }

    const analyticsSelector = selector as AnalyticsDataSelector;

    // Import Supabase client
    const { supabase } = await import('@/lib/supabaseClient');

    // Load all traces in time range with filters
    let query = supabase
      .from('llm_traces')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', analyticsSelector.timeRange.start.toISOString())
      .lte('created_at', analyticsSelector.timeRange.end.toISOString())
      .order('created_at', { ascending: true });

    // Apply filters
    if (analyticsSelector.filters) {
      const filters = analyticsSelector.filters;

      if (filters.models && filters.models.length > 0) {
        query = query.in('model', filters.models);
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.trainingJobId) {
        query = query.eq('training_job_id', filters.trainingJobId);
      }

      if (filters.conversationIds && filters.conversationIds.length > 0) {
        query = query.in('conversation_id', filters.conversationIds);
      }

      if (filters.operationTypes && filters.operationTypes.length > 0) {
        query = query.in('operation', filters.operationTypes);
      }

      if (filters.minRating !== undefined) {
        query = query.gte('rating', filters.minRating);
      }
    }

    const { data: traces, error } = await query;

    if (error) {
      throw new Error(`Failed to load analytics data: ${error.message}`);
    }

    if (!traces || traces.length === 0) {
      console.warn('[AnalyticsDataLoader] No data found');
      return this.emptyDataset(userId, analyticsSelector);
    }

    // Build dataset based on metrics and export subtype
    const dataset = await this.buildDataset(
      traces as DBTrace[],
      analyticsSelector.metrics,
      analyticsSelector.exportSubType
    );

    // Calculate metadata
    const metadata: ExportMetadata = {
      dateRange: analyticsSelector.timeRange,
    };

    console.log('[AnalyticsDataLoader] Data loaded successfully:', {
      traces: traces.length,
      metrics: analyticsSelector.metrics.join(', '),
    });

    return {
      type: 'analytics',
      userId,
      data: dataset,
      metadata,
    };
  }

  /**
   * Build analytics dataset from traces
   */
  private async buildDataset(
    traces: DBTrace[],
    metrics: string[],
    exportSubType?: string
  ): Promise<AnalyticsDataset> {
    const dataset: AnalyticsDataset = {};

    // Token usage data
    if (metrics.includes('token_usage') || exportSubType === 'complete') {
      dataset.tokenUsage = this.aggregateTokenUsage(traces);
    }

    // Quality metrics
    if (metrics.includes('quality') || exportSubType === 'quality_trends') {
      dataset.quality = this.aggregateQualityMetrics(traces);
    }

    // Tool usage
    if (metrics.includes('tool_usage') || exportSubType === 'tool_usage') {
      dataset.tools = this.aggregateToolUsage(traces);
    }

    // Conversation metrics
    if (metrics.includes('conversations')) {
      dataset.conversations = this.aggregateConversationMetrics(traces);
    }

    // Errors
    if (metrics.includes('errors')) {
      dataset.errors = this.aggregateErrors(traces);
    }

    // Latency
    if (metrics.includes('latency')) {
      dataset.latency = this.aggregateLatency(traces);
    }

    // Aggregations (for overview/timeseries)
    if (exportSubType === 'overview' || exportSubType === 'timeseries' || exportSubType === 'model_comparison') {
      dataset.aggregations = this.calculateAggregations(traces);
    }

    return dataset;
  }

  /**
   * Aggregate token usage by date and model
   */
  private aggregateTokenUsage(traces: DBTrace[]): TokenUsageData[] {
    const byDateModel: Record<string, TokenUsageData> = {};

    traces.forEach((trace) => {
      const date = new Date(trace.created_at);
      date.setHours(0, 0, 0, 0); // Normalize to start of day
      const key = `${date.toISOString()}_${trace.model}`;

      if (!byDateModel[key]) {
        byDateModel[key] = {
          date,
          model: trace.model,
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          cost: 0,
        };
      }

      byDateModel[key].input_tokens += trace.input_tokens;
      byDateModel[key].output_tokens += trace.output_tokens;
      byDateModel[key].total_tokens += trace.input_tokens + trace.output_tokens;
      byDateModel[key].cost = (byDateModel[key].cost || 0) + (trace.cost || 0);
    });

    return Object.values(byDateModel).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Aggregate quality metrics by date and model
   */
  private aggregateQualityMetrics(traces: DBTrace[]): QualityMetricsData[] {
    const byDateModel: Record<string, { traces: DBTrace[]; date: Date; model: string }> = {};

    traces.forEach((trace) => {
      const date = new Date(trace.created_at);
      date.setHours(0, 0, 0, 0);
      const key = `${date.toISOString()}_${trace.model}`;

      if (!byDateModel[key]) {
        byDateModel[key] = {
          traces: [],
          date,
          model: trace.model,
        };
      }

      byDateModel[key].traces.push(trace);
    });

    return Object.values(byDateModel).map(({ traces: dayTraces, date, model }) => {
      const total = dayTraces.length;
      const successCount = dayTraces.filter((t) => t.status === 'success').length;
      const failureCount = dayTraces.filter((t) => t.status === 'failure').length;
      const errorCount = dayTraces.filter((t) => t.error_type).length;
      const ratingsCount = dayTraces.filter((t) => t.rating !== undefined).length;
      const avgRating = ratingsCount > 0
        ? dayTraces.reduce((sum, t) => sum + (t.rating || 0), 0) / ratingsCount
        : undefined;

      return {
        date,
        model,
        rating: avgRating,
        success_rate: successCount / total,
        failure_rate: failureCount / total,
        error_rate: errorCount / total,
      };
    }).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Aggregate tool usage
   */
  private aggregateToolUsage(traces: DBTrace[]): ToolUsageData[] {
    const toolStats: Record<string, {
      count: number;
      success: number;
      failure: number;
      totalDuration: number;
    }> = {};

    traces.forEach((trace) => {
      if (!trace.tools_called) return;

      const tools = Array.isArray(trace.tools_called)
        ? trace.tools_called
        : [trace.tools_called];

      tools.forEach((tool: unknown) => {
        const toolName = typeof tool === 'string' ? tool : (tool as { name?: string })?.name || 'unknown';

        if (!toolStats[toolName]) {
          toolStats[toolName] = {
            count: 0,
            success: 0,
            failure: 0,
            totalDuration: 0,
          };
        }

        toolStats[toolName].count++;
        if (trace.status === 'success') {
          toolStats[toolName].success++;
        } else {
          toolStats[toolName].failure++;
        }
        toolStats[toolName].totalDuration += trace.latency_ms;
      });
    });

    return Object.entries(toolStats).map(([toolName, stats]) => ({
      tool_name: toolName,
      execution_count: stats.count,
      success_count: stats.success,
      failure_count: stats.failure,
      avg_duration_ms: stats.totalDuration / stats.count,
    }));
  }

  /**
   * Aggregate conversation metrics
   */
  private aggregateConversationMetrics(traces: DBTrace[]): ConversationMetricsData[] {
    const byConversation: Record<string, {
      traces: DBTrace[];
      created_at: Date;
    }> = {};

    traces.forEach((trace) => {
      if (!trace.conversation_id) return;

      if (!byConversation[trace.conversation_id]) {
        byConversation[trace.conversation_id] = {
          traces: [],
          created_at: new Date(trace.created_at),
        };
      }

      byConversation[trace.conversation_id].traces.push(trace);
    });

    return Object.entries(byConversation).map(([convId, { traces: convTraces, created_at }]) => {
      const totalTokens = convTraces.reduce(
        (sum, t) => sum + t.input_tokens + t.output_tokens,
        0
      );
      const ratingsCount = convTraces.filter((t) => t.rating !== undefined).length;
      const avgRating = ratingsCount > 0
        ? convTraces.reduce((sum, t) => sum + (t.rating || 0), 0) / ratingsCount
        : undefined;

      return {
        conversation_id: convId,
        message_count: convTraces.length,
        total_tokens: totalTokens,
        avg_rating: avgRating,
        created_at,
      };
    });
  }

  /**
   * Aggregate errors
   */
  private aggregateErrors(traces: DBTrace[]): ErrorData[] {
    return traces
      .filter((trace) => trace.error_type)
      .map((trace) => ({
        timestamp: new Date(trace.created_at),
        error_type: trace.error_type!,
        error_message: `${trace.operation} failed`,
        model: trace.model,
        conversation_id: trace.conversation_id,
      }));
  }

  /**
   * Aggregate latency data
   */
  private aggregateLatency(traces: DBTrace[]): LatencyData[] {
    return traces.map((trace) => ({
      timestamp: new Date(trace.created_at),
      operation: trace.operation,
      latency_ms: trace.latency_ms,
      model: trace.model,
    }));
  }

  /**
   * Calculate overall aggregations
   */
  private calculateAggregations(traces: DBTrace[]): AggregationsData {
    const totalMessages = traces.length;
    const uniqueConversations = new Set(traces.map((t) => t.conversation_id).filter(Boolean));
    const totalTokens = traces.reduce((sum, t) => sum + t.input_tokens + t.output_tokens, 0);
    const totalCost = traces.reduce((sum, t) => sum + (t.cost || 0), 0);
    const ratingsCount = traces.filter((t) => t.rating !== undefined).length;
    const avgRating = ratingsCount > 0
      ? traces.reduce((sum, t) => sum + (t.rating || 0), 0) / ratingsCount
      : undefined;
    const avgLatency = traces.reduce((sum, t) => sum + t.latency_ms, 0) / totalMessages;
    const successCount = traces.filter((t) => t.status === 'success').length;
    const successRate = successCount / totalMessages;

    return {
      totalMessages,
      totalConversations: uniqueConversations.size,
      totalTokens,
      totalCost,
      avgRating,
      avgLatency,
      successRate,
    };
  }

  /**
   * Return empty dataset
   */
  private emptyDataset(userId: string, selector: AnalyticsDataSelector): ExportData {
    return {
      type: 'analytics',
      userId,
      data: {},
      metadata: {
        dateRange: selector.timeRange,
      },
    };
  }

  /**
   * Validate selector before loading
   */
  validate(selector: DataSelector): ValidationResult {
    if (selector.type !== 'analytics') {
      return {
        valid: false,
        error: `Invalid selector type: ${selector.type}. Expected: analytics`,
      };
    }

    return validateAnalyticsSelector(selector as AnalyticsDataSelector);
  }

  /**
   * Estimate size of export
   */
  async estimateSize(selector: DataSelector): Promise<number> {
    if (selector.type !== 'analytics') {
      throw new Error(`Invalid selector type: ${selector.type}. Expected: analytics`);
    }

    return estimateDataSize(selector);
  }
}
