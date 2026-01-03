/**
 * API Route - Forecast Data
 *
 * Provides historical metric data aggregated by day for time-series forecasting
 * Supports success rate, average rating, response time, and SLA metrics
 *
 * GET /api/analytics/forecast-data?metric=success_rate&timeRange=30d
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type MetricType = 'success_rate' | 'avg_rating' | 'response_time_p95' | 'sla_breach_rate';
type TimeRange = '7d' | '30d' | '90d';

interface HistoricalDataPoint {
  timestamp: string;
  value: number;
}

/**
 * Get date range from timeRange parameter
 */
function getDateRange(timeRange: TimeRange): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  switch (timeRange) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
  }

  return { startDate, endDate };
}

/**
 * Aggregate success rate by day from evaluations
 */
async function aggregateSuccessRateByDay(
  supabase: SupabaseClient<any>,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<HistoricalDataPoint[]> {
  // Fetch evaluations with success status from message_evaluations table
  const { data: evaluations, error } = await supabase
    .from('message_evaluations')
    .select('created_at, success')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[ForecastData] Error fetching evaluations:', error);
    throw error;
  }

  if (!evaluations || evaluations.length === 0) {
    return [];
  }

  // Group by day and calculate success rate
  const dayMap: Record<string, { total: number; successful: number }> = {};

  (evaluations as Array<{ created_at: string; success: boolean | null }>).forEach((evaluation) => {
    const date = new Date(evaluation.created_at).toISOString().split('T')[0];
    if (!dayMap[date]) {
      dayMap[date] = { total: 0, successful: 0 };
    }
    dayMap[date].total++;
    if (evaluation.success === true) {
      dayMap[date].successful++;
    }
  });

  // Convert to array and calculate percentages
  return Object.entries(dayMap)
    .map(([date, stats]) => ({
      timestamp: `${date}T12:00:00.000Z`, // Use noon to avoid timezone issues
      value: stats.total > 0 ? (stats.successful / stats.total) * 100 : 0
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Aggregate average rating by day from evaluations
 */
async function aggregateAvgRatingByDay(
  supabase: SupabaseClient<any>,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<HistoricalDataPoint[]> {
  const { data: evaluations, error } = await supabase
    .from('message_evaluations')
    .select('created_at, rating')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .not('rating', 'is', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[ForecastData] Error fetching ratings:', error);
    throw error;
  }

  if (!evaluations || evaluations.length === 0) {
    return [];
  }

  // Group by day and calculate average
  const dayMap: Record<string, { total: number; sum: number }> = {};

  evaluations.forEach((evaluation: { created_at: string; rating: number | null }) => {
    const date = new Date(evaluation.created_at).toISOString().split('T')[0];
    if (!dayMap[date]) {
      dayMap[date] = { total: 0, sum: 0 };
    }
    dayMap[date].total++;
    dayMap[date].sum += evaluation.rating || 0;
  });

  return Object.entries(dayMap)
    .map(([date, stats]) => ({
      timestamp: `${date}T12:00:00.000Z`,
      value: stats.total > 0 ? stats.sum / stats.total : 0
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Aggregate P95 response time by day from messages
 */
async function aggregateResponseTimeP95ByDay(
  supabase: SupabaseClient<any>,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<HistoricalDataPoint[]> {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('created_at, latency_ms')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .not('latency_ms', 'is', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[ForecastData] Error fetching latency:', error);
    throw error;
  }

  if (!messages || messages.length === 0) {
    return [];
  }

  // Group by day
  const dayMap: Record<string, number[]> = {};

  messages.forEach((message: { created_at: string; latency_ms: number | null }) => {
    const date = new Date(message.created_at).toISOString().split('T')[0];
    if (!dayMap[date]) {
      dayMap[date] = [];
    }
    dayMap[date].push(message.latency_ms || 0);
  });

  // Calculate P95 for each day
  return Object.entries(dayMap)
    .map(([date, latencies]) => {
      const sorted = latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p95Value = sorted[p95Index] || 0;

      return {
        timestamp: `${date}T12:00:00.000Z`,
        value: p95Value
      };
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Aggregate SLA breach rate by day (% of responses > 2000ms)
 */
async function aggregateSLABreachRateByDay(
  supabase: SupabaseClient<any>,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<HistoricalDataPoint[]> {
  const SLA_THRESHOLD_MS = 2000;

  const { data: messages, error } = await supabase
    .from('messages')
    .select('created_at, latency_ms')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .not('latency_ms', 'is', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[ForecastData] Error fetching latency for SLA:', error);
    throw error;
  }

  if (!messages || messages.length === 0) {
    return [];
  }

  // Group by day and calculate breach rate
  const dayMap: Record<string, { total: number; breaches: number }> = {};

  messages.forEach((message: { created_at: string; latency_ms: number | null }) => {
    const date = new Date(message.created_at).toISOString().split('T')[0];
    if (!dayMap[date]) {
      dayMap[date] = { total: 0, breaches: 0 };
    }
    dayMap[date].total++;
    if ((message.latency_ms || 0) > SLA_THRESHOLD_MS) {
      dayMap[date].breaches++;
    }
  });

  return Object.entries(dayMap)
    .map(([date, stats]) => ({
      timestamp: `${date}T12:00:00.000Z`,
      value: stats.total > 0 ? (stats.breaches / stats.total) * 100 : 0
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * GET handler - Fetch historical metric data
 */
export async function GET(req: NextRequest) {
  try {
    // Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const metric = searchParams.get('metric') as MetricType;
    const timeRange = (searchParams.get('timeRange') || '30d') as TimeRange;

    // Validate metric parameter
    const validMetrics: MetricType[] = ['success_rate', 'avg_rating', 'response_time_p95', 'sla_breach_rate'];
    if (!metric || !validMetrics.includes(metric)) {
      return NextResponse.json(
        { error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate timeRange parameter
    const validTimeRanges: TimeRange[] = ['7d', '30d', '90d'];
    if (!validTimeRanges.includes(timeRange)) {
      return NextResponse.json(
        { error: `Invalid timeRange. Must be one of: ${validTimeRanges.join(', ')}` },
        { status: 400 }
      );
    }

    console.log('[ForecastData] ========== API REQUEST START ==========');
    console.log('[ForecastData] Request:', { userId: user.id, metric, timeRange });

    // Get date range
    const { startDate, endDate } = getDateRange(timeRange);
    console.log('[ForecastData] Date range:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    });

    // Fetch appropriate metric data
    let historical: HistoricalDataPoint[] = [];

     
    const supabaseAny = supabase as SupabaseClient<any>;

    switch (metric) {
      case 'success_rate':
        console.log('[ForecastData] Fetching success_rate data...');
        try {
          historical = await aggregateSuccessRateByDay(supabaseAny, user.id, startDate, endDate);
          console.log('[ForecastData] success_rate query returned:', historical.length, 'points');
        } catch (err) {
          console.error('[ForecastData] Error in aggregateSuccessRateByDay:', err);
          const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
          throw new Error(`Failed to fetch success_rate data: ${errorMessage}`);
        }
        break;
      case 'avg_rating':
        console.log('[ForecastData] Fetching avg_rating data...');
        try {
          historical = await aggregateAvgRatingByDay(supabaseAny, user.id, startDate, endDate);
          console.log('[ForecastData] avg_rating query returned:', historical.length, 'points');
        } catch (err) {
          console.error('[ForecastData] Error in aggregateAvgRatingByDay:', err);
          throw new Error(`Failed to fetch avg_rating data: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        break;
      case 'response_time_p95':
        console.log('[ForecastData] Fetching response_time_p95 data...');
        try {
          historical = await aggregateResponseTimeP95ByDay(supabaseAny, user.id, startDate, endDate);
          console.log('[ForecastData] response_time_p95 query returned:', historical.length, 'points');
        } catch (err) {
          console.error('[ForecastData] Error in aggregateResponseTimeP95ByDay:', err);
          throw new Error(`Failed to fetch response_time_p95 data: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        break;
      case 'sla_breach_rate':
        console.log('[ForecastData] Fetching sla_breach_rate data...');
        try {
          historical = await aggregateSLABreachRateByDay(supabaseAny, user.id, startDate, endDate);
          console.log('[ForecastData] sla_breach_rate query returned:', historical.length, 'points');
        } catch (err) {
          console.error('[ForecastData] Error in aggregateSLABreachRateByDay:', err);
          throw new Error(`Failed to fetch sla_breach_rate data: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        break;
    }

    console.log('[ForecastData] ✓ Data aggregation complete:', {
      dataPoints: historical.length,
      firstPoint: historical[0] || null,
      lastPoint: historical[historical.length - 1] || null,
      samplePoints: historical.slice(0, 3)
    });

    if (historical.length === 0) {
      console.warn('[ForecastData] ⚠️ No data points found for metric:', metric);
    }

    console.log('[ForecastData] ========== API REQUEST SUCCESS ==========');

    return NextResponse.json({
      success: true,
      metric,
      timeRange,
      historical,
      dataPoints: historical.length
    });

  } catch (error) {
    console.error('[ForecastData] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch forecast data' },
      { status: 500 }
    );
  }
}
