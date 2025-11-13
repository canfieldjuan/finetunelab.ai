/**
 * Analytics Data API
 * GET /api/analytics/data
 * 
 * Fetch aggregated analytics data for specified time range
 * Phase 3: Backend API Endpoints
 * Date: October 25, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  aggregateTokenUsageData,
  aggregateQualityMetrics,
  aggregateToolUsageData,
  aggregateConversationMetrics,
  aggregateErrorData,
  aggregateLatencyData,
} from '@/lib/analytics/dataAggregator';
import type { DateRange, AnalyticsDataset } from '@/lib/analytics/types';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Authenticate user
 */
async function authenticateUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return { error: 'Unauthorized - no auth header', user: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: 'Unauthorized - invalid token', user: null };
  }

  return { error: null, user };
}

/**
 * Validate date range
 */
function validateDateRange(
  startDate: string | null,
  endDate: string | null,
  period: string | null
): { dateRange: DateRange | null; error: string | null } {
  console.log('[Analytics Data API] Validating date range:', startDate, endDate);

  if (!startDate || !endDate) {
    return { dateRange: null, error: 'startDate and endDate are required' };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { dateRange: null, error: 'Invalid date format' };
  }

  if (start >= end) {
    return { dateRange: null, error: 'startDate must be before endDate' };
  }

  const maxRangeDays = 90;
  const rangeDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (rangeDays > maxRangeDays) {
    return { 
      dateRange: null, 
      error: `Date range exceeds maximum of ${maxRangeDays} days` 
    };
  }

  const validPeriod = period && ['hour', 'day', 'week', 'month', 'all'].includes(period)
    ? period as 'hour' | 'day' | 'week' | 'month' | 'all'
    : 'day';

  console.log('[Analytics Data API] Date range valid:', start, 'to', end);
  return { dateRange: { start, end, period: validPeriod }, error: null };
}

/**
 * Parse metrics parameter
 */
function parseMetricsParam(metrics: string | null): string[] {
  console.log('[Analytics Data API] Parsing metrics:', metrics);

  if (!metrics || metrics === 'all') {
    return ['tokens', 'quality', 'tools', 'conversations', 'errors', 'latency'];
  }

  const validMetrics = ['tokens', 'quality', 'tools', 'conversations', 'errors', 'latency'];
  const requestedMetrics = metrics.split(',').map(m => m.trim());
  const filteredMetrics = requestedMetrics.filter(m => validMetrics.includes(m));

  console.log('[Analytics Data API] Parsed metrics:', filteredMetrics);
  return filteredMetrics;
}

/**
 * Aggregate analytics data
 */
async function aggregateAnalyticsData(
  userId: string,
  dateRange: DateRange,
  metrics: string[]
): Promise<AnalyticsDataset> {
  console.log('[Analytics Data API] Aggregating data for user:', userId);

  const dataset: AnalyticsDataset = {
    userId,
    timeRange: dateRange,
    metrics: {
      tokenUsage: [],
      quality: [],
      tools: [],
      conversations: [],
      errors: [],
      latency: [],
    },
    aggregations: {
      totals: {
        messages: 0,
        conversations: 0,
        tokens: 0,
        cost: 0,
        evaluations: 0,
        errors: 0,
      },
      averages: {
        tokensPerMessage: 0,
        costPerMessage: 0,
        rating: 0,
        successRate: 0,
        errorRate: 0,
        latencyMs: 0,
      },
      trends: {
        tokenUsage: { direction: 'stable', changePercent: 0, dataPoints: 0, confidence: 'low' },
        quality: { direction: 'stable', changePercent: 0, dataPoints: 0, confidence: 'low' },
        latency: { direction: 'stable', changePercent: 0, dataPoints: 0, confidence: 'low' },
        errorRate: { direction: 'stable', changePercent: 0, dataPoints: 0, confidence: 'low' },
      },
    },
    generatedAt: new Date(),
  };

  if (metrics.includes('tokens')) {
    dataset.metrics.tokenUsage = await aggregateTokenUsageData(userId, dateRange);
  }

  if (metrics.includes('quality')) {
    dataset.metrics.quality = await aggregateQualityMetrics(userId, dateRange);
  }

  if (metrics.includes('tools')) {
    dataset.metrics.tools = await aggregateToolUsageData(userId, dateRange);
  }

  if (metrics.includes('conversations')) {
    dataset.metrics.conversations = await aggregateConversationMetrics(userId, dateRange);
  }

  if (metrics.includes('errors')) {
    dataset.metrics.errors = await aggregateErrorData(userId, dateRange);
  }

  if (metrics.includes('latency')) {
    dataset.metrics.latency = await aggregateLatencyData(userId, dateRange);
  }

  console.log('[Analytics Data API] Data aggregation complete');
  return dataset;
}

/**
 * GET handler
 */
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user } = await authenticateUser(req);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    console.log('[Analytics Data API] Request from user:', user.id);

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const metrics = searchParams.get('metrics');
    const granularity = searchParams.get('granularity') || 'day';

    const { dateRange, error: dateError } = validateDateRange(startDate, endDate, granularity);
    if (dateError || !dateRange) {
      return NextResponse.json({ error: dateError }, { status: 400 });
    }

    const metricsArray = parseMetricsParam(metrics);
    if (metricsArray.length === 0) {
      return NextResponse.json(
        { error: 'At least one metric must be specified' },
        { status: 400 }
      );
    }

    const dataset = await aggregateAnalyticsData(
      user.id,
      dateRange,
      metricsArray
    );

    console.log('[Analytics Data API] Returning dataset');

    return NextResponse.json(
      {
        success: true,
        data: dataset,
        metadata: {
          userId: user.id,
          dateRange,
          metrics: metricsArray,
          granularity,
          generatedAt: new Date().toISOString(),
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=300',
        },
      }
    );
  } catch (error) {
    console.error('[Analytics Data API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
