/**
 * GET /api/analytics/traces/list
 * Returns paginated list of traces with filtering support
 * 
 * Query parameters:
 * - limit: number (default: 20)
 * - offset: number (default: 0)
 * - operation_type: string (optional)
 * - status: string (optional)
 * - session_tag: string (optional - filter by session tag)
 * - search: string (optional - searches trace_id, conversation_id, session_tag)
 * - start_date: ISO date string (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Type definitions
interface TraceData {
  id: string;
  trace_id: string;
  span_name: string;
  operation_type: string;
  status: string;
  start_time: string;
  duration_ms: number | null;
  model_name: string | null;
  model_provider: string | null;
  conversation_id: string | null;
  message_id: string | null;
  session_tag: string | null;
  error_message: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  ttft_ms: number | null;
  tokens_per_second: number | null;
  api_endpoint: string | null;
  api_base_url: string | null;
  request_headers_sanitized: unknown;
  provider_request_id: string | null;
  queue_time_ms: number | null;
  inference_time_ms: number | null;
  network_time_ms: number | null;
  streaming_enabled: boolean | null;
  chunk_usage: unknown;
  context_tokens: number | null;
  retrieval_latency_ms: number | null;
  rag_graph_used: boolean | null;
  rag_nodes_retrieved: number | null;
  rag_chunks_used: number | null;
  rag_relevance_score: number | null;
  rag_answer_grounded: boolean | null;
  rag_retrieval_method: string | null;
  groundedness_score: number | null;
  response_quality_breakdown: unknown;
  warning_flags: unknown;
  reasoning: string | null;
}

interface Judgment {
  trace_id: string | null;
  message_id: string | null;
  criterion: string;
  score: number | null;
  passed: boolean;
  judge_type: string;
}

interface Evaluation {
  trace_id: string | null;
  rating: number | null;
  success: boolean | null;
}

interface QualityMetrics {
  scores: number[];
  passed: number;
  total: number;
}

interface EvaluationData {
  user_rating: number | null;
  has_user_feedback: boolean;
}

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - missing authorization header' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    }: { data: { user: any }; error: any } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const operationType = searchParams.get('operation_type');
    const status = searchParams.get('status');
    const sessionTag = searchParams.get('session_tag');
    const search = searchParams.get('search');
    const startDate = searchParams.get('start_date');

    // Advanced filter parameters
    const minCost = searchParams.get('min_cost');
    const maxCost = searchParams.get('max_cost');
    const minDuration = searchParams.get('min_duration');
    const maxDuration = searchParams.get('max_duration');
    const minThroughput = searchParams.get('min_throughput');
    const maxThroughput = searchParams.get('max_throughput');
    const hasError = searchParams.get('has_error');
    const hasQualityScore = searchParams.get('has_quality_score');

    // 3. Build query
    let query = supabase
      .from('llm_traces')
      .select('id, trace_id, span_name, operation_type, status, start_time, duration_ms, model_name, model_provider, conversation_id, message_id, session_tag, error_message, input_tokens, output_tokens, total_tokens, cost_usd, ttft_ms, tokens_per_second, api_endpoint, api_base_url, request_headers_sanitized, provider_request_id, queue_time_ms, inference_time_ms, network_time_ms, streaming_enabled, chunk_usage, context_tokens, retrieval_latency_ms, rag_graph_used, rag_nodes_retrieved, rag_chunks_used, rag_relevance_score, rag_answer_grounded, rag_retrieval_method, groundedness_score, response_quality_breakdown, warning_flags, reasoning', { count: 'exact' })
      .eq('user_id', user.id);

    // Only filter to root traces if NOT filtering for child span operations
    // Retrieval, tool_call, embedding operations are typically child spans
    const childSpanOperations = ['retrieval', 'tool_call', 'embedding'];
    if (!operationType || !childSpanOperations.includes(operationType)) {
      query = query.is('parent_trace_id', null); // Only root traces for list view
    }

    query = query.order('start_time', { ascending: false });

    // Apply filters
    if (operationType && operationType !== 'all') {
      query = query.eq('operation_type', operationType);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (sessionTag) {
      query = query.eq('session_tag', sessionTag);
    }

    if (search) {
      // Search in text fields: trace_id, span_name, model_name, model_provider, session_tag
      // For conversation_id and message_id (UUIDs), try exact match if search looks like UUID
      const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search);
      
      if (isUuidFormat) {
        // Exact UUID match for conversation_id or message_id
        query = query.or(`trace_id.ilike.%${search}%,span_name.ilike.%${search}%,model_name.ilike.%${search}%,model_provider.ilike.%${search}%,session_tag.ilike.%${search}%,conversation_id.eq.${search},message_id.eq.${search}`);
      } else {
        // Text search only (including session_tag)
        query = query.or(`trace_id.ilike.%${search}%,span_name.ilike.%${search}%,model_name.ilike.%${search}%,model_provider.ilike.%${search}%,session_tag.ilike.%${search}%`);
      }
    }

    if (startDate) {
      query = query.gte('start_time', startDate);
    }

    // Advanced filters
    if (minCost) {
      const minCostNum = parseFloat(minCost);
      if (!isNaN(minCostNum)) {
        query = query.gte('cost_usd', minCostNum);
      }
    }

    if (maxCost) {
      const maxCostNum = parseFloat(maxCost);
      if (!isNaN(maxCostNum)) {
        query = query.lte('cost_usd', maxCostNum);
      }
    }

    if (minDuration) {
      const minDurationNum = parseInt(minDuration);
      if (!isNaN(minDurationNum)) {
        query = query.gte('duration_ms', minDurationNum);
      }
    }

    if (maxDuration) {
      const maxDurationNum = parseInt(maxDuration);
      if (!isNaN(maxDurationNum)) {
        query = query.lte('duration_ms', maxDurationNum);
      }
    }

    if (minThroughput) {
      const minThroughputNum = parseFloat(minThroughput);
      if (!isNaN(minThroughputNum)) {
        query = query.gte('tokens_per_second', minThroughputNum);
      }
    }

    if (maxThroughput) {
      const maxThroughputNum = parseFloat(maxThroughput);
      if (!isNaN(maxThroughputNum)) {
        query = query.lte('tokens_per_second', maxThroughputNum);
      }
    }

    if (hasError === 'true') {
      query = query.not('error_message', 'is', null);
    } else if (hasError === 'false') {
      query = query.is('error_message', null);
    }

    // Note: hasQualityScore filter will be applied after enrichment
    // since quality_score is computed from judgments table

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // 4. Execute query
    const {
      data: traces,
      error: tracesError,
      count,
    }: { data: TraceData[] | null; error: any; count: number | null } = await query;

    if (tracesError) {
      console.error('[Traces List API] Error fetching traces:', tracesError);
      return NextResponse.json(
        {
          error: 'Failed to fetch traces',
          details: tracesError.message || 'Unknown database error',
          hint: tracesError.hint || null
        },
        { status: 500 }
      );
    }

    // 5. Enrich traces with quality metrics
    let enrichedTraces = await enrichTracesWithQuality(supabase, traces || [], user.id);

    // Apply post-enrichment filters (quality_score is computed, not in DB)
    if (hasQualityScore === 'true') {
      enrichedTraces = (enrichedTraces as Record<string, unknown>[]).filter((t) => t.quality_score != null);
    } else if (hasQualityScore === 'false') {
      enrichedTraces = (enrichedTraces as Record<string, unknown>[]).filter((t) => t.quality_score == null);
    }

    const minQualityScore = searchParams.get('min_quality_score');
    if (minQualityScore) {
      const minQualityNum = parseFloat(minQualityScore);
      if (!isNaN(minQualityNum)) {
        enrichedTraces = (enrichedTraces as Record<string, unknown>[]).filter((t) =>
          t.quality_score != null && (t.quality_score as number) >= minQualityNum
        );
      }
    }

    // Update count if post-enrichment filters were applied
    const finalCount = (hasQualityScore || minQualityScore) ? enrichedTraces.length : (count || 0);

    return NextResponse.json({
      traces: enrichedTraces,
      total: finalCount,
      limit,
      offset,
    });

  } catch (error) {
    console.error('[Traces List API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function enrichTracesWithQuality(
  supabase: SupabaseClient,
  traces: TraceData[],
  userId: string
): Promise<Array<Record<string, unknown>>> {
  if (!traces || traces.length === 0) return [];

  const traceIds: string[] = traces.map((t) => t.trace_id);
  const messageIds: string[] = traces.map((t) => t.message_id).filter(Boolean) as string[];

  console.log('[Traces List] enrichTracesWithQuality - traceIds:', traceIds.length, 'messageIds:', messageIds.length);

  // Fetch quality metrics from judgments (by both trace_id and message_id)
  let judgmentsQuery = supabase
    .from('judgments')
    .select('trace_id, message_id, criterion, score, passed, judge_type');

  // Build OR condition based on what we have
  if (messageIds.length > 0) {
    judgmentsQuery = judgmentsQuery.or(`trace_id.in.(${traceIds.join(',')}),message_id.in.(${messageIds.join(',')})`);
  } else {
    judgmentsQuery = judgmentsQuery.in('trace_id', traceIds);
  }

  const {
    data: judgments,
    error: judgmentsError,
  }: { data: Judgment[] | null; error: any } = await judgmentsQuery;

  if (judgmentsError) {
    console.error('[Traces List] Error fetching judgments:', judgmentsError);
  }

  console.log('[Traces List] Found judgments:', judgments?.length || 0, judgments);

  // Fetch user ratings from message_evaluations
  const { data: evaluations }: { data: Evaluation[] | null } = await supabase
    .from('message_evaluations')
    .select('trace_id, rating, success')
    .in('trace_id', traceIds)
    .eq('user_id', userId);

  // Aggregate quality metrics by trace_id
  const qualityMap = new Map<string, QualityMetrics>();
  const judgmentsMap = new Map<string, Array<Omit<Judgment, 'trace_id' | 'message_id'>>>();

  // Process judgments
  if (judgments) {
    console.log('[Traces List] Processing', judgments.length, 'judgments');
    for (const j of judgments) {
      // Match judgment to trace by trace_id or message_id
      const matchingTrace = traces.find(t =>
        (j.trace_id && t.trace_id === j.trace_id) ||
        (j.message_id && t.message_id === j.message_id)
      );

      if (!matchingTrace) {
        console.log('[Traces List] No matching trace for judgment:', {
          criterion: j.criterion,
          trace_id: j.trace_id,
          message_id: j.message_id
        });
        continue;
      }

      const traceId = matchingTrace.trace_id;

      // Store individual judgments for display
      if (!judgmentsMap.has(traceId)) {
        judgmentsMap.set(traceId, []);
      }
      judgmentsMap.get(traceId).push({
        criterion: j.criterion,
        score: j.score,
        passed: j.passed,
        judge_type: j.judge_type
      });
      console.log('[Traces List] Matched judgment to trace:', traceId, j.criterion, j.judge_type);

      // Aggregate scores
      if (!qualityMap.has(traceId)) {
        qualityMap.set(traceId, {
          scores: [],
          passed: 0,
          total: 0,
        });
      }
      const metrics = qualityMap.get(traceId);
      metrics.scores.push(j.score || 0);
      metrics.total++;
      if (j.passed) metrics.passed++;
    }
  }

  // Process evaluations
  const evaluationMap = new Map<string, EvaluationData>();
  if (evaluations) {
    for (const e of evaluations) {
      if (!e.trace_id) continue;
      evaluationMap.set(e.trace_id, {
        user_rating: e.rating,
        has_user_feedback: true,
      });
    }
  }

  // Merge quality data into traces
  const enrichedTraces = traces.map(trace => {
    const quality = qualityMap.get(trace.trace_id);
    const evaluation = evaluationMap.get(trace.trace_id);
    const traceJudgments = judgmentsMap.get(trace.trace_id);

    const enriched: Record<string, unknown> = { ...trace };

    if (quality) {
      const avgScore = quality.scores.length > 0
        ? quality.scores.reduce((a: number, b: number) => a + b, 0) / quality.scores.length
        : undefined;
      enriched.quality_score = avgScore;
      enriched.passed_validations = quality.passed;
      enriched.total_validations = quality.total;
    }

    if (evaluation) {
      enriched.user_rating = evaluation.user_rating;
      enriched.has_user_feedback = evaluation.has_user_feedback;
    }

    // Attach individual judgments for display in UI
    if (traceJudgments && traceJudgments.length > 0) {
      enriched.judgments = traceJudgments;
      console.log('[Traces List] Attached', traceJudgments.length, 'judgments to trace:', trace.trace_id);
    }

    return enriched;
  });

  console.log('[Traces List] Final enrichment: judgmentsMap size:', judgmentsMap.size);
  return enrichedTraces;
}
