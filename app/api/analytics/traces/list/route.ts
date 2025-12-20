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
      .select('id, trace_id, span_name, operation_type, status, start_time, duration_ms, model_name, model_provider, conversation_id, message_id, session_tag, error_message', { count: 'exact' })
      .eq('user_id', user.id)
      .is('parent_trace_id', null) // Only root traces for list view
      .order('start_time', { ascending: false });

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

    return NextResponse.json({
      traces: traces || [],
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
