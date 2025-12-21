/**
 * Cost Analysis API
 * GET /api/analytics/cost-analysis
 *
 * Provides comprehensive cost analytics from llm_traces
 * Includes accurate cost_usd, cache savings, and breakdowns
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

interface TraceRecord {
  id: string;
  user_id: string;
  model_name: string | null;
  model_provider: string | null;
  operation_type: string | null;
  cost_usd: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
  status: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

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
      console.error('[CostAnalysis] Query error:', tracesError);
      return NextResponse.json({ error: 'Failed to fetch cost data' }, { status: 500 });
    }

    const traceRecords = (traces || []) as TraceRecord[];
    const totalCost = traceRecords.reduce((sum, t) => sum + (t.cost_usd || 0), 0);
    const totalTokens = traceRecords.reduce((sum, t) =>
      sum + (t.input_tokens || 0) + (t.output_tokens || 0), 0);

    const dailyCosts = aggregateDailyCosts(traceRecords);
    const modelBreakdown = aggregateByModel(traceRecords);
    const operationBreakdown = aggregateByOperation(traceRecords);
    const cacheSavings = calculateCacheSavings(traceRecords);

    return NextResponse.json({
      success: true,
      data: {
        timeRange,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        summary: {
          totalCost,
          totalTokens,
          totalTraces: traceRecords.length,
          avgCostPerTrace: traceRecords.length > 0 ? totalCost / traceRecords.length : 0,
        },
        dailyCosts,
        modelBreakdown,
        operationBreakdown,
        cacheSavings,
      },
    });
  } catch (error) {
    console.error('[CostAnalysis] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function aggregateDailyCosts(traces: TraceRecord[]) {
  const dailyMap: Record<string, {cost: number; tokens: number; count: number}> = {};

  for (const trace of traces) {
    const date = trace.created_at.split('T')[0];
    if (!dailyMap[date]) {
      dailyMap[date] = { cost: 0, tokens: 0, count: 0 };
    }
    dailyMap[date].cost += trace.cost_usd || 0;
    dailyMap[date].tokens += (trace.input_tokens || 0) + (trace.output_tokens || 0);
    dailyMap[date].count += 1;
  }

  return Object.entries(dailyMap)
    .map(([date, data]) => ({
      date,
      cost: parseFloat(data.cost.toFixed(6)),
      tokens: data.tokens,
      traceCount: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateByModel(traces: TraceRecord[]) {
  const modelMap: Record<string, {cost: number; tokens: number; count: number}> = {};

  for (const trace of traces) {
    const model = trace.model_name || 'unknown';
    if (!modelMap[model]) {
      modelMap[model] = { cost: 0, tokens: 0, count: 0 };
    }
    modelMap[model].cost += trace.cost_usd || 0;
    modelMap[model].tokens += (trace.input_tokens || 0) + (trace.output_tokens || 0);
    modelMap[model].count += 1;
  }

  return Object.entries(modelMap)
    .map(([model, data]) => ({
      model,
      cost: parseFloat(data.cost.toFixed(6)),
      tokens: data.tokens,
      traceCount: data.count,
      avgCostPerTrace: data.count > 0 ? parseFloat((data.cost / data.count).toFixed(6)) : 0,
    }))
    .sort((a, b) => b.cost - a.cost);
}

function aggregateByOperation(traces: TraceRecord[]) {
  const opMap: Record<string, {cost: number; tokens: number; count: number}> = {};

  for (const trace of traces) {
    const operation = trace.operation_type || 'unknown';
    if (!opMap[operation]) {
      opMap[operation] = { cost: 0, tokens: 0, count: 0 };
    }
    opMap[operation].cost += trace.cost_usd || 0;
    opMap[operation].tokens += (trace.input_tokens || 0) + (trace.output_tokens || 0);
    opMap[operation].count += 1;
  }

  return Object.entries(opMap)
    .map(([operation, data]) => ({
      operation,
      cost: parseFloat(data.cost.toFixed(6)),
      tokens: data.tokens,
      traceCount: data.count,
      avgCostPerTrace: data.count > 0 ? parseFloat((data.cost / data.count).toFixed(6)) : 0,
    }))
    .sort((a, b) => b.cost - a.cost);
}

function calculateCacheSavings(traces: TraceRecord[]) {
  let totalCacheReadTokens = 0;
  let totalCacheCreationTokens = 0;
  let tracesWithCacheHits = 0;
  let tracesWithCacheCreation = 0;

  for (const trace of traces) {
    if (trace.cache_read_input_tokens && trace.cache_read_input_tokens > 0) {
      totalCacheReadTokens += trace.cache_read_input_tokens;
      tracesWithCacheHits += 1;
    }
    if (trace.cache_creation_input_tokens && trace.cache_creation_input_tokens > 0) {
      totalCacheCreationTokens += trace.cache_creation_input_tokens;
      tracesWithCacheCreation += 1;
    }
  }

  const estimatedSavings = totalCacheReadTokens * 0.003 * 0.9 / 1000;

  return {
    totalCacheReadTokens,
    totalCacheCreationTokens,
    tracesWithCacheHits,
    tracesWithCacheCreation,
    estimatedSavingsUsd: parseFloat(estimatedSavings.toFixed(6)),
    cacheHitRate: traces.length > 0 ?
      parseFloat(((tracesWithCacheHits / traces.length) * 100).toFixed(2)) : 0,
  };
}
