/**
 * Health Check Endpoint for Scheduler Worker
 * GET /api/health/scheduler
 *
 * Returns worker status and recent activity
 * Used for monitoring and alerting
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(_req: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check database connectivity
    const { error: dbError } = await supabase
      .from('scheduled_evaluations')
      .select('id')
      .limit(1);

    if (dbError) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          error: 'Database connection failed',
          details: dbError.message,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Get active schedules count
    const { count: activeCount } = await supabase
      .from('scheduled_evaluations')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get recent runs (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentRuns, error: runsError } = await supabase
      .from('scheduled_evaluation_runs')
      .select('id, status, triggered_at')
      .gte('triggered_at', oneHourAgo)
      .order('triggered_at', { ascending: false })
      .limit(10);

    if (runsError) {
      console.error('[Health Check] Error fetching recent runs:', runsError);
    }

    // Calculate stats
    const stats = {
      total_runs_last_hour: recentRuns?.length || 0,
      completed: recentRuns?.filter(r => r.status === 'completed').length || 0,
      failed: recentRuns?.filter(r => r.status === 'failed').length || 0,
      running: recentRuns?.filter(r => r.status === 'running').length || 0,
    };

    // Check for stuck runs (running for > 1 hour)
    const stuckRuns = recentRuns?.filter(r =>
      r.status === 'running' || r.status === 'triggered'
    ) || [];

    // Get schedules that are overdue (should have run but didn't)
    const now = new Date().toISOString();
    const { data: overdueSchedules } = await supabase
      .from('scheduled_evaluations')
      .select('id, name, next_run_at')
      .eq('is_active', true)
      .lt('next_run_at', now)
      .order('next_run_at', { ascending: true })
      .limit(5);

    // Determine overall health
    const isHealthy =
      !dbError &&
      stuckRuns.length === 0 &&
      (overdueSchedules?.length || 0) < 5;

    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: 'connected',
      active_schedules: activeCount || 0,
      last_hour_stats: stats,
      stuck_runs: stuckRuns.length,
      overdue_schedules: overdueSchedules?.length || 0,
      warnings: [
        ...(stuckRuns.length > 0 ? [`${stuckRuns.length} runs stuck in running state`] : []),
        ...((overdueSchedules?.length || 0) > 0 ? [`${overdueSchedules?.length} schedules overdue`] : []),
      ],
      details: {
        recent_runs: recentRuns?.slice(0, 5).map(r => ({
          id: r.id,
          status: r.status,
          triggered_at: r.triggered_at,
        })),
        overdue_schedules: overdueSchedules?.map(s => ({
          id: s.id,
          name: s.name,
          next_run_at: s.next_run_at,
        })),
      },
    });

  } catch (error) {
    console.error('[Health Check] Error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
