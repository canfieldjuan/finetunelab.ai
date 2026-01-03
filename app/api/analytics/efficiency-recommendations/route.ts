/**
 * Efficiency Recommendations API
 * GET /api/analytics/efficiency-recommendations - Get cost optimization suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

interface TraceData {
  model_name?: string;
  model_provider?: string;
  cost_usd?: number;
  operation_type?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface Recommendation {
  id: string;
  category: 'model' | 'cache' | 'operation' | 'tokens' | 'timing';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potential_savings_usd: number;
  current_cost_usd: number;
  action: string;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const days = parseInt(timeRange.replace('d', ''), 10) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: traces, error: tracesError } = await supabase
      .from('llm_traces')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .not('cost_usd', 'is', null);

    if (tracesError) {
      console.error('[EfficiencyRecs] Traces error:', tracesError);
      return NextResponse.json({ error: 'Failed to fetch traces' }, { status: 500 });
    }

    const recommendations: Recommendation[] = [];
    const traceData = (traces || []) as TraceData[];

    analyzeModelCosts(traceData, recommendations);
    analyzeCacheUsage(traceData, recommendations);
    analyzeOperationCosts(traceData, recommendations);
    analyzeTokenUsage(traceData, recommendations);

    recommendations.sort((a, b) => b.potential_savings_usd - a.potential_savings_usd);

    const totalPotentialSavings = recommendations.reduce((sum, r) => sum + r.potential_savings_usd, 0);

    return NextResponse.json({
      success: true,
      data: {
        recommendations,
        summary: {
          total_recommendations: recommendations.length,
          high_priority: recommendations.filter(r => r.severity === 'high').length,
          medium_priority: recommendations.filter(r => r.severity === 'medium').length,
          low_priority: recommendations.filter(r => r.severity === 'low').length,
          total_potential_savings_usd: parseFloat(totalPotentialSavings.toFixed(4)),
        },
      },
    });
  } catch (error) {
    console.error('[EfficiencyRecs] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function analyzeModelCosts(traces: TraceData[], recommendations: Recommendation[]) {
  const modelStats: Record<string, { cost: number; count: number }> = {};

  traces.forEach(t => {
    const model = t.model_name || 'unknown';
    if (!modelStats[model]) {
      modelStats[model] = { cost: 0, count: 0 };
    }
    modelStats[model].cost += t.cost_usd || 0;
    modelStats[model].count += 1;
  });

  const sortedModels = Object.entries(modelStats).sort((a, b) => b[1].cost - a[1].cost);

  sortedModels.forEach(([model, stats]) => {
    if (model.includes('gpt-4') && !model.includes('mini') && stats.cost > 1.0) {
      const potentialSavings = stats.cost * 0.7;
      recommendations.push({
        id: `model-${model}`,
        category: 'model',
        severity: 'high',
        title: 'Consider using GPT-4 Mini or GPT-3.5',
        description: `${model} accounts for $${stats.cost.toFixed(4)} (${stats.count} calls). GPT-4 Mini costs 90% less while maintaining quality for most tasks.`,
        potential_savings_usd: parseFloat(potentialSavings.toFixed(4)),
        current_cost_usd: parseFloat(stats.cost.toFixed(4)),
        action: 'Switch to gpt-4-mini for non-critical tasks',
      });
    }

    if (model.includes('claude-3-opus') && stats.cost > 0.5) {
      const potentialSavings = stats.cost * 0.8;
      recommendations.push({
        id: `model-${model}`,
        category: 'model',
        severity: 'high',
        title: 'Consider using Claude Sonnet or Haiku',
        description: `${model} costs $${stats.cost.toFixed(4)} (${stats.count} calls). Claude Sonnet costs 80% less and Haiku costs 95% less.`,
        potential_savings_usd: parseFloat(potentialSavings.toFixed(4)),
        current_cost_usd: parseFloat(stats.cost.toFixed(4)),
        action: 'Switch to claude-sonnet-4-5 for most tasks',
      });
    }
  });
}

function analyzeCacheUsage(traces: TraceData[], recommendations: Recommendation[]) {
  const anthropicTraces = traces.filter(t =>
    t.model_provider === 'anthropic' ||
    (t.model_name && t.model_name.includes('claude'))
  );

  if (anthropicTraces.length === 0) return;

  const tracesWithCache = anthropicTraces.filter(t =>
    (t.cache_read_input_tokens && t.cache_read_input_tokens > 0) ||
    (t.cache_creation_input_tokens && t.cache_creation_input_tokens > 0)
  );

  const cacheUsageRate = tracesWithCache.length / anthropicTraces.length;

  if (cacheUsageRate < 0.3 && anthropicTraces.length > 10) {
    const avgCost = anthropicTraces.reduce((sum, t) => sum + (t.cost_usd || 0), 0) / anthropicTraces.length;
    const potentialSavings = avgCost * anthropicTraces.length * 0.5;

    recommendations.push({
      id: 'cache-anthropic',
      category: 'cache',
      severity: 'medium',
      title: 'Enable Anthropic Prompt Caching',
      description: `Only ${(cacheUsageRate * 100).toFixed(1)}% of Anthropic calls use prompt caching. Enabling caching can reduce costs by 90% on cache reads.`,
      potential_savings_usd: parseFloat(potentialSavings.toFixed(4)),
      current_cost_usd: parseFloat((avgCost * anthropicTraces.length).toFixed(4)),
      action: 'Add cache_control breakpoints to system prompts',
    });
  }
}

function analyzeOperationCosts(traces: TraceData[], recommendations: Recommendation[]) {
  const opStats: Record<string, { cost: number; count: number }> = {};

  traces.forEach(t => {
    const op = t.operation_type || 'unknown';
    if (!opStats[op]) {
      opStats[op] = { cost: 0, count: 0 };
    }
    opStats[op].cost += t.cost_usd || 0;
    opStats[op].count += 1;
  });

  Object.entries(opStats).forEach(([op, stats]) => {
    const avgCost = stats.cost / stats.count;
    if (avgCost > 0.01 && stats.count > 20) {
      const potentialSavings = stats.cost * 0.3;
      recommendations.push({
        id: `operation-${op}`,
        category: 'operation',
        severity: 'medium',
        title: `Optimize ${op} operations`,
        description: `${stats.count} ${op} operations cost $${stats.cost.toFixed(4)} (avg $${avgCost.toFixed(4)}/call). Consider batching or caching results.`,
        potential_savings_usd: parseFloat(potentialSavings.toFixed(4)),
        current_cost_usd: parseFloat(stats.cost.toFixed(4)),
        action: 'Batch operations or implement result caching',
      });
    }
  });
}

function analyzeTokenUsage(traces: TraceData[], recommendations: Recommendation[]) {
  const highTokenTraces = traces.filter(t =>
    (t.input_tokens || 0) + (t.output_tokens || 0) > 10000
  );

  if (highTokenTraces.length > traces.length * 0.2) {
    const totalCost = traces.reduce((sum, t) => sum + (t.cost_usd || 0), 0);
    const potentialSavings = totalCost * 0.2;

    recommendations.push({
      id: 'tokens-high',
      category: 'tokens',
      severity: 'low',
      title: 'Reduce token usage',
      description: `${highTokenTraces.length} traces (${((highTokenTraces.length / traces.length) * 100).toFixed(1)}%) use >10K tokens. Optimize prompts to reduce costs.`,
      potential_savings_usd: parseFloat(potentialSavings.toFixed(4)),
      current_cost_usd: parseFloat(totalCost.toFixed(4)),
      action: 'Shorten prompts, remove redundant context, use concise instructions',
    });
  }
}
