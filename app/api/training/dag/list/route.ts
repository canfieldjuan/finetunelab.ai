/**
 * DAG List Endpoint
 * 
 * GET /api/training/dag/list - List recent DAG executions from database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { STATUS } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[DAG-LIST] Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    console.log(`[DAG-LIST] Fetching executions - limit: ${limit}, offset: ${offset}, status: ${status || 'all'}`);

    let query = supabase
      .from('training_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[DAG-LIST] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch executions', details: error.message },
        { status: 500 }
      );
    }

    type ExecutionRow = {
      id: string;
      name: string;
      status: string;
      started_at: string;
      completed_at: string | null;
      jobs: Array<{ status: string }> | null;
    };

    const executions = ((data || []) as ExecutionRow[]).map((execution) => ({
      id: execution.id,
      name: execution.name,
      status: execution.status,
      startedAt: execution.started_at,
      completedAt: execution.completed_at,
      duration: execution.completed_at 
        ? Math.round((new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime()) / 1000)
        : null,
      totalJobs: Array.isArray(execution.jobs) ? execution.jobs.length : 0,
      completedJobs: Array.isArray(execution.jobs)
        ? execution.jobs.filter((j) => j.status === STATUS.COMPLETED).length
        : 0,
      failedJobs: Array.isArray(execution.jobs)
        ? execution.jobs.filter((j) => j.status === STATUS.FAILED).length
        : 0,
    }));

    console.log(`[DAG-LIST] Returning ${executions.length} executions`);

    return NextResponse.json({
      success: true,
      executions,
      total: count || executions.length,
      limit,
      offset,
    });

  } catch (error) {
    console.error('[DAG-LIST] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
