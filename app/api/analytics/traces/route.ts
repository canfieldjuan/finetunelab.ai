/**
 * API Route - LLM Trace Management
 *
 * Captures and retrieves detailed hierarchical traces of LLM operations
 * for debugging and performance analysis
 *
 * POST /api/analytics/traces - Capture a new trace
 * GET /api/analytics/traces - Retrieve traces with filtering
 *
 * Date: 2025-10-25
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Debug logging helper
function debugLog(context: string, data: any) {
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
    const body = await req.json();
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
    let result = traces;
    if (trace_id && traces && traces.length > 0) {
      result = buildTraceHierarchy(traces);
    }

    debugLog('GET', `Retrieved ${traces?.length || 0} traces`);

    return NextResponse.json({
      success: true,
      data: result,
      pagination: {
        limit,
        offset,
        total: traces?.length || 0
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
function buildTraceHierarchy(traces: any[]) {
  const traceMap = new Map();
  const rootTraces = [];

  // First pass: create map
  for (const trace of traces) {
    traceMap.set(trace.span_id, { ...trace, children: [] });
  }

  // Second pass: build hierarchy
  for (const trace of traces) {
    if (trace.parent_trace_id) {
      const parent = traceMap.get(trace.parent_trace_id);
      if (parent) {
        parent.children.push(traceMap.get(trace.span_id));
      } else {
        rootTraces.push(traceMap.get(trace.span_id));
      }
    } else {
      rootTraces.push(traceMap.get(trace.span_id));
    }
  }

  return rootTraces;
}