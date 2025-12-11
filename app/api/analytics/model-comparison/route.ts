/**
 * API Route - Model Comparison Analytics
 *
 * Returns detailed comparison of model performance including:
 * - Quality metrics per model (average rating, success rate)
 * - Cost metrics per model (average cost, quality per dollar)
 * - Performance trends (improving/declining/stable)
 * - Recommendations for model selection
 *
 * GET /api/analytics/model-comparison
 *
 * Query Parameters:
 * - period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all' (default: 'month')
 * - startDate: ISO date string (optional, overrides period)
 * - endDate: ISO date string (optional, default: now)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evaluationMetricsService } from '@/lib/tools/evaluation-metrics/metrics.service';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  console.log('[Model Comparison API] Request received');

  try {
    // Block 1: Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('[Model Comparison API] No auth header');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[Model Comparison API] Invalid token:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    console.log('[Model Comparison API] User authenticated:', user.id);

    // Block 2: Extract query parameters
    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') || 'month') as
      'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    console.log('[Model Comparison API] Query parameters:', {
      period,
      startDate,
      endDate,
    });

    // Block 3: Call metrics service
    console.log('[Model Comparison API] Calling getModelComparison...');
    const result = await evaluationMetricsService.getModelComparison(user.id, {
      period,
      startDate,
      endDate,
    });

    console.log('[Model Comparison API] Results:', {
      modelCount: result.models.length,
      bestByQuality: result.bestModel.byQuality,
      bestByCost: result.bestModel.byCost,
      bestByValue: result.bestModel.byValue,
    });

    // Block 4: Return results
    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('[Model Comparison API] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
