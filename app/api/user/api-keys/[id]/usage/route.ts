/**
 * API Key Usage Logs API
 * GET /api/user/api-keys/[id]/usage - Get usage logs for a specific API key
 * Date: 2025-12-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// ============================================================================
// GET /api/user/api-keys/[id]/usage - Get usage logs
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: apiKeyId } = await params;
  console.log('[ApiKeyUsageAPI] GET usage for key:', apiKeyId);

  try {
    // Require authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user authentication
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user owns this API key
    const { data: apiKey, error: keyError } = await supabase
      .from('user_api_keys')
      .select('id, user_id')
      .eq('id', apiKeyId)
      .eq('user_id', user.id)
      .single();

    if (keyError || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const endpoint = searchParams.get('endpoint');
    const status = searchParams.get('status');

    // Build query
    let query = supabase
      .from('api_key_usage_logs')
      .select('*', { count: 'exact' })
      .eq('api_key_id', apiKeyId)
      .order('request_ts', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (startDate) {
      query = query.gte('request_ts', startDate);
    }
    if (endDate) {
      query = query.lte('request_ts', endDate);
    }
    if (endpoint) {
      query = query.eq('endpoint', endpoint);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: logs, error: logsError, count } = await query;

    if (logsError) {
      console.error('[ApiKeyUsageAPI] Query error:', logsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch usage logs', details: logsError.message },
        { status: 500 }
      );
    }

    // Calculate summary stats
    const { data: summaryData } = await supabase
      .from('api_key_usage_logs')
      .select('status, latency_ms, input_tokens, output_tokens')
      .eq('api_key_id', apiKeyId);

    const summary = {
      total_requests: summaryData?.length || 0,
      successful_requests: summaryData?.filter(l => l.status === 'success').length || 0,
      failed_requests: summaryData?.filter(l => l.status === 'error').length || 0,
      avg_latency_ms: summaryData?.length
        ? Math.round(summaryData.reduce((sum, l) => sum + (l.latency_ms || 0), 0) / summaryData.length)
        : 0,
      total_input_tokens: summaryData?.reduce((sum, l) => sum + (l.input_tokens || 0), 0) || 0,
      total_output_tokens: summaryData?.reduce((sum, l) => sum + (l.output_tokens || 0), 0) || 0,
    };

    return NextResponse.json({
      success: true,
      logs: logs || [],
      count: count || 0,
      limit,
      offset,
      summary,
    });

  } catch (error) {
    console.error('[ApiKeyUsageAPI] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
