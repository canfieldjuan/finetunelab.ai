/**
 * Demo Analytics Service
 * Provides analytics queries scoped to demo sessions only.
 * Queries demo_batch_test_results and demo_batch_test_runs tables.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface DemoSessionMetrics {
  totalPrompts: number;
  completedPrompts: number;
  failedPrompts: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgResponseLength: number;
  successRate: number;
}

export interface DemoPromptResult {
  id: string;
  prompt: string;
  response: string | null;
  latency_ms: number;
  success: boolean;
  error: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

export interface DemoTestRunSummary {
  id: string;
  model_name: string;
  status: string;
  total_prompts: number;
  completed_prompts: number;
  failed_prompts: number;
  started_at: string;
  completed_at: string | null;
}

/**
 * Get aggregated metrics for a demo session
 */
export async function getDemoSessionMetrics(sessionId: string): Promise<DemoSessionMetrics | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get all results for this session
  const { data: results, error } = await supabase
    .from('demo_batch_test_results')
    .select('*')
    .eq('demo_session_id', sessionId);

  if (error) {
    console.error('[DemoAnalytics] Error fetching results:', error);
    return null;
  }

  if (!results || results.length === 0) {
    return {
      totalPrompts: 0,
      completedPrompts: 0,
      failedPrompts: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      minLatencyMs: 0,
      maxLatencyMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      avgResponseLength: 0,
      successRate: 0,
    };
  }

  // Calculate metrics
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  // Latency calculations (only for successful results with latency)
  const latencies = successful
    .map(r => r.latency_ms)
    .filter((l): l is number => l !== null && l !== undefined && l > 0)
    .sort((a, b) => a - b);

  const percentile = (arr: number[], p: number): number => {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  };

  // Token calculations
  const totalInputTokens = results.reduce((sum, r) => sum + (r.input_tokens || 0), 0);
  const totalOutputTokens = results.reduce((sum, r) => sum + (r.output_tokens || 0), 0);

  // Response length calculation
  const responseLengths = successful
    .map(r => r.response?.length || 0)
    .filter(l => l > 0);
  const avgResponseLength = responseLengths.length > 0
    ? responseLengths.reduce((sum, l) => sum + l, 0) / responseLengths.length
    : 0;

  return {
    totalPrompts: results.length,
    completedPrompts: successful.length,
    failedPrompts: failed.length,
    avgLatencyMs: latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    p99LatencyMs: percentile(latencies, 99),
    minLatencyMs: latencies.length > 0 ? latencies[0] : 0,
    maxLatencyMs: latencies.length > 0 ? latencies[latencies.length - 1] : 0,
    totalInputTokens,
    totalOutputTokens,
    avgResponseLength: Math.round(avgResponseLength),
    successRate: results.length > 0 ? (successful.length / results.length) * 100 : 0,
  };
}

/**
 * Get individual prompt results for a demo session
 */
export async function getDemoPromptResults(
  sessionId: string,
  options?: {
    sortBy?: 'latency' | 'tokens' | 'created_at';
    order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
    successOnly?: boolean;
    failedOnly?: boolean;
  }
): Promise<DemoPromptResult[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const {
    sortBy = 'created_at',
    order = 'asc',
    limit = 100,
    offset = 0,
    successOnly = false,
    failedOnly = false,
  } = options || {};

  // Map sortBy to column name
  const sortColumn = sortBy === 'latency' ? 'latency_ms'
    : sortBy === 'tokens' ? 'output_tokens'
    : 'created_at';

  let query = supabase
    .from('demo_batch_test_results')
    .select('id, prompt, response, latency_ms, success, error, input_tokens, output_tokens, created_at')
    .eq('demo_session_id', sessionId)
    .order(sortColumn, { ascending: order === 'asc' })
    .range(offset, offset + limit - 1);

  if (successOnly) {
    query = query.eq('success', true);
  } else if (failedOnly) {
    query = query.eq('success', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[DemoAnalytics] Error fetching prompt results:', error);
    return [];
  }

  return data || [];
}

/**
 * Search demo responses by keyword
 */
export async function searchDemoResponses(
  sessionId: string,
  keyword: string,
  options?: {
    searchIn?: 'prompt' | 'response' | 'both';
    limit?: number;
  }
): Promise<DemoPromptResult[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { searchIn = 'both', limit = 50 } = options || {};

  // Build search query
  let query = supabase
    .from('demo_batch_test_results')
    .select('id, prompt, response, latency_ms, success, error, input_tokens, output_tokens, created_at')
    .eq('demo_session_id', sessionId)
    .limit(limit);

  // Add text search filter
  const searchKeyword = `%${keyword.toLowerCase()}%`;

  if (searchIn === 'prompt') {
    query = query.ilike('prompt', searchKeyword);
  } else if (searchIn === 'response') {
    query = query.ilike('response', searchKeyword);
  } else {
    // Search in both - use OR filter
    query = query.or(`prompt.ilike.${searchKeyword},response.ilike.${searchKeyword}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[DemoAnalytics] Error searching responses:', error);
    return [];
  }

  return data || [];
}

/**
 * Get latency distribution for histogram/chart
 */
export async function getDemoLatencyDistribution(
  sessionId: string,
  bucketCount: number = 10
): Promise<{ bucket: string; count: number; minMs: number; maxMs: number }[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get all successful results with latency
  const { data: results, error } = await supabase
    .from('demo_batch_test_results')
    .select('latency_ms')
    .eq('demo_session_id', sessionId)
    .eq('success', true)
    .not('latency_ms', 'is', null);

  if (error || !results || results.length === 0) {
    return [];
  }

  const latencies = results.map(r => r.latency_ms).sort((a, b) => a - b);
  const minLatency = latencies[0];
  const maxLatency = latencies[latencies.length - 1];
  const bucketSize = (maxLatency - minLatency) / bucketCount;

  if (bucketSize === 0) {
    // All latencies are the same
    return [{
      bucket: `${minLatency}ms`,
      count: latencies.length,
      minMs: minLatency,
      maxMs: maxLatency,
    }];
  }

  // Create buckets
  const buckets: { bucket: string; count: number; minMs: number; maxMs: number }[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const bucketMin = minLatency + (i * bucketSize);
    const bucketMax = minLatency + ((i + 1) * bucketSize);
    const count = latencies.filter(l => l >= bucketMin && (i === bucketCount - 1 ? l <= bucketMax : l < bucketMax)).length;

    buckets.push({
      bucket: `${Math.round(bucketMin)}-${Math.round(bucketMax)}ms`,
      count,
      minMs: Math.round(bucketMin),
      maxMs: Math.round(bucketMax),
    });
  }

  return buckets.filter(b => b.count > 0);
}

/**
 * Get test run summary for a session
 */
export async function getDemoTestRunSummary(sessionId: string): Promise<DemoTestRunSummary | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('demo_batch_test_runs')
    .select('id, model_name, status, total_prompts, completed_prompts, failed_prompts, started_at, completed_at')
    .eq('demo_session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('[DemoAnalytics] Error fetching test run:', error);
    return null;
  }

  return data;
}

/**
 * Get slowest/fastest prompts
 */
export async function getDemoExtremeLatencyPrompts(
  sessionId: string,
  type: 'slowest' | 'fastest',
  limit: number = 5
): Promise<DemoPromptResult[]> {
  return getDemoPromptResults(sessionId, {
    sortBy: 'latency',
    order: type === 'slowest' ? 'desc' : 'asc',
    limit,
    successOnly: true,
  });
}

/**
 * Get prompts by token usage
 */
export async function getDemoPromptsByTokens(
  sessionId: string,
  type: 'highest' | 'lowest',
  limit: number = 5
): Promise<DemoPromptResult[]> {
  return getDemoPromptResults(sessionId, {
    sortBy: 'tokens',
    order: type === 'highest' ? 'desc' : 'asc',
    limit,
    successOnly: true,
  });
}

/**
 * Validate a demo session exists and is not expired
 */
export async function validateDemoSession(sessionId: string): Promise<{
  valid: boolean;
  error?: string;
  modelName?: string;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: config, error } = await supabase
    .from('demo_model_configs')
    .select('model_name, expires_at')
    .eq('session_id', sessionId)
    .single();

  if (error || !config) {
    return { valid: false, error: 'Session not found' };
  }

  if (new Date(config.expires_at) < new Date()) {
    return { valid: false, error: 'Session expired' };
  }

  return { valid: true, modelName: config.model_name };
}
