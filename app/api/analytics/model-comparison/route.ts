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
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

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

interface ModelConfig {
  modelName: string;
  provider: string;
  temperature?: number;
  maxTokens?: number;
}

interface ComparisonRequest {
  name: string;
  description?: string;
  models: ModelConfig[];
  systemPrompt?: string;
  testCases?: string[];
  trafficSplit?: number[];
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as ComparisonRequest;
    const { name, description, models, systemPrompt, testCases, trafficSplit } = body;

    if (!name || !models || models.length < 2) {
      return NextResponse.json(
        { error: 'Name and at least 2 models are required' },
        { status: 400 }
      );
    }

    const defaultTrafficSplit = models.map(() => 100 / models.length);
    const finalTrafficSplit = trafficSplit || defaultTrafficSplit;

    if (finalTrafficSplit.length !== models.length) {
      return NextResponse.json(
        { error: 'Traffic split length must match number of models' },
        { status: 400 }
      );
    }

    const totalTraffic = finalTrafficSplit.reduce((sum, val) => sum + val, 0);
    if (Math.abs(totalTraffic - 100) > 0.01) {
      return NextResponse.json(
        { error: 'Traffic split must sum to 100' },
        { status: 400 }
      );
    }

    const { data: experiment, error: expError } = await supabase
      .from('ab_experiments')
      .insert({
        user_id: user.id,
        name,
        description: description || `Comparing ${models.map(m => m.modelName).join(' vs ')}`,
        hypothesis: `Testing which model performs better for the given use case`,
        status: 'draft',
        experiment_type: 'model_comparison',
        primary_metric: 'average_rating',
        secondary_metrics: ['success_rate', 'avg_latency', 'cost_per_request'],
        traffic_percentage: 100,
        start_date: new Date().toISOString(),
        tags: ['model_comparison', 'automated'],
        metadata: { systemPrompt, testCases },
      })
      .select()
      .single();

    if (expError) {
      return NextResponse.json({ error: expError.message }, { status: 500 });
    }

    const variants = models.map((model, index) => ({
      experiment_id: experiment.id,
      name: model.modelName,
      description: `${model.provider} - ${model.modelName}`,
      is_control: index === 0,
      configuration: {
        modelName: model.modelName,
        modelProvider: model.provider,
        temperature: model.temperature ?? 0.7,
        maxTokens: model.maxTokens ?? 1000,
      },
      traffic_percentage: finalTrafficSplit[index],
    }));

    const { data: createdVariants, error: varError } = await supabase
      .from('ab_experiment_variants')
      .insert(variants)
      .select();

    if (varError) {
      return NextResponse.json({ error: varError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      experiment,
      variants: createdVariants,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
