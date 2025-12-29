/**
 * Training Statistics API
 * GET /api/training/stats - Get user's training statistics
 *
 * Returns counts and metrics for the authenticated user's training jobs.
 * Built as part of multi-AI workflow demo.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
  console.log('[Training Stats API] Fetching training statistics');

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE', {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error('[Training Stats API] Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get statistics using service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get total jobs count
    const { count: totalJobs, error: countError } = await supabase
      .from('local_training_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('[Training Stats API] Count error:', countError);
      return NextResponse.json(
        { error: 'Failed to fetch statistics' },
        { status: 500 }
      );
    }

    // Get jobs by status
    const { data: jobs, error: jobsError } = await supabase
      .from('local_training_jobs')
      .select('status')
      .eq('user_id', user.id);

    if (jobsError) {
      console.error('[Training Stats API] Jobs error:', jobsError);
      return NextResponse.json(
        { error: 'Failed to fetch job details' },
        { status: 500 }
      );
    }

    // Count by status
    const statusCounts = jobs.reduce((acc: Record<string, number>, job: any) => {
      const status = job.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    console.log('[Training Stats API] Stats retrieved:', { totalJobs, statusCounts });

    return NextResponse.json({
      total_jobs: totalJobs || 0,
      completed: statusCounts.completed || 0,
      running: statusCounts.running || 0,
      failed: statusCounts.failed || 0,
      pending: statusCounts.pending || 0,
      cancelled: statusCounts.cancelled || 0,
    });

  } catch (error) {
    console.error('[Training Stats API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
