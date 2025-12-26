/**
 * Traces Tool Handler
 *
 * Provides access to execution traces for debugging and performance analysis.
 * Operations:
 * - get_traces: Retrieve filtered traces
 * - get_trace_details: Single trace with full hierarchy
 * - compare_traces: Compare metrics across traces
 * - get_trace_summary: Aggregate statistics
 * - get_rag_metrics: RAG-specific analysis
 * - get_performance_stats: Performance profiling
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface GetTracesArgs {
  operation: 'get_traces' | 'get_trace_details' | 'compare_traces' |
             'get_trace_summary' | 'get_rag_metrics' | 'get_performance_stats';

  // Filtering
  conversation_id?: string;
  trace_id?: string;
  message_id?: string;
  session_tag?: string;
  operation_type?: string;
  model_name?: string;
  model_provider?: string;
  status?: 'pending' | 'completed' | 'error';

  // Time range
  start_date?: string;
  end_date?: string;

  // Performance filters
  min_duration_ms?: number;
  max_duration_ms?: number;
  min_cost_usd?: number;
  streaming_only?: boolean;

  // RAG filters
  rag_used?: boolean;
  min_groundedness_score?: number;

  // Comparison
  trace_ids?: string[];
  compare_by?: 'duration' | 'tokens' | 'cost' | 'quality' | 'rag_performance';

  // Pagination
  limit?: number;
  offset?: number;

  // Options
  include_hierarchy?: boolean;
  include_quality_data?: boolean;
  include_input_output?: boolean;
}

export async function executeGetTraces(
  args: Record<string, unknown>,
  userId: string,
  authHeader?: string,
  authClient?: any
): Promise<any> {
  console.log('[GetTraces] Executing:', args.operation);

  const typedArgs = args as unknown as GetTracesArgs;

  try {
    switch (typedArgs.operation) {
      case 'get_traces':
        return await getTraces(typedArgs, userId, authHeader!);

      case 'get_trace_details':
        return await getTraceDetails(typedArgs, userId, authHeader!);

      case 'compare_traces':
        return await compareTraces(typedArgs, userId, authHeader!);

      case 'get_trace_summary':
        return await getTraceSummary(typedArgs, userId, authHeader!);

      case 'get_rag_metrics':
        return await getRagMetrics(typedArgs, userId, authHeader!);

      case 'get_performance_stats':
        return await getPerformanceStats(typedArgs, userId, authHeader!);

      default:
        return { error: `Unknown operation: ${typedArgs.operation}` };
    }
  } catch (error) {
    console.error('[GetTraces] Error:', error);
    return {
      error: error instanceof Error ? error.message : 'Traces operation failed'
    };
  }
}

/**
 * Get filtered traces
 */
async function getTraces(args: GetTracesArgs, userId: string, authHeader: string): Promise<any> {
  console.log('[GetTraces] Fetching traces with filters:', {
    conversation_id: args.conversation_id,
    operation_type: args.operation_type,
    status: args.status
  });

  try {
    // Build query parameters
    const params = new URLSearchParams();

    if (args.conversation_id) params.append('conversation_id', args.conversation_id);
    if (args.trace_id) params.append('trace_id', args.trace_id);
    if (args.message_id) params.append('message_id', args.message_id);
    if (args.operation_type) params.append('operation_type', args.operation_type);
    if (args.status) params.append('status', args.status);
    if (args.limit) params.append('limit', args.limit.toString());
    if (args.offset) params.append('offset', args.offset.toString());

    // Call existing traces API
    const url = `${appUrl}/api/analytics/traces?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: `Failed to fetch traces: ${response.status}`,
        details: errorText.slice(0, 200)
      };
    }

    const data = await response.json();
    const traces = data.data || [];

    // Additional filtering (not supported by API)
    let filteredTraces = traces;

    // Filter by session_tag
    if (args.session_tag) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.session_tag === args.session_tag
      );
    }

    // Filter by model
    if (args.model_name) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.model_name?.includes(args.model_name!)
      );
    }

    if (args.model_provider) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.model_provider === args.model_provider
      );
    }

    // Filter by time range
    if (args.start_date) {
      const startTime = new Date(args.start_date).getTime();
      filteredTraces = filteredTraces.filter((t: any) =>
        new Date(t.start_time).getTime() >= startTime
      );
    }

    if (args.end_date) {
      const endTime = new Date(args.end_date).getTime();
      filteredTraces = filteredTraces.filter((t: any) =>
        new Date(t.start_time).getTime() <= endTime
      );
    }

    // Filter by performance
    if (args.min_duration_ms !== undefined) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.duration_ms && t.duration_ms >= args.min_duration_ms!
      );
    }

    if (args.max_duration_ms !== undefined) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.duration_ms && t.duration_ms <= args.max_duration_ms!
      );
    }

    if (args.min_cost_usd !== undefined) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.cost_usd && t.cost_usd >= args.min_cost_usd!
      );
    }

    if (args.streaming_only) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.streaming_enabled === true
      );
    }

    // Filter by RAG
    if (args.rag_used !== undefined) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.rag_graph_used === args.rag_used
      );
    }

    if (args.min_groundedness_score !== undefined) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.groundedness_score && t.groundedness_score >= args.min_groundedness_score!
      );
    }

    // Format response for LLM
    const formattedTraces = filteredTraces.map((trace: any) => {
      const formatted: any = {
        trace_id: trace.trace_id,
        span_id: trace.span_id,
        span_name: trace.span_name,
        operation_type: trace.operation_type,
        status: trace.status,

        // Timing
        start_time: trace.start_time,
        duration_ms: trace.duration_ms,
        ttft_ms: trace.ttft_ms,

        // Model
        model_name: trace.model_name,
        model_provider: trace.model_provider,

        // Tokens & Cost
        input_tokens: trace.input_tokens,
        output_tokens: trace.output_tokens,
        total_tokens: trace.total_tokens,
        cost_usd: trace.cost_usd,

        // Context
        conversation_id: trace.conversation_id,
        message_id: trace.message_id,
        session_tag: trace.session_tag
      };

      // Add performance metrics if available
      if (trace.queue_time_ms || trace.inference_time_ms || trace.network_time_ms) {
        formatted.performance = {
          queue_time_ms: trace.queue_time_ms,
          inference_time_ms: trace.inference_time_ms,
          network_time_ms: trace.network_time_ms,
          tokens_per_second: trace.tokens_per_second,
          streaming_enabled: trace.streaming_enabled
        };
      }

      // Add RAG metrics if available
      if (trace.rag_graph_used) {
        formatted.rag_metrics = {
          rag_graph_used: trace.rag_graph_used,
          rag_nodes_retrieved: trace.rag_nodes_retrieved,
          rag_chunks_used: trace.rag_chunks_used,
          rag_relevance_score: trace.rag_relevance_score,
          rag_answer_grounded: trace.rag_answer_grounded,
          retrieval_latency_ms: trace.retrieval_latency_ms,
          context_tokens: trace.context_tokens
        };
      }

      // Add quality data if included
      if (args.include_quality_data !== false && (trace.judgments || trace.user_rating)) {
        formatted.quality = {
          judgments: trace.judgments,
          user_rating: trace.user_rating,
          user_notes: trace.user_notes,
          groundedness_score: trace.groundedness_score
        };
      }

      // Add error info if failed
      if (trace.status === 'error') {
        formatted.error = {
          error_message: trace.error_message,
          error_type: trace.error_type
        };
      }

      // Add I/O data if requested
      if (args.include_input_output && (trace.input_data || trace.output_data)) {
        formatted.input_data = trace.input_data;
        formatted.output_data = trace.output_data;
      }

      return formatted;
    });

    return {
      success: true,
      traces: formattedTraces,
      total_count: filteredTraces.length,
      filters_applied: {
        conversation_id: args.conversation_id,
        session_tag: args.session_tag,
        operation_type: args.operation_type,
        model_name: args.model_name,
        status: args.status,
        rag_used: args.rag_used
      },
      pagination: {
        limit: args.limit || 50,
        offset: args.offset || 0
      }
    };

  } catch (error) {
    console.error('[GetTraces] getTraces error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get traces'
    };
  }
}

/**
 * Get single trace with hierarchy
 */
async function getTraceDetails(args: GetTracesArgs, userId: string, authHeader: string): Promise<any> {
  console.log('[GetTraces] Getting trace details:', args.trace_id);

  if (!args.trace_id) {
    return { error: 'trace_id is required for get_trace_details operation' };
  }

  try {
    // Call API with trace_id to get hierarchical structure
    const url = `${appUrl}/api/analytics/traces?trace_id=${args.trace_id}&limit=1000`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    });

    if (!response.ok) {
      return { error: `Failed to fetch trace: ${response.status}` };
    }

    const data = await response.json();
    const traceHierarchy = data.data;

    if (!traceHierarchy || traceHierarchy.length === 0) {
      return { error: 'Trace not found' };
    }

    // API returns hierarchical structure when trace_id is provided
    const rootTrace = traceHierarchy[0];

    return {
      success: true,
      trace: rootTrace,
      summary: {
        total_spans: countSpans(rootTrace),
        total_duration_ms: rootTrace.duration_ms,
        total_tokens: rootTrace.total_tokens,
        total_cost_usd: rootTrace.cost_usd,
        has_errors: hasErrors(rootTrace),
        child_traces: rootTrace.children?.length || 0
      }
    };

  } catch (error) {
    console.error('[GetTraces] getTraceDetails error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get trace details'
    };
  }
}

/**
 * Compare multiple traces
 */
async function compareTraces(args: GetTracesArgs, userId: string, authHeader: string): Promise<any> {
  console.log('[GetTraces] Comparing traces:', args.trace_ids);

  if (!args.trace_ids || args.trace_ids.length < 2) {
    return { error: 'At least 2 trace_ids required for comparison' };
  }

  if (args.trace_ids.length > 10) {
    return { error: 'Maximum 10 traces can be compared at once' };
  }

  try {
    // Fetch all traces
    const tracePromises = args.trace_ids.map(traceId =>
      fetch(`${appUrl}/api/analytics/traces?trace_id=${traceId}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      }).then(res => res.json())
    );

    const results = await Promise.all(tracePromises);
    const traces = results
      .filter(r => r.success && r.data?.length > 0)
      .map(r => r.data[0]);

    if (traces.length < 2) {
      return { error: 'Could not find enough traces to compare' };
    }

    // Compare by specified metric
    const compareBy = args.compare_by || 'duration';

    const comparison: any = {
      traces_compared: traces.length,
      compare_by: compareBy,
      traces: []
    };

    switch (compareBy) {
      case 'duration':
        comparison.traces = traces.map((t: any) => ({
          trace_id: t.trace_id,
          span_name: t.span_name,
          duration_ms: t.duration_ms,
          ttft_ms: t.ttft_ms,
          tokens_per_second: t.tokens_per_second,
          model_name: t.model_name
        })).sort((a: any, b: any) => (b.duration_ms || 0) - (a.duration_ms || 0));

        comparison.fastest = comparison.traces[comparison.traces.length - 1];
        comparison.slowest = comparison.traces[0];
        comparison.avg_duration_ms = average(traces.map((t: any) => t.duration_ms || 0));
        break;

      case 'tokens':
        comparison.traces = traces.map((t: any) => ({
          trace_id: t.trace_id,
          span_name: t.span_name,
          input_tokens: t.input_tokens,
          output_tokens: t.output_tokens,
          total_tokens: t.total_tokens,
          model_name: t.model_name
        })).sort((a: any, b: any) => (b.total_tokens || 0) - (a.total_tokens || 0));

        comparison.total_tokens_sum = sum(traces.map((t: any) => t.total_tokens || 0));
        comparison.avg_tokens = average(traces.map((t: any) => t.total_tokens || 0));
        break;

      case 'cost':
        comparison.traces = traces.map((t: any) => ({
          trace_id: t.trace_id,
          span_name: t.span_name,
          cost_usd: t.cost_usd,
          total_tokens: t.total_tokens,
          cost_per_1k_tokens: t.cost_usd && t.total_tokens
            ? (t.cost_usd / t.total_tokens) * 1000
            : null,
          model_name: t.model_name
        })).sort((a: any, b: any) => (b.cost_usd || 0) - (a.cost_usd || 0));

        comparison.total_cost_usd = sum(traces.map((t: any) => t.cost_usd || 0));
        comparison.avg_cost_usd = average(traces.map((t: any) => t.cost_usd || 0));
        comparison.most_expensive = comparison.traces[0];
        comparison.least_expensive = comparison.traces[comparison.traces.length - 1];
        break;

      case 'quality':
        comparison.traces = traces.map((t: any) => ({
          trace_id: t.trace_id,
          span_name: t.span_name,
          groundedness_score: t.groundedness_score,
          user_rating: t.user_rating,
          judgments_passed: t.judgments?.filter((j: any) => j.passed).length || 0,
          judgments_total: t.judgments?.length || 0,
          model_name: t.model_name
        }));

        comparison.avg_groundedness = average(
          traces.map((t: any) => t.groundedness_score).filter((s: any) => s !== null)
        );
        break;

      case 'rag_performance':
        const ragTraces = traces.filter((t: any) => t.rag_graph_used);
        comparison.traces = ragTraces.map((t: any) => ({
          trace_id: t.trace_id,
          span_name: t.span_name,
          rag_nodes_retrieved: t.rag_nodes_retrieved,
          rag_chunks_used: t.rag_chunks_used,
          rag_relevance_score: t.rag_relevance_score,
          retrieval_latency_ms: t.retrieval_latency_ms,
          groundedness_score: t.groundedness_score,
          model_name: t.model_name
        }));

        comparison.avg_retrieval_latency_ms = average(
          ragTraces.map((t: any) => t.retrieval_latency_ms || 0)
        );
        comparison.avg_relevance_score = average(
          ragTraces.map((t: any) => t.rag_relevance_score).filter((s: any) => s !== null)
        );
        break;
    }

    return {
      success: true,
      comparison
    };

  } catch (error) {
    console.error('[GetTraces] compareTraces error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to compare traces'
    };
  }
}

/**
 * Get aggregate trace summary
 */
async function getTraceSummary(args: GetTracesArgs, userId: string, authHeader: string): Promise<any> {
  console.log('[GetTraces] Getting trace summary');

  try {
    // Get traces with same filters as get_traces
    const tracesResult = await getTraces(args, userId, authHeader);

    if (!tracesResult.success) {
      return tracesResult;
    }

    const traces = tracesResult.traces;

    if (traces.length === 0) {
      return {
        success: true,
        summary: {
          total_traces: 0,
          message: 'No traces found matching filters'
        }
      };
    }

    // Calculate aggregate statistics
    const summary = {
      total_traces: traces.length,

      // Status breakdown
      status_breakdown: {
        completed: traces.filter((t: any) => t.status === 'completed').length,
        pending: traces.filter((t: any) => t.status === 'pending').length,
        error: traces.filter((t: any) => t.status === 'error').length
      },

      // Operation types
      operation_types: groupBy(traces, 'operation_type'),

      // Model breakdown
      models_used: groupBy(traces, 'model_name'),

      // Timing statistics
      timing: {
        avg_duration_ms: average(traces.map((t: any) => t.duration_ms || 0)),
        min_duration_ms: Math.min(...traces.map((t: any) => t.duration_ms || 0)),
        max_duration_ms: Math.max(...traces.map((t: any) => t.duration_ms || 0)),
        avg_ttft_ms: average(
          traces.filter((t: any) => t.ttft_ms !== null).map((t: any) => t.ttft_ms)
        )
      },

      // Token statistics
      tokens: {
        total_input_tokens: sum(traces.map((t: any) => t.input_tokens || 0)),
        total_output_tokens: sum(traces.map((t: any) => t.output_tokens || 0)),
        total_tokens: sum(traces.map((t: any) => t.total_tokens || 0)),
        avg_tokens_per_trace: average(traces.map((t: any) => t.total_tokens || 0))
      },

      // Cost statistics
      cost: {
        total_cost_usd: sum(traces.map((t: any) => t.cost_usd || 0)),
        avg_cost_per_trace: average(traces.map((t: any) => t.cost_usd || 0)),
        cost_by_model: groupBySum(traces, 'model_name', 'cost_usd')
      },

      // RAG statistics
      rag: {
        traces_with_rag: traces.filter((t: any) => t.rag_metrics?.rag_graph_used).length,
        avg_rag_relevance: average(
          traces
            .filter((t: any) => t.rag_metrics?.rag_relevance_score !== null)
            .map((t: any) => t.rag_metrics.rag_relevance_score)
        ),
        avg_retrieval_latency_ms: average(
          traces
            .filter((t: any) => t.rag_metrics?.retrieval_latency_ms)
            .map((t: any) => t.rag_metrics.retrieval_latency_ms)
        )
      },

      // Performance
      performance: {
        streaming_traces: traces.filter((t: any) =>
          t.performance?.streaming_enabled === true
        ).length,
        avg_tokens_per_second: average(
          traces
            .filter((t: any) => t.performance?.tokens_per_second)
            .map((t: any) => t.performance.tokens_per_second)
        )
      },

      // Time range
      time_range: {
        earliest_trace: traces[traces.length - 1]?.start_time,
        latest_trace: traces[0]?.start_time
      }
    };

    return {
      success: true,
      summary,
      filters_applied: tracesResult.filters_applied
    };

  } catch (error) {
    console.error('[GetTraces] getTraceSummary error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get trace summary'
    };
  }
}

/**
 * Get RAG-specific metrics
 */
async function getRagMetrics(args: GetTracesArgs, userId: string, authHeader: string): Promise<any> {
  console.log('[GetTraces] Getting RAG metrics');

  try {
    // Get traces filtered for RAG usage
    const ragArgs = { ...args, rag_used: true };
    const tracesResult = await getTraces(ragArgs, userId, authHeader);

    if (!tracesResult.success) {
      return tracesResult;
    }

    const ragTraces = tracesResult.traces.filter((t: any) => t.rag_metrics);

    if (ragTraces.length === 0) {
      return {
        success: true,
        rag_metrics: {
          total_rag_traces: 0,
          message: 'No traces with RAG found matching filters'
        }
      };
    }

    const ragMetrics = {
      total_rag_traces: ragTraces.length,

      // Retrieval statistics
      retrieval: {
        avg_nodes_retrieved: average(
          ragTraces.map((t: any) => t.rag_metrics.rag_nodes_retrieved || 0)
        ),
        avg_chunks_used: average(
          ragTraces.map((t: any) => t.rag_metrics.rag_chunks_used || 0)
        ),
        avg_retrieval_latency_ms: average(
          ragTraces.map((t: any) => t.rag_metrics.retrieval_latency_ms || 0)
        )
      },

      // Quality metrics
      quality: {
        avg_relevance_score: average(
          ragTraces
            .filter((t: any) => t.rag_metrics.rag_relevance_score !== null)
            .map((t: any) => t.rag_metrics.rag_relevance_score)
        ),
        avg_groundedness_score: average(
          ragTraces
            .filter((t: any) => t.quality?.groundedness_score !== null)
            .map((t: any) => t.quality.groundedness_score)
        ),
        grounded_answers: ragTraces.filter((t: any) =>
          t.rag_metrics.rag_answer_grounded === true
        ).length,
        grounded_percentage: (
          ragTraces.filter((t: any) =>
            t.rag_metrics.rag_answer_grounded === true
          ).length / ragTraces.length
        ) * 100
      },

      // Context usage
      context: {
        avg_context_tokens: average(
          ragTraces.map((t: any) => t.rag_metrics.context_tokens || 0)
        ),
        total_context_tokens: sum(
          ragTraces.map((t: any) => t.rag_metrics.context_tokens || 0)
        )
      },

      // Performance impact
      performance_impact: {
        avg_total_duration_ms: average(
          ragTraces.map((t: any) => t.duration_ms || 0)
        ),
        retrieval_latency_percentage: (
          average(ragTraces.map((t: any) => t.rag_metrics.retrieval_latency_ms || 0)) /
          average(ragTraces.map((t: any) => t.duration_ms || 1))
        ) * 100
      }
    };

    return {
      success: true,
      rag_metrics: ragMetrics,
      filters_applied: tracesResult.filters_applied
    };

  } catch (error) {
    console.error('[GetTraces] getRagMetrics error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get RAG metrics'
    };
  }
}

/**
 * Get performance statistics
 */
async function getPerformanceStats(args: GetTracesArgs, userId: string, authHeader: string): Promise<any> {
  console.log('[GetTraces] Getting performance stats');

  try {
    const tracesResult = await getTraces(args, userId, authHeader);

    if (!tracesResult.success) {
      return tracesResult;
    }

    const traces = tracesResult.traces;

    if (traces.length === 0) {
      return {
        success: true,
        performance_stats: {
          total_traces: 0,
          message: 'No traces found matching filters'
        }
      };
    }

    // Separate streaming vs non-streaming
    const streamingTraces = traces.filter((t: any) => t.performance?.streaming_enabled);
    const nonStreamingTraces = traces.filter((t: any) =>
      t.performance?.streaming_enabled === false || !t.performance?.streaming_enabled
    );

    const performanceStats = {
      total_traces: traces.length,

      // Overall timing
      timing: {
        avg_duration_ms: average(traces.map((t: any) => t.duration_ms || 0)),
        p50_duration_ms: percentile(traces.map((t: any) => t.duration_ms || 0), 50),
        p95_duration_ms: percentile(traces.map((t: any) => t.duration_ms || 0), 95),
        p99_duration_ms: percentile(traces.map((t: any) => t.duration_ms || 0), 99),
        min_duration_ms: Math.min(...traces.map((t: any) => t.duration_ms || 0)),
        max_duration_ms: Math.max(...traces.map((t: any) => t.duration_ms || 0))
      },

      // Streaming vs Non-streaming
      streaming_comparison: {
        streaming_count: streamingTraces.length,
        non_streaming_count: nonStreamingTraces.length,
        streaming_avg_duration_ms: average(
          streamingTraces.map((t: any) => t.duration_ms || 0)
        ),
        non_streaming_avg_duration_ms: average(
          nonStreamingTraces.map((t: any) => t.duration_ms || 0)
        ),
        streaming_avg_ttft_ms: average(
          streamingTraces.filter((t: any) => t.ttft_ms).map((t: any) => t.ttft_ms)
        ),
        streaming_avg_tokens_per_sec: average(
          streamingTraces
            .filter((t: any) => t.performance?.tokens_per_second)
            .map((t: any) => t.performance.tokens_per_second)
        )
      },

      // Latency breakdown
      latency_breakdown: {
        avg_queue_time_ms: average(
          traces
            .filter((t: any) => t.performance?.queue_time_ms)
            .map((t: any) => t.performance.queue_time_ms)
        ),
        avg_inference_time_ms: average(
          traces
            .filter((t: any) => t.performance?.inference_time_ms)
            .map((t: any) => t.performance.inference_time_ms)
        ),
        avg_network_time_ms: average(
          traces
            .filter((t: any) => t.performance?.network_time_ms)
            .map((t: any) => t.performance.network_time_ms)
        )
      },

      // Performance by model
      by_model: {},

      // Slowest traces
      slowest_traces: traces
        .sort((a: any, b: any) => (b.duration_ms || 0) - (a.duration_ms || 0))
        .slice(0, 5)
        .map((t: any) => ({
          trace_id: t.trace_id,
          span_name: t.span_name,
          duration_ms: t.duration_ms,
          model_name: t.model_name,
          total_tokens: t.total_tokens
        })),

      // Error rate
      errors: {
        total_errors: traces.filter((t: any) => t.status === 'error').length,
        error_rate: (
          traces.filter((t: any) => t.status === 'error').length / traces.length
        ) * 100
      }
    };

    // Group performance by model
    const modelGroups = groupBy(traces, 'model_name');
    for (const [model, count] of Object.entries(modelGroups)) {
      const modelTraces = traces.filter((t: any) => (t.model_name || 'unknown') === model);
      (performanceStats.by_model as any)[model] = {
        trace_count: count,
        avg_duration_ms: average(modelTraces.map((t: any) => t.duration_ms || 0)),
        avg_tokens_per_second: average(
          modelTraces
            .filter((t: any) => t.performance?.tokens_per_second)
            .map((t: any) => t.performance.tokens_per_second)
        ),
        avg_cost_usd: average(modelTraces.map((t: any) => t.cost_usd || 0))
      };
    }

    return {
      success: true,
      performance_stats: performanceStats,
      filters_applied: tracesResult.filters_applied
    };

  } catch (error) {
    console.error('[GetTraces] getPerformanceStats error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get performance stats'
    };
  }
}

// Helper functions

function countSpans(trace: any): number {
  let count = 1;
  if (trace.children) {
    for (const child of trace.children) {
      count += countSpans(child);
    }
  }
  return count;
}

function hasErrors(trace: any): boolean {
  if (trace.status === 'error') return true;
  if (trace.children) {
    for (const child of trace.children) {
      if (hasErrors(child)) return true;
    }
  }
  return false;
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

function sum(numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

function groupBy(items: any[], key: string): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const item of items) {
    const value = item[key] || 'unknown';
    groups[value] = (groups[value] || 0) + 1;
  }
  return groups;
}

function groupBySum(items: any[], groupKey: string, sumKey: string): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const item of items) {
    const group = item[groupKey] || 'unknown';
    const value = item[sumKey] || 0;
    groups[group] = (groups[group] || 0) + value;
  }
  return groups;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
