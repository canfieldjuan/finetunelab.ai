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
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
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

    // 3. Build query
    let query = supabase
      .from('llm_traces')
      .select('id, trace_id, span_name, operation_type, status, start_time, duration_ms, model_name, model_provider, conversation_id, message_id, session_tag, error_message, input_tokens, output_tokens, total_tokens, cost_usd, ttft_ms, tokens_per_second, api_endpoint, api_base_url, request_headers_sanitized, provider_request_id, queue_time_ms, inference_time_ms, network_time_ms, streaming_enabled, chunk_usage, context_tokens, retrieval_latency_ms, groundedness_score, response_quality_breakdown, warning_flags', { count: 'exact' })
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

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // 4. Execute query
    const { data: traces, error: tracesError, count } = await query;

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
    const enrichedTraces = await enrichTracesWithQuality(supabase, traces || [], user.id);

    return NextResponse.json({
      traces: enrichedTraces,
      total: count || 0,
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

async function enrichTracesWithQuality(supabase: any, traces: any[], userId: string) {
  if (!traces || traces.length === 0) return traces;

  const traceIds = traces.map(t => t.trace_id);

  // Fetch quality metrics from judgments
  const { data: judgments } = await supabase
    .from('judgments')
    .select('trace_id, score, passed')
    .in('trace_id', traceIds);

  // Fetch user ratings from message_evaluations
  const { data: evaluations } = await supabase
    .from('message_evaluations')
    .select('trace_id, rating, success')
    .in('trace_id', traceIds)
    .eq('user_id', userId);

  // Aggregate quality metrics by trace_id
  const qualityMap = new Map();

  // Process judgments
  if (judgments) {
    for (const j of judgments) {
      if (!j.trace_id) continue;
      if (!qualityMap.has(j.trace_id)) {
        qualityMap.set(j.trace_id, {
          scores: [],
          passed: 0,
          total: 0,
        });
      }
      const metrics = qualityMap.get(j.trace_id);
      metrics.scores.push(j.score || 0);
      metrics.total++;
      if (j.passed) metrics.passed++;
    }
  }

  // Process evaluations
  const evaluationMap = new Map();
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
  return traces.map(trace => {
    const quality = qualityMap.get(trace.trace_id);
    const evaluation = evaluationMap.get(trace.trace_id);

    const enriched: any = { ...trace };

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

    return enriched;
  });
}
