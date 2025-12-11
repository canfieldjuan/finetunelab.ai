/**
 * DAG Execution Status Endpoint
 * 
 * GET /api/training/dag/status/[id] - Get execution status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { STATUS } from '@/lib/constants';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: executionId } = await params;

    if (!executionId) {
      return NextResponse.json(
        { error: 'Missing execution ID' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[DAG-STATUS] Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[DAG-STATUS] Fetching status for execution: ${executionId}`);

    const { data: execution, error } = await supabase
      .from('training_jobs')
      .select('*')
      .eq('id', executionId)
      .single();

    if (error) {
      console.error('[DAG-STATUS] Database error:', error);
      return NextResponse.json(
        { error: 'Execution not found', details: error.message },
        { status: 404 }
      );
    }

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    const jobs = Array.isArray(execution.jobs) ? execution.jobs : [];
    const completedJobs = jobs.filter((j: { status: string }) => j.status === STATUS.COMPLETED).length;
    const failedJobs = jobs.filter((j: { status:string }) => j.status === STATUS.FAILED).length;
    const runningJobs = jobs.filter((j: { status: string }) => j.status === STATUS.RUNNING).length;
    const progress = jobs.length > 0 ? Math.round((completedJobs / jobs.length) * 100) : 0;

    const duration = execution.completed_at 
      ? Math.round((new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime()) / 1000)
      : Math.round((Date.now() - new Date(execution.started_at).getTime()) / 1000);

    console.log(`[DAG-STATUS] Status: ${execution.status}, Progress: ${progress}%`);

    return NextResponse.json({
      success: true,
      id: execution.id,
      name: execution.name,
      status: execution.status,
      startedAt: execution.started_at,
      completedAt: execution.completed_at,
      duration,
      progress,
      totalJobs: jobs.length,
      completedJobs,
      failedJobs,
      runningJobs,
      jobs: jobs.map((job: {
        jobId: string;
        status: string;
        startedAt?: string;
        completedAt?: string;
        attempt: number;
        error?: string;
        output?: unknown;
        logs?: string[];
      }) => ({
        id: job.jobId,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        attempt: job.attempt,
        error: job.error,
        output: job.output,
        logs: job.logs || [],
      })),
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DAG-STATUS] Unexpected error:', errorMessage);
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
