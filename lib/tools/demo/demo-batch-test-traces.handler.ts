/**
 * Demo Batch Test Traces Tool Handler
 *
 * Session-scoped tool for Atlas to analyze batch test results.
 * Similar to get_traces tool, but queries demo_batch_test_results table
 * filtered by demo_session_id instead of llm_traces filtered by user_id.
 *
 * Operations:
 * - get_batch_results: Retrieve filtered batch test results
 * - get_batch_summary: Aggregate statistics
 * - get_performance_stats: Performance profiling
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface GetBatchResultsArgs {
  operation: 'get_batch_results' | 'get_batch_summary' | 'get_performance_stats';

  // Filtering
  success_only?: boolean;
  failed_only?: boolean;
  min_latency_ms?: number;
  max_latency_ms?: number;
  min_tokens?: number;

  // Pagination
  limit?: number;
  offset?: number;
}

interface BatchTestResult {
  id: string;
  test_run_id: string;
  demo_session_id: string;
  prompt: string;
  response?: string;
  latency_ms?: number;
  success: boolean;
  error?: string;
  model_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at: string;
}

export async function executeDemoBatchTestTraces(
  args: Record<string, unknown>,
  sessionId: string
): Promise<unknown> {
  console.log('[DemoBatchTestTraces] Executing:', args.operation, 'for session:', sessionId);

  const typedArgs = args as unknown as GetBatchResultsArgs;

  try {
    switch (typedArgs.operation) {
      case 'get_batch_results':
        return await getBatchResults(typedArgs, sessionId);

      case 'get_batch_summary':
        return await getBatchSummary(typedArgs, sessionId);

      case 'get_performance_stats':
        return await getPerformanceStats(typedArgs, sessionId);

      default:
        return { error: `Unknown operation: ${typedArgs.operation}` };
    }
  } catch (error) {
    console.error('[DemoBatchTestTraces] Error:', error);
    return {
      error: error instanceof Error ? error.message : 'Batch test traces operation failed'
    };
  }
}

/**
 * Get filtered batch test results
 */
async function getBatchResults(args: GetBatchResultsArgs, sessionId: string): Promise<unknown> {
  console.log('[DemoBatchTestTraces] Fetching batch results with filters:', {
    sessionId,
    success_only: args.success_only,
    failed_only: args.failed_only
  });

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Build query filtered by session
    let query = supabase
      .from('demo_batch_test_results')
      .select('*')
      .eq('demo_session_id', sessionId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (args.success_only) {
      query = query.eq('success', true);
    }
    if (args.failed_only) {
      query = query.eq('success', false);
    }
    if (args.min_latency_ms !== undefined) {
      query = query.gte('latency_ms', args.min_latency_ms);
    }
    if (args.max_latency_ms !== undefined) {
      query = query.lte('latency_ms', args.max_latency_ms);
    }

    // Apply pagination
    const limit = args.limit || 50;
    const offset = args.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data: results, error: queryError } = await query;

    if (queryError) {
      console.error('[DemoBatchTestTraces] Query error:', queryError);
      return {
        error: `Failed to retrieve batch results: ${queryError.message}`
      };
    }

    const batchResults = (results ?? []) as BatchTestResult[];

    // Filter by tokens if specified (post-query since Supabase may not handle null comparisons well)
    let filteredResults = batchResults;
    if (args.min_tokens !== undefined) {
      filteredResults = filteredResults.filter(r =>
        (r.input_tokens || 0) + (r.output_tokens || 0) >= args.min_tokens!
      );
    }

    // Format response for LLM
    const formattedResults = filteredResults.map(result => ({
      id: result.id,
      prompt: result.prompt,
      response: result.response?.substring(0, 200) + (result.response && result.response.length > 200 ? '...' : ''), // Truncate for token efficiency
      latency_ms: result.latency_ms,
      success: result.success,
      error: result.error,
      model_id: result.model_id,
      tokens: {
        input: result.input_tokens,
        output: result.output_tokens,
        total: (result.input_tokens || 0) + (result.output_tokens || 0)
      },
      created_at: result.created_at
    }));

    return {
      success: true,
      batch_results: formattedResults,
      total_count: filteredResults.length,
      session_id: sessionId,
      filters_applied: {
        success_only: args.success_only,
        failed_only: args.failed_only,
        min_latency_ms: args.min_latency_ms,
        max_latency_ms: args.max_latency_ms,
        min_tokens: args.min_tokens
      },
      pagination: {
        limit,
        offset
      }
    };

  } catch (error) {
    console.error('[DemoBatchTestTraces] getBatchResults error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get batch results'
    };
  }
}

/**
 * Get aggregate batch summary
 */
async function getBatchSummary(args: GetBatchResultsArgs, sessionId: string): Promise<unknown> {
  console.log('[DemoBatchTestTraces] Getting batch summary for session:', sessionId);

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get all results for this session
    const { data: results, error: queryError } = await supabase
      .from('demo_batch_test_results')
      .select('*')
      .eq('demo_session_id', sessionId);

    if (queryError) {
      console.error('[DemoBatchTestTraces] Query error:', queryError);
      return {
        error: `Failed to retrieve batch results: ${queryError.message}`
      };
    }

    const batchResults = (results ?? []) as BatchTestResult[];

    if (batchResults.length === 0) {
      return {
        success: true,
        summary: {
          total_results: 0,
          message: 'No batch test results found for this session'
        }
      };
    }

    // Calculate aggregate statistics
    const successful = batchResults.filter(r => r.success);
    const failed = batchResults.filter(r => !r.success);

    const latencies = batchResults
      .filter(r => r.latency_ms !== null && r.latency_ms !== undefined)
      .map(r => r.latency_ms!);

    const totalInputTokens = batchResults.reduce((sum, r) => sum + (r.input_tokens || 0), 0);
    const totalOutputTokens = batchResults.reduce((sum, r) => sum + (r.output_tokens || 0), 0);

    const summary = {
      total_results: batchResults.length,
      session_id: sessionId,

      // Success metrics
      success_breakdown: {
        successful: successful.length,
        failed: failed.length,
        success_rate: (successful.length / batchResults.length) * 100
      },

      // Performance metrics
      performance: {
        avg_latency_ms: average(latencies),
        min_latency_ms: Math.min(...latencies),
        max_latency_ms: Math.max(...latencies),
        p50_latency_ms: percentile(latencies, 50),
        p95_latency_ms: percentile(latencies, 95)
      },

      // Token usage
      token_usage: {
        total_input_tokens: totalInputTokens,
        total_output_tokens: totalOutputTokens,
        total_tokens: totalInputTokens + totalOutputTokens,
        avg_input_tokens: average(batchResults.map(r => r.input_tokens || 0)),
        avg_output_tokens: average(batchResults.map(r => r.output_tokens || 0)),
        avg_total_tokens: average(batchResults.map(r => (r.input_tokens || 0) + (r.output_tokens || 0)))
      },

      // Response metrics
      response_metrics: {
        avg_response_length: average(
          batchResults
            .filter(r => r.response)
            .map(r => r.response!.length)
        ),
        responses_with_content: batchResults.filter(r => r.response && r.response.length > 0).length
      },

      // Error analysis
      errors: failed.length > 0 ? {
        total_errors: failed.length,
        error_rate: (failed.length / batchResults.length) * 100,
        error_messages: [...new Set(failed.map(r => r.error).filter(Boolean))]
      } : null,

      // Model used
      model_id: batchResults[0]?.model_id || 'unknown'
    };

    return {
      success: true,
      summary
    };

  } catch (error) {
    console.error('[DemoBatchTestTraces] getBatchSummary error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get batch summary'
    };
  }
}

/**
 * Get performance statistics
 */
async function getPerformanceStats(args: GetBatchResultsArgs, sessionId: string): Promise<unknown> {
  console.log('[DemoBatchTestTraces] Getting performance stats for session:', sessionId);

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: results, error: queryError } = await supabase
      .from('demo_batch_test_results')
      .select('*')
      .eq('demo_session_id', sessionId);

    if (queryError) {
      return {
        error: `Failed to retrieve batch results: ${queryError.message}`
      };
    }

    const batchResults = (results ?? []) as BatchTestResult[];

    if (batchResults.length === 0) {
      return {
        success: true,
        performance_stats: {
          total_results: 0,
          message: 'No batch test results found for this session'
        }
      };
    }

    const latencies = batchResults
      .filter(r => r.latency_ms !== null && r.latency_ms !== undefined)
      .map(r => r.latency_ms!);

    const performanceStats = {
      total_results: batchResults.length,
      session_id: sessionId,

      // Latency distribution
      latency_distribution: {
        avg_latency_ms: average(latencies),
        median_latency_ms: percentile(latencies, 50),
        p75_latency_ms: percentile(latencies, 75),
        p90_latency_ms: percentile(latencies, 90),
        p95_latency_ms: percentile(latencies, 95),
        p99_latency_ms: percentile(latencies, 99),
        min_latency_ms: Math.min(...latencies),
        max_latency_ms: Math.max(...latencies)
      },

      // Success vs failure performance
      performance_by_outcome: {
        successful_avg_latency_ms: average(
          batchResults.filter(r => r.success).map(r => r.latency_ms || 0)
        ),
        failed_avg_latency_ms: average(
          batchResults.filter(r => !r.success).map(r => r.latency_ms || 0)
        )
      },

      // Token efficiency
      token_efficiency: {
        tokens_per_second: batchResults.filter(r => r.latency_ms && r.latency_ms > 0).map(r => {
          const totalTokens = (r.input_tokens || 0) + (r.output_tokens || 0);
          const seconds = (r.latency_ms || 1) / 1000;
          return totalTokens / seconds;
        }),
        avg_tokens_per_second: average(
          batchResults.filter(r => r.latency_ms && r.latency_ms > 0).map(r => {
            const totalTokens = (r.input_tokens || 0) + (r.output_tokens || 0);
            const seconds = (r.latency_ms || 1) / 1000;
            return totalTokens / seconds;
          })
        )
      },

      // Slowest and fastest
      outliers: {
        slowest_results: batchResults
          .sort((a, b) => (b.latency_ms || 0) - (a.latency_ms || 0))
          .slice(0, 3)
          .map(r => ({
            prompt: r.prompt.substring(0, 100) + '...',
            latency_ms: r.latency_ms,
            success: r.success,
            tokens: (r.input_tokens || 0) + (r.output_tokens || 0)
          })),
        fastest_results: batchResults
          .filter(r => r.success) // Only successful ones
          .sort((a, b) => (a.latency_ms || 0) - (b.latency_ms || 0))
          .slice(0, 3)
          .map(r => ({
            prompt: r.prompt.substring(0, 100) + '...',
            latency_ms: r.latency_ms,
            success: r.success,
            tokens: (r.input_tokens || 0) + (r.output_tokens || 0)
          }))
      }
    };

    return {
      success: true,
      performance_stats: performanceStats
    };

  } catch (error) {
    console.error('[DemoBatchTestTraces] getPerformanceStats error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get performance stats'
    };
  }
}

// Helper functions

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
