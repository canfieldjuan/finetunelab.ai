/**
 * Provider Comparison Analytics API
 *
 * Aggregates LLM trace data by provider for comparison:
 * - Success rates and error rates
 * - Average latency and cost per call
 * - Total costs and token usage
 * - Top error categories by provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRequestWithScope } from '@/lib/auth/api-key-validator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY_PREFIX = 'wak_';

interface TraceRecord {
  id: string;
  user_id: string;
  model_provider: string | null;
  status: string | null;
  cost_usd: number | null;
  total_tokens: number | null;
  duration_ms: number | null;
  error_category: string | null;
  ttft_ms: number | null;
  tokens_per_second: number | null;
  cache_read_input_tokens: number | null;
  cache_creation_input_tokens: number | null;
  created_at: string;
}

interface ProviderStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalCost: number;
  totalTokens: number;
  totalDurationMs: number;
  totalTTFTMs: number;
  totalThroughput: number;
  ttftCount: number;
  throughputCount: number;
  cacheHits: number;
  cacheMisses: number;
  topErrors: Map<string, number>;
}

/**
 * GET - Retrieve provider comparison analytics
 */
export async function GET(req: NextRequest) {
  try {
    // Authentication (session token OR API key)
    let userId: string | null = null;
    let supabase = null as unknown as ReturnType<typeof createClient>;

    const headerApiKey = req.headers.get('x-api-key') || req.headers.get('x-workspace-api-key');
    const authHeader = req.headers.get('authorization');

    if (headerApiKey) {
      if (!supabaseServiceKey) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }
      const validation = await validateRequestWithScope(req.headers, 'production');
      if (!validation.isValid || !validation.userId) {
        return NextResponse.json(
          { error: validation.errorMessage || 'Unauthorized' },
          { status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401) }
        );
      }
      userId = validation.userId;
      supabase = createClient(supabaseUrl, supabaseServiceKey);
    } else if (authHeader) {
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      const bearerValue = bearerMatch?.[1]?.trim();

      if (bearerValue?.startsWith(API_KEY_PREFIX)) {
        if (!supabaseServiceKey) {
          return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        const validation = await validateRequestWithScope(req.headers, 'production');
        if (!validation.isValid || !validation.userId) {
          return NextResponse.json(
            { error: validation.errorMessage || 'Unauthorized' },
            { status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401) }
          );
        }
        userId = validation.userId;
        supabase = createClient(supabaseUrl, supabaseServiceKey);
      } else {
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          return NextResponse.json({ error: 'Unauthorized - invalid token' }, { status: 401 });
        }
        userId = user.id;
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract query parameters
    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get('timeRange') || '7d';

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now);
    if (timeRange === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else if (timeRange === '90d') {
      startDate.setDate(now.getDate() - 90);
    }

    // Query traces grouped by provider
    const { data: traces, error } = await supabase
      .from('llm_traces')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .not('model_provider', 'is', null);

    if (error) {
      console.error('[Provider Comparison API] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve traces' },
        { status: 500 }
      );
    }

    // Group traces by provider and calculate stats
    const providerStats = new Map<string, ProviderStats>();

    for (const trace of (traces as TraceRecord[]) || []) {
      const provider = trace.model_provider;
      if (!provider) continue;

      if (!providerStats.has(provider)) {
        providerStats.set(provider, {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          totalCost: 0,
          totalTokens: 0,
          totalDurationMs: 0,
          totalTTFTMs: 0,
          totalThroughput: 0,
          ttftCount: 0,
          throughputCount: 0,
          cacheHits: 0,
          cacheMisses: 0,
          topErrors: new Map(),
        });
      }

      const stats = providerStats.get(provider)!;
      stats.totalCalls++;

      if (trace.status === 'completed') {
        stats.successfulCalls++;
      } else if (trace.status === 'failed') {
        stats.failedCalls++;
        if (trace.error_category) {
          const count = stats.topErrors.get(trace.error_category) || 0;
          stats.topErrors.set(trace.error_category, count + 1);
        }
      }

      if (trace.cost_usd) stats.totalCost += trace.cost_usd;
      if (trace.total_tokens) stats.totalTokens += trace.total_tokens;
      if (trace.duration_ms) stats.totalDurationMs += trace.duration_ms;

      if (trace.ttft_ms) {
        stats.totalTTFTMs += trace.ttft_ms;
        stats.ttftCount++;
      }

      if (trace.tokens_per_second) {
        stats.totalThroughput += trace.tokens_per_second;
        stats.throughputCount++;
      }

      if (trace.cache_read_input_tokens && trace.cache_read_input_tokens > 0) {
        stats.cacheHits++;
      } else if (trace.cache_creation_input_tokens && trace.cache_creation_input_tokens > 0) {
        stats.cacheMisses++;
      }
    }

    // Calculate averages and format response
    const comparison = Array.from(providerStats.entries()).map(([provider, stats]) => ({
      provider,
      totalCalls: stats.totalCalls,
      successRate: stats.totalCalls > 0 ? (stats.successfulCalls / stats.totalCalls) * 100 : 0,
      errorRate: stats.totalCalls > 0 ? (stats.failedCalls / stats.totalCalls) * 100 : 0,
      avgLatencyMs: stats.totalCalls > 0 ? stats.totalDurationMs / stats.totalCalls : 0,
      avgCostPerCall: stats.totalCalls > 0 ? stats.totalCost / stats.totalCalls : 0,
      totalCost: stats.totalCost,
      totalTokens: stats.totalTokens,
      avgTTFTMs: stats.ttftCount > 0 ? stats.totalTTFTMs / stats.ttftCount : null,
      avgThroughput: stats.throughputCount > 0 ? stats.totalThroughput / stats.throughputCount : null,
      cacheHitRate: (stats.cacheHits + stats.cacheMisses) > 0
        ? (stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100
        : null,
      topErrors: Array.from(stats.topErrors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category, count]) => ({ category, count })),
    }));

    // Sort by total calls descending
    comparison.sort((a, b) => b.totalCalls - a.totalCalls);

    return NextResponse.json({
      success: true,
      data: {
        timeRange,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        comparison,
      }
    });

  } catch (error) {
    console.error('[Provider Comparison API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
