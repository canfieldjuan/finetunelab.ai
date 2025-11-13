/**
 * API Route - Benchmark Analysis
 *
 * GET /api/analytics/benchmark-analysis
 * Auth required (Supabase JWT via Authorization bearer)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evaluationMetricsService } from '@/lib/tools/evaluation-metrics/metrics.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  console.log('[Benchmark Analysis API] Request received');

  try {
    // Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[Benchmark Analysis API] Invalid token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Params
    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') || 'month') as 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    console.log('[Benchmark Analysis API] Params:', { period, startDate, endDate });

    // Service call
    const data = await evaluationMetricsService.getBenchmarkAnalysis(user.id, {
      period,
      startDate,
      endDate,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Benchmark Analysis API] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 });
  }
}
