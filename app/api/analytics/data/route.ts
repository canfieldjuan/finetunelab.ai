/**
 * @swagger
 * /api/analytics/data:
 *   get:
 *     summary: Get production model analytics
 *     description: |
 *       Retrieve aggregated analytics and metrics for your deployed models.
 *
 *       **Metrics Available:**
 *       - Token usage (input/output tokens, costs)
 *       - Quality metrics (response quality, hallucination rates)
 *       - Tool usage statistics
 *       - Conversation metrics (length, turns, satisfaction)
 *       - Error rates and types
 *       - Latency measurements (p50, p95, p99)
 *
 *       **Use Cases:**
 *       - Embed real-time dashboards in your application
 *       - Monitor production model performance
 *       - Track costs and usage across time periods
 *       - Detect anomalies and degradation
 *       - Generate custom reports
 *
 *       **No UI Required** - Perfect for headless integrations!
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start of date range (ISO 8601)
 *         example: "2024-01-01T00:00:00Z"
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End of date range (ISO 8601)
 *         example: "2024-01-31T23:59:59Z"
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hour, day, week, month, all]
 *           default: day
 *         description: Aggregation period
 *         example: "day"
 *       - in: query
 *         name: metrics
 *         schema:
 *           type: string
 *         description: Comma-separated metrics to fetch (or "all")
 *         example: "tokens,quality,latency"
 *       - in: query
 *         name: model_id
 *         schema:
 *           type: string
 *         description: Filter by specific model ID
 *         example: "gpt-4-turbo"
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 dateRange:
 *                   type: object
 *                   properties:
 *                     start:
 *                       type: string
 *                       format: date-time
 *                     end:
 *                       type: string
 *                       format: date-time
 *                     period:
 *                       type: string
 *                       example: "day"
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokens:
 *                       type: object
 *                       description: Token usage metrics
 *                       properties:
 *                         total_input_tokens:
 *                           type: integer
 *                           example: 150000
 *                         total_output_tokens:
 *                           type: integer
 *                           example: 75000
 *                         estimated_cost:
 *                           type: number
 *                           example: 12.45
 *                     quality:
 *                       type: object
 *                       description: Response quality metrics
 *                       properties:
 *                         avg_quality_score:
 *                           type: number
 *                           example: 0.87
 *                         hallucination_rate:
 *                           type: number
 *                           example: 0.03
 *                     latency:
 *                       type: object
 *                       description: Latency statistics
 *                       properties:
 *                         p50_ms:
 *                           type: number
 *                           example: 1234.5
 *                         p95_ms:
 *                           type: number
 *                           example: 2456.8
 *                         p99_ms:
 *                           type: number
 *                           example: 3890.2
 *                     errors:
 *                       type: object
 *                       properties:
 *                         total_errors:
 *                           type: integer
 *                           example: 12
 *                         error_rate:
 *                           type: number
 *                           example: 0.012
 *       400:
 *         description: Bad request - Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
import { validateRequestWithScope } from '@/lib/auth/api-key-validator';
import { cacheGet, cacheSet, generateCacheKey } from '@/lib/cache/redis-cache';

export const runtime = 'nodejs';

// Cache TTL for analytics data (5 minutes - analytics don't change frequently)
const ANALYTICS_CACHE_TTL_MS = parseInt(process.env.ANALYTICS_CACHE_TTL_MS || '300000', 10);
const CACHE_PREFIX = 'api:analytics:data';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
const API_KEY_PREFIX = 'wak_';

/**
 * Authenticate user
 */
async function authenticateUser(req: NextRequest) {
  // API key auth (preferred for CI/production monitoring)
  const headerApiKey = req.headers.get('x-api-key') || req.headers.get('x-workspace-api-key');
  if (headerApiKey) {
    const validation = await validateRequestWithScope(req.headers, 'production');
    if (!validation.isValid || !validation.userId) {
      return {
        error: validation.errorMessage || 'Unauthorized',
        user: null,
        status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401),
      };
    }
    return { error: null, user: { id: validation.userId }, status: 200 };
  }

  // Session auth (UI)
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return { error: 'Unauthorized - no auth header', user: null, status: 401 };
  }

  // Support API key in Authorization: Bearer wak_...
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearerValue = bearerMatch?.[1]?.trim();
  if (bearerValue?.startsWith(API_KEY_PREFIX)) {
    const validation = await validateRequestWithScope(req.headers, 'production');
    if (!validation.isValid || !validation.userId) {
      return {
        error: validation.errorMessage || 'Unauthorized',
        user: null,
        status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401),
      };
    }
    return { error: null, user: { id: validation.userId }, status: 200 };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: 'Unauthorized - invalid token', user: null, status: 401 };
  }

  return { error: null, user, status: 200 };
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

  const maxRangeDays = parseInt(process.env.ANALYTICS_MAX_DATE_RANGE_DAYS || '90', 10);
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
 * Optimized: Runs all metric queries in parallel for better performance
 */
async function aggregateAnalyticsData(
  userId: string,
  dateRange: DateRange,
  metrics: string[]
): Promise<AnalyticsDataset> {
  console.log('[Analytics Data API] Aggregating data for user:', userId, 'metrics:', metrics.join(','));
  const startTime = Date.now();

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

  // Run all metric aggregations in parallel for better performance
  const aggregationPromises: Promise<void>[] = [];

  if (metrics.includes('tokens')) {
    aggregationPromises.push(
      aggregateTokenUsageData(userId, dateRange).then(data => {
        dataset.metrics.tokenUsage = data;
      })
    );
  }

  if (metrics.includes('quality')) {
    aggregationPromises.push(
      aggregateQualityMetrics(userId, dateRange).then(data => {
        dataset.metrics.quality = data;
      })
    );
  }

  if (metrics.includes('tools')) {
    aggregationPromises.push(
      aggregateToolUsageData(userId, dateRange).then(data => {
        dataset.metrics.tools = data;
      })
    );
  }

  if (metrics.includes('conversations')) {
    aggregationPromises.push(
      aggregateConversationMetrics(userId, dateRange).then(data => {
        dataset.metrics.conversations = data;
      })
    );
  }

  if (metrics.includes('errors')) {
    aggregationPromises.push(
      aggregateErrorData(userId, dateRange).then(data => {
        dataset.metrics.errors = data;
      })
    );
  }

  if (metrics.includes('latency')) {
    aggregationPromises.push(
      aggregateLatencyData(userId, dateRange).then(data => {
        dataset.metrics.latency = data;
      })
    );
  }

  // Wait for all aggregations to complete in parallel
  await Promise.all(aggregationPromises);

  const elapsed = Date.now() - startTime;
  console.log('[Analytics Data API] Data aggregation complete in', elapsed, 'ms');
  return dataset;
}

/**
 * GET handler
 * Optimized with in-memory caching to reduce database load under concurrent requests
 */
export async function GET(req: NextRequest) {
  try {
    const { error: authError, user, status } = await authenticateUser(req);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status: status || 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const metrics = searchParams.get('metrics');
    const granularity = searchParams.get('granularity') || 'day';
    const noCache = searchParams.get('noCache') === 'true';

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

    // Check Redis cache first (unless noCache is set)
    const cacheKey = generateCacheKey(CACHE_PREFIX, user.id, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      metrics: metricsArray.sort().join(','),
      granularity,
    });

    let dataset: AnalyticsDataset | null = null;
    let fromCache = false;

    if (!noCache) {
      dataset = await cacheGet<AnalyticsDataset>(cacheKey);
      if (dataset) {
        fromCache = true;
        console.log('[Analytics Data API] Cache HIT for user:', user.id);
      }
    }

    // If not in cache, compute and store
    if (!dataset) {
      console.log('[Analytics Data API] Cache MISS, computing for user:', user.id);
      dataset = await aggregateAnalyticsData(
        user.id,
        dateRange,
        metricsArray
      );

      // Store in Redis cache for future requests
      await cacheSet(cacheKey, dataset, ANALYTICS_CACHE_TTL_MS);
    }

    console.log('[Analytics Data API] Serving data for user:', user.id, 'fromCache:', fromCache);

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
          fromCache,
        },
      },
      {
        headers: {
          'Cache-Control': `private, max-age=${process.env.ANALYTICS_CACHE_MAX_AGE || '300'}`,
          'X-Cache': fromCache ? 'HIT' : 'MISS',
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
