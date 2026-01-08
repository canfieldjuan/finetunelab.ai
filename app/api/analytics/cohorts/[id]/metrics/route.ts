/**
 * Cohort Metrics API Route
 *
 * Handles metrics calculation and comparison for cohorts.
 *
 * Endpoints:
 * - GET: Get cohort metrics with optional baseline comparison and trends
 *
 * Phase 3.1: User Cohort Backend
 * Date: 2025-10-25
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  calculateCohortMetrics,
  compareToBaseline,
  getSnapshots
} from '@/lib/services/cohort.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

// ==================== GET: Get Metrics ====================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Cohort Metrics API] GET request for cohort:', id);

  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Cohort Metrics API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const includeTrends = searchParams.get('include_trends') === 'true';
    const includeBaseline = searchParams.get('include_baseline') !== 'false';

    console.log('[Cohort Metrics API] Calculating metrics');

    type CohortResponse = {
      metrics?: Awaited<ReturnType<typeof calculateCohortMetrics>>;
      baseline_comparison?: Awaited<ReturnType<typeof compareToBaseline>> extends infer Comparison
        ? Comparison extends { baseline_metrics: unknown }
          ? {
              baseline_metrics: Comparison['baseline_metrics'];
              rating_vs_baseline: Comparison extends { rating_vs_baseline: unknown }
                ? Comparison['rating_vs_baseline']
                : unknown;
              success_rate_vs_baseline: Comparison extends { success_rate_vs_baseline: unknown }
                ? Comparison['success_rate_vs_baseline']
                : unknown;
              cost_vs_baseline: Comparison extends { cost_vs_baseline: unknown }
                ? Comparison['cost_vs_baseline']
                : unknown;
            }
          : never
        : never;
      trends?: Awaited<ReturnType<typeof getSnapshots>>;
    };

    const response: CohortResponse = {};

    if (includeBaseline) {
      console.log('[Cohort Metrics API] Including baseline comparison');
      const comparison = await compareToBaseline(id);
      response.metrics = comparison.cohort_metrics;
      response.baseline_comparison = {
        baseline_metrics: comparison.baseline_metrics,
        rating_vs_baseline: comparison.rating_vs_baseline,
        success_rate_vs_baseline: comparison.success_rate_vs_baseline,
        cost_vs_baseline: comparison.cost_vs_baseline
      };
    } else {
      console.log('[Cohort Metrics API] Calculating cohort metrics only');
      response.metrics = await calculateCohortMetrics(id);
    }

    if (includeTrends && (startDate || endDate)) {
      console.log('[Cohort Metrics API] Including trend data');

      const dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };

      const snapshots = await getSnapshots(id, { dateRange });
      response.trends = snapshots;
    }

    console.log('[Cohort Metrics API] Metrics calculated successfully');

    return NextResponse.json(response);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Cohort Metrics API] GET error:', errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
