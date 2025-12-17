/**
 * API Route - Scheduled Evaluation Run History
 *
 * GET /api/scheduled-evaluations/[id]/runs - Get execution history for a schedule
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ScheduledEvaluationRun } from '@/lib/batch-testing/types';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET - Get run history for a scheduled evaluation
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Scheduled Evaluations API] GET - Get run history for schedule:', id);

  try {
    // Block 1: Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('[Scheduled Evaluations API] No auth header');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[Scheduled Evaluations API] Invalid token:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    console.log('[Scheduled Evaluations API] User authenticated:', user.id);

    // Block 2: Verify schedule exists and user has access
    const supabaseRead = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: schedule, error: scheduleError } = await supabaseRead
      .from('scheduled_evaluations')
      .select('id')
      .eq('id', id)
      .single();

    if (scheduleError || !schedule) {
      console.log('[Scheduled Evaluations API] Schedule not found:', scheduleError?.message);
      return NextResponse.json(
        { error: 'Scheduled evaluation not found or access denied' },
        { status: 404 }
      );
    }

    // Block 3: Parse pagination parameters
    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');

    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return NextResponse.json(
        { error: 'Invalid limit parameter. Must be between 1 and 1000' },
        { status: 400 }
      );
    }

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { error: 'Invalid offset parameter. Must be >= 0' },
        { status: 400 }
      );
    }

    console.log('[Scheduled Evaluations API] Fetching runs with pagination:', { limit, offset });

    // Block 4: Fetch run history (RLS enforced via schedule ownership)
    const { data: runs, error: runsError } = await supabaseRead
      .from('scheduled_evaluation_runs')
      .select('*')
      .eq('scheduled_evaluation_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (runsError) {
      console.error('[Scheduled Evaluations API] Query error:', runsError);
      return NextResponse.json(
        { error: 'Failed to fetch run history: ' + runsError.message },
        { status: 500 }
      );
    }

    console.log('[Scheduled Evaluations API] Found runs:', runs?.length || 0);

    return NextResponse.json({
      success: true,
      data: runs as ScheduledEvaluationRun[],
      pagination: {
        limit,
        offset,
        count: runs?.length || 0,
      },
    });

  } catch (error) {
    console.error('[Scheduled Evaluations API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
