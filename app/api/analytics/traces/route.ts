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
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface TracePayload {
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
  status?: string | null;
  error_message?: string | null;
  error_type?: string | null;
}

interface TraceRecord extends TracePayload {
  id: string;
  user_id: string;
  created_at: string;
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
    // Block 1: Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      debugLog('POST', 'No auth header');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      debugLog('POST', `Invalid token: ${authError?.message}`);
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    debugLog('POST', `User authenticated: ${user.id}`);

    // Block 2: Parse and validate request body
    const body = (await req.json()) as TracePayload;
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
      status,
      error_message,
      error_type
    } = body;

    // Validate required fields
    if (!trace_id || !span_id || !span_name || !operation_type) {
      debugLog('POST', 'Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: trace_id, span_id, span_name, operation_type' },
        { status: 400 }
      );
    }

    // Block 3: Insert trace into database
    const { data: trace, error: insertError } = await supabase
      .from('llm_traces')
      .insert({
        user_id: user.id,
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
        status: status || 'pending',
        error_message,
        error_type
      })
      .select()
      .single();

    if (insertError) {
      debugLog('POST', `Insert error: ${insertError.message}`);
      return NextResponse.json(
        { error: `Failed to capture trace: ${insertError.message}` },
        { status: 500 }
      );
    }

    debugLog('POST', `Trace captured: ${trace.id}`);

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
    // Block 1: Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      debugLog('GET', 'No auth header');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      debugLog('GET', `Invalid token: ${authError?.message}`);
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    debugLog('GET', `User authenticated: ${user.id}`);

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
      .eq('user_id', user.id)
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

    // Build trace hierarchy if trace_id is provided
    const typedTraces: TraceRecord[] = (traces ?? []) as TraceRecord[];
    let result: TraceRecord[] | TraceHierarchyEntry[] = typedTraces;
    if (trace_id && typedTraces.length > 0) {
      result = buildTraceHierarchy(typedTraces);
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
 * Helper function to build trace hierarchy
 */
function buildTraceHierarchy(traces: TraceRecord[]): TraceHierarchyEntry[] {
  const traceMap = new Map<string, TraceHierarchyEntry>();
  const rootTraces: TraceHierarchyEntry[] = [];

  // First pass: create map
  for (const trace of traces) {
    traceMap.set(trace.span_id, { ...trace, children: [] });
  }

  // Second pass: build hierarchy
  for (const trace of traces) {
    const currentNode = traceMap.get(trace.span_id);
    if (!currentNode) {
      continue;
    }
    if (trace.parent_trace_id) {
      const parent = traceMap.get(trace.parent_trace_id);
      if (parent) {
        parent.children.push(currentNode);
      } else {
        rootTraces.push(currentNode);
      }
    } else {
      rootTraces.push(currentNode);
    }
  }

  return rootTraces;
}
