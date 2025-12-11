/**
 * Time-Series Analytics Service
 * Aggregates and analyzes time-bucketed metrics data
 * Phase 1: Enhanced Data Collection Services
 * Date: October 25, 2025
 */

import { TrendData } from './types';

interface TimeBucket {
  timestamp: Date;
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
}

interface TimeSeriesData {
  period: 'hour' | 'day' | 'week' | 'month';
  buckets: TimeBucket[];
  totalDataPoints: number;
  trend: TrendData;
}

/**
 * Get time-series data with bucketing
 */
export async function getTimeSeriesData(
  dataPoints: Array<{ timestamp: Date; value: number }>,
  granularity: 'hour' | 'day' | 'week' | 'month'
): Promise<TimeSeriesData> {
  console.log('[TimeSeriesService] Getting time-series data', {
    dataPoints: dataPoints.length,
    granularity,
  });

  if (dataPoints.length === 0) {
    return {
      period: granularity,
      buckets: [],
      totalDataPoints: 0,
      trend: { direction: 'stable', changePercent: 0, dataPoints: 0, confidence: 'low' },
    };
  }

  const buckets = aggregateByPeriod(dataPoints, granularity);
  const trend = calculateTrends(buckets);

  console.log('[TimeSeriesService] Time-series data generated', {
    buckets: buckets.length,
    trend: trend.direction,
  });

  return {
    period: granularity,
    buckets,
    totalDataPoints: dataPoints.length,
    trend,
  };
}

/**
 * Aggregate data points into time buckets
 */
export function aggregateByPeriod(
  dataPoints: Array<{ timestamp: Date; value: number }>,
  period: 'hour' | 'day' | 'week' | 'month'
): TimeBucket[] {
  console.log('[TimeSeriesService] Aggregating by period', {
    dataPoints: dataPoints.length,
    period,
  });

  const bucketMap = new Map<string, number[]>();

  dataPoints.forEach((point) => {
    const bucketKey = getBucketKey(point.timestamp, period);
    if (!bucketMap.has(bucketKey)) {
      bucketMap.set(bucketKey, []);
    }
    bucketMap.get(bucketKey)!.push(point.value);
  });

  const buckets: TimeBucket[] = Array.from(bucketMap.entries())
    .map(([key, values]) => {
      const sum = values.reduce((a, b) => a + b, 0);
      return {
        timestamp: new Date(key),
        count: values.length,
        sum,
        average: sum / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    })
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  console.log('[TimeSeriesService] Aggregation complete', {
    buckets: buckets.length,
  });

  return buckets;
}

/**
 * Get bucket key for time period
 */
function getBucketKey(date: Date, period: 'hour' | 'day' | 'week' | 'month'): string {
  const d = new Date(date);
  
  switch (period) {
    case 'hour':
      d.setMinutes(0, 0, 0);
      return d.toISOString();
    case 'day':
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    case 'week': {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    case 'month':
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
  }
}

/**
 * Calculate trend from time buckets
 */
export function calculateTrends(buckets: TimeBucket[]): TrendData {
  if (buckets.length < 2) {
    return {
      direction: 'stable',
      changePercent: 0,
      dataPoints: buckets.length,
      confidence: 'low',
    };
  }

  const recentBuckets = buckets.slice(-5);
  const olderBuckets = buckets.slice(0, Math.min(5, buckets.length - 5));

  const recentAvg = recentBuckets.reduce((sum, b) => sum + b.average, 0) / recentBuckets.length;
  const olderAvg = olderBuckets.length > 0
    ? olderBuckets.reduce((sum, b) => sum + b.average, 0) / olderBuckets.length
    : recentAvg;

  const changePercent = olderAvg !== 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
  const direction = Math.abs(changePercent) < 5 ? 'stable' : changePercent > 0 ? 'up' : 'down';
  const confidence = buckets.length > 10 ? 'high' : buckets.length > 5 ? 'medium' : 'low';

  console.log('[TimeSeriesService] Trend calculated', {
    direction,
    changePercent: changePercent.toFixed(2),
    confidence,
  });

  return { direction, changePercent, dataPoints: buckets.length, confidence };
}

/**
 * Compare two time periods
 */
export function comparePeriods(
  currentPeriod: TimeBucket[],
  previousPeriod: TimeBucket[]
): {
  currentAverage: number;
  previousAverage: number;
  changePercent: number;
  changeDirection: 'up' | 'down' | 'stable';
} {
  console.log('[TimeSeriesService] Comparing periods', {
    current: currentPeriod.length,
    previous: previousPeriod.length,
  });

  const currentAvg = currentPeriod.length > 0
    ? currentPeriod.reduce((sum, b) => sum + b.average, 0) / currentPeriod.length
    : 0;

  const previousAvg = previousPeriod.length > 0
    ? previousPeriod.reduce((sum, b) => sum + b.average, 0) / previousPeriod.length
    : 0;

  const changePercent = previousAvg !== 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;
  const changeDirection = Math.abs(changePercent) < 5 ? 'stable' : changePercent > 0 ? 'up' : 'down';

  console.log('[TimeSeriesService] Period comparison complete', {
    changePercent: changePercent.toFixed(2),
    changeDirection,
  });

  return { currentAverage: currentAvg, previousAverage: previousAvg, changePercent, changeDirection };
}
