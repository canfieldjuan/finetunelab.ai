/**
 * @swagger
 * /api/analytics/traces:
 *   get:
 *     summary: Get execution traces
 *     description: |
 *       Retrieve detailed execution traces of LLM operations for debugging and analysis.
 *
 *       Traces provide hierarchical view of:
 *       - Request/response cycles
 *       - Tool calls and their execution
 *       - Model invocations
 *       - Performance timing data
 *       - Error information
 *
 *       **Use Cases:**
 *       - Debug production issues
 *       - Performance profiling
 *       - Track multi-step agent operations
 *       - Audit model behavior
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: conversation_id
 *         schema:
 *           type: string
 *         description: Filter by conversation ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum traces to return
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter traces after this date
 *     responses:
 *       200:
 *         description: Traces retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 traces:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       trace_id:
 *                         type: string
 *                       span_name:
 *                         type: string
 *                         example: "llm.completion"
 *                       duration_ms:
 *                         type: number
 *                         example: 1234.56
 *                       model_name:
 *                         type: string
 *                         example: "gpt-4-turbo"
 *                       operation_type:
 *                         type: string
 *                         example: "completion"
 *                       children:
 *                         type: array
 *                         description: Nested child traces
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Capture execution trace
 *     description: |
 *       Send a trace event for an LLM operation. Used to track and debug production systems.
 *
 *       Typically called automatically by your application code when integrated with
 *       tracing middleware.
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trace_id
 *               - span_id
 *               - span_name
 *               - start_time
 *             properties:
 *               trace_id:
 *                 type: string
 *                 example: "trace_abc123"
 *               span_id:
 *                 type: string
 *                 example: "span_xyz789"
 *               span_name:
 *                 type: string
 *                 example: "llm.completion"
 *               start_time:
 *                 type: string
 *                 format: date-time
 *               end_time:
 *                 type: string
 *                 format: date-time
 *               duration_ms:
 *                 type: number
 *               operation_type:
 *                 type: string
 *                 example: "completion"
 *               model_name:
 *                 type: string
 *                 example: "gpt-4-turbo"
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Trace captured successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateRequestWithScope } from '@/lib/auth/api-key-validator';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY_PREFIX = 'wak_';

interface TracePayload {
  user_id?: string | null;
  conversation_id?: string | null;
  message_id?: string | null;
  trace_id: string;
  parent_trace_id?: string | null;
  span_id: string;
  span_name: string;
  start_time: string;
  end_time?: string | null;
  duration_ms?: number | null;
  operation_type?: string | null;
  model_name?: string | null;
  model_provider?: string | null;
  model_version?: string | null;
  input_data?: Record<string, unknown> | null;
  output_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  cost_usd?: number | null;
  ttft_ms?: number | null;
  tokens_per_second?: number | null;
  status?: string | null;
  error_message?: string | null;
  error_type?: string | null;
  session_tag?: string | null;

  // Request Metadata
  api_endpoint?: string | null;
  api_base_url?: string | null;
  request_headers_sanitized?: Record<string, unknown> | null;
  provider_request_id?: string | null;

  // Performance Metrics
  queue_time_ms?: number | null;
  inference_time_ms?: number | null;
  network_time_ms?: number | null;
  streaming_enabled?: boolean | null;
  chunk_usage?: Record<string, unknown> | null;

  // RAG Metrics
  context_tokens?: number | null;
  retrieval_latency_ms?: number | null;
  rag_graph_used?: boolean | null;
  rag_nodes_retrieved?: number | null;
  rag_chunks_used?: number | null;
  rag_relevance_score?: number | null;
  rag_answer_grounded?: boolean | null;
  rag_retrieval_method?: string | null;

  // Evaluation Metrics
  groundedness_score?: number | null;
  response_quality_breakdown?: Record<string, unknown> | null;
  warning_flags?: string[] | null;
  reasoning?: string | null;
}

interface TraceRecord extends TracePayload {
  id: string;
  user_id: string;
  created_at: string;
  judgments?: unknown[];
  user_rating?: number;
  user_notes?: string;
}

interface TraceHierarchyEntry extends TraceRecord {
  children: TraceHierarchyEntry[];
}

function debugLog(context: string, data: unknown) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Traces API - ${context}]`, data);
  }
}

/**
 * POST - Capture a new trace
 */
export async function POST(req: NextRequest) {
  debugLog('POST', 'Request received');

  try {
    // Block 1: Authentication (session token OR API key)
    let userId: string | null = null;
    let supabase = null as unknown as ReturnType<typeof createClient>;
    let isServiceRoleAuth = false;

    const headerApiKey = req.headers.get('x-api-key') || req.headers.get('x-workspace-api-key');
    const authHeader = req.headers.get('authorization');

    if (headerApiKey) {
      if (!supabaseServiceKey) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }
      const validation = await validateRequestWithScope(req.headers, 'production');
      if (!validation.isValid || !validation.userId) {
        return NextResponse.json(
          { error: validation.errorMessage || 'Unauthorized' },
          { status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401) }
        );
      }
      userId = validation.userId;
      supabase = createClient(supabaseUrl, supabaseServiceKey);
    } else if (authHeader) {
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      const bearerValue = bearerMatch?.[1]?.trim();

      if (bearerValue?.startsWith(API_KEY_PREFIX)) {
        if (!supabaseServiceKey) {
          return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        const validation = await validateRequestWithScope(req.headers, 'production');
        if (!validation.isValid || !validation.userId) {
          return NextResponse.json(
            { error: validation.errorMessage || 'Unauthorized' },
            { status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401) }
          );
        }
        userId = validation.userId;
        supabase = createClient(supabaseUrl, supabaseServiceKey);
      } else if (supabaseServiceKey && bearerValue === supabaseServiceKey) {
        debugLog('POST', 'Service role key detected - internal service call');
        isServiceRoleAuth = true;
        supabase = createClient(supabaseUrl, supabaseServiceKey);
      } else {
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          debugLog('POST', `Invalid token: ${authError?.message}`);
          return NextResponse.json({ error: 'Unauthorized - invalid token' }, { status: 401 });
        }
        userId = user.id;
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Block 2: Parse and validate request body
    const body = (await req.json()) as TracePayload;

    // For service role auth, get userId from payload
    if (isServiceRoleAuth) {
      userId = body.user_id || null;
      if (!userId) {
        return NextResponse.json({ error: 'Missing user_id in trace payload' }, { status: 400 });
      }
    }

    debugLog('POST', `User authenticated: ${userId}`);
    const {
      conversation_id,
      message_id,
      trace_id,
      parent_trace_id,
      span_id,
      span_name,
      start_time,
      end_time,
      duration_ms,
      operation_type,
      model_name,
      model_provider,
      model_version,
      input_data,
      output_data,
      metadata,
      input_tokens,
      output_tokens,
      total_tokens,
      cost_usd,
      ttft_ms,
      tokens_per_second,
      status,
      error_message,
      error_type,
      session_tag,
      // Request Metadata
      api_endpoint,
      api_base_url,
      request_headers_sanitized,
      provider_request_id,
      // Performance Metrics
      queue_time_ms,
      inference_time_ms,
      network_time_ms,
      streaming_enabled,
      chunk_usage,
      // RAG Metrics
      context_tokens,
      retrieval_latency_ms,
      rag_graph_used,
      rag_nodes_retrieved,
      rag_chunks_used,
      rag_relevance_score,
      rag_answer_grounded,
      rag_retrieval_method,
      // Evaluation Metrics
      groundedness_score,
      response_quality_breakdown,
      warning_flags,
      reasoning,
    } = body;

    // DEBUG: Log status value
    console.log(`[Traces API - POST] Received status: "${status}" (type: ${typeof status}) for span: ${span_id}`);

    // Validate required fields
    if (!trace_id || !span_id || !span_name || !operation_type) {
      debugLog('POST', 'Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: trace_id, span_id, span_name, operation_type' },
        { status: 400 }
      );
    }

    // Block 3: Upsert trace into database (use upsert to handle race conditions)

    const { data: trace, error: insertError } = (await (supabase
      .from('llm_traces') as any)
      .upsert({
        user_id: userId,
        conversation_id,
        message_id,
        trace_id,
        parent_trace_id,
        span_id,
        span_name,
        start_time: start_time || new Date().toISOString(),
        end_time,
        duration_ms,
        operation_type,
        model_name,
        model_provider,
        model_version,
        input_data,
        output_data,
        metadata: metadata || {},
        input_tokens,
        output_tokens,
        total_tokens,
        cost_usd,
        ttft_ms,
        tokens_per_second,
        status: status || 'pending',
        error_message,
        error_type,
        session_tag,
        // Request Metadata
        api_endpoint,
        api_base_url,
        request_headers_sanitized,
        provider_request_id,
        // Performance Metrics
        queue_time_ms,
        inference_time_ms,
        network_time_ms,
        streaming_enabled,
        chunk_usage,
        // RAG Metrics
        context_tokens,
        retrieval_latency_ms,
        rag_graph_used,
        rag_nodes_retrieved,
        rag_chunks_used,
        rag_relevance_score,
        rag_answer_grounded,
        rag_retrieval_method,
        // Evaluation Metrics
        groundedness_score,
        response_quality_breakdown,
        warning_flags,
        reasoning,
      }, {
        onConflict: 'span_id',
        ignoreDuplicates: false
      })
      .select()
      .single()) as { data: TraceRecord | null; error: any };

    if (insertError || !trace) {
      debugLog('POST', `Insert error: ${insertError?.message || 'No trace data returned'}`);
      console.error(`[Traces API - POST] Upsert error for span ${span_id}:`, insertError);
      return NextResponse.json(
        { error: `Failed to capture trace: ${insertError?.message || 'No trace data returned'}` },
        { status: 500 }
      );
    }

    debugLog('POST', `Trace captured: ${trace.id}`);
    console.log(`[Traces API - POST] Upsert successful - span: ${span_id}, status in DB: ${trace.status}`);

    return NextResponse.json({
      success: true,
      data: trace
    });

  } catch (error) {
    console.error('[Traces API - POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Retrieve traces with filtering
 */
export async function GET(req: NextRequest) {
  debugLog('GET', 'Request received');

  try {
    // Block 1: Authentication (session token OR API key)
    let userId: string | null = null;
    let supabase = null as unknown as ReturnType<typeof createClient>;

    const headerApiKey = req.headers.get('x-api-key') || req.headers.get('x-workspace-api-key');
    const authHeader = req.headers.get('authorization');

    if (headerApiKey) {
      if (!supabaseServiceKey) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }
      const validation = await validateRequestWithScope(req.headers, 'production');
      if (!validation.isValid || !validation.userId) {
        return NextResponse.json(
          { error: validation.errorMessage || 'Unauthorized' },
          { status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401) }
        );
      }
      userId = validation.userId;
      supabase = createClient(supabaseUrl, supabaseServiceKey);
    } else if (authHeader) {
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      const bearerValue = bearerMatch?.[1]?.trim();

      if (bearerValue?.startsWith(API_KEY_PREFIX)) {
        if (!supabaseServiceKey) {
          return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        const validation = await validateRequestWithScope(req.headers, 'production');
        if (!validation.isValid || !validation.userId) {
          return NextResponse.json(
            { error: validation.errorMessage || 'Unauthorized' },
            { status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401) }
          );
        }
        userId = validation.userId;
        supabase = createClient(supabaseUrl, supabaseServiceKey);
      } else {
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          debugLog('GET', `Invalid token: ${authError?.message}`);
          return NextResponse.json({ error: 'Unauthorized - invalid token' }, { status: 401 });
        }
        userId = user.id;
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    debugLog('GET', `User authenticated: ${userId}`);

    // Block 2: Extract query parameters
    const { searchParams } = new URL(req.url);
    const trace_id = searchParams.get('trace_id');
    const conversation_id = searchParams.get('conversation_id');
    const message_id = searchParams.get('message_id');
    const operation_type = searchParams.get('operation_type');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    debugLog('GET', {
      trace_id,
      conversation_id,
      message_id,
      operation_type,
      status,
      limit,
      offset
    });

    // Block 3: Build query

    let query = supabase
      .from('llm_traces')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    // Apply filters
    if (trace_id) {
      query = query.eq('trace_id', trace_id);
    }
    if (conversation_id) {
      query = query.eq('conversation_id', conversation_id);
    }
    if (message_id) {
      query = query.eq('message_id', message_id);
    }
    if (operation_type) {
      query = query.eq('operation_type', operation_type);
    }
    if (status) {
      query = query.eq('status', status);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Block 4: Execute query
    const { data: traces, error: queryError } = await query;

    if (queryError) {
      debugLog('GET', `Query error: ${queryError.message}`);
      return NextResponse.json(
        { error: `Failed to retrieve traces: ${queryError.message}` },
        { status: 500 }
      );
    }

    // Deduplicate by span_id at database level (safety measure)
    const rawTraces = (traces ?? []) as TraceRecord[];
    const seenSpanIds = new Set<string>();
    const typedTraces: TraceRecord[] = rawTraces.filter(trace => {
      if (seenSpanIds.has(trace.span_id)) {
        console.warn(`[Traces API - GET] Filtering duplicate from DB: span_id=${trace.span_id}`);
        return false;
      }
      seenSpanIds.add(trace.span_id);
      return true;
    });

    // Enrich with quality data
    const enrichedTraces = await enrichTracesWithQualityData(supabase, typedTraces);

    let result: TraceRecord[] | TraceHierarchyEntry[] = enrichedTraces;
    if (trace_id && enrichedTraces.length > 0) {
      result = buildTraceHierarchy(enrichedTraces);
    }

    debugLog('GET', `Retrieved ${typedTraces.length} traces`);

    return NextResponse.json({
      success: true,
      data: result,
      pagination: {
        limit,
        offset,
        total: typedTraces.length
      }
    });

  } catch (error) {
    console.error('[Traces API - GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Enrich traces with quality data (judgments and user ratings)
 */
async function enrichTracesWithQualityData(supabase: SupabaseClient<any>, traces: TraceRecord[]): Promise<TraceRecord[]> {
  if (!traces || traces.length === 0) return traces;

  const traceIds = traces.map(t => t.trace_id).filter(Boolean);
  if (traceIds.length === 0) return traces;

  // Fetch judgments for these traces
  const { data: judgments } = await supabase
    .from('judgments')
    .select('id, trace_id, criterion, score, passed, judge_type, judge_name, notes')
    .in('trace_id', traceIds);

  // Fetch user evaluations for these traces
  const { data: evaluations } = await supabase
    .from('message_evaluations')
    .select('trace_id, rating, notes')
    .in('trace_id', traceIds);

  // Map quality data to traces
  const judgmentsByTraceId = new Map();
  if (judgments) {
    for (const j of judgments) {
      if (!judgmentsByTraceId.has(j.trace_id)) {
        judgmentsByTraceId.set(j.trace_id, []);
      }
      judgmentsByTraceId.get(j.trace_id).push(j);
    }
  }

  const evaluationsByTraceId = new Map();
  if (evaluations) {
    for (const e of evaluations) {
      evaluationsByTraceId.set(e.trace_id, e);
    }
  }

  return traces.map(trace => {
    const enriched: TraceRecord = { ...trace };
    const traceJudgments = judgmentsByTraceId.get(trace.trace_id);
    const traceEval = evaluationsByTraceId.get(trace.trace_id);

    if (traceJudgments) {
      enriched.judgments = traceJudgments;
    }

    if (traceEval) {
      enriched.user_rating = traceEval.rating;
      enriched.user_notes = traceEval.notes;
    }

    return enriched;
  });
}

/**
 * Helper function to build trace hierarchy
 */
function buildTraceHierarchy(traces: TraceRecord[]): TraceHierarchyEntry[] {
  const traceMap = new Map<string, TraceHierarchyEntry>();
  const rootTraces: TraceHierarchyEntry[] = [];

  // First pass: deduplicate and create map
  const spanIds = new Set<string>();
  const uniqueTraces: TraceRecord[] = [];

  for (const trace of traces) {
    if (spanIds.has(trace.span_id)) {
      console.warn(`[buildTraceHierarchy] Duplicate span_id detected: ${trace.span_id}`);
      continue;
    }
    spanIds.add(trace.span_id);
    uniqueTraces.push(trace);
    traceMap.set(trace.span_id, { ...trace, children: [] });
  }

  console.log(`[buildTraceHierarchy] Processing ${traces.length} traces, ${uniqueTraces.length} unique spans`);

  // Second pass: build hierarchy using deduplicated traces
  for (const trace of uniqueTraces) {
    const currentNode = traceMap.get(trace.span_id);
    if (!currentNode) {
      continue;
    }
    if (trace.parent_trace_id) {
      const parent = traceMap.get(trace.parent_trace_id);
      if (parent) {
        parent.children.push(currentNode);
      } else {
        console.log(`[buildTraceHierarchy] Orphan span ${trace.span_id} - parent ${trace.parent_trace_id} not found`);
        rootTraces.push(currentNode);
      }
    } else {
      rootTraces.push(currentNode);
    }
  }

  console.log(`[buildTraceHierarchy] Built hierarchy with ${rootTraces.length} root traces`);
  return rootTraces;
}
