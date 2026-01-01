/**
 * Demo Batch Results API
 * GET endpoint to fetch batch test results for analytics display
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session_id parameter' },
        { status: 400 }
      );
    }

    console.log('[DemoBatchResults] Fetching results for session:', sessionId);

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch all batch test results for this session
    const { data: results, error } = await supabase
      .from('demo_batch_test_results')
      .select('*')
      .eq('demo_session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[DemoBatchResults] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch batch results', details: error.message },
        { status: 500 }
      );
    }

    console.log('[DemoBatchResults] Found', results?.length || 0, 'results');

    return NextResponse.json({
      success: true,
      results: results || [],
      count: results?.length || 0
    });

  } catch (error) {
    console.error('[DemoBatchResults] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
