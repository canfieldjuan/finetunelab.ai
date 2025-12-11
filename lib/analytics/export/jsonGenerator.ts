/**
 * JSON Export Generator
 * Generates JSON exports from analytics data
 * Phase 2: Export Format Generators
 * Date: October 25, 2025
 */

import { AnalyticsDataset } from '../types';
import { JSONExport } from './types';

/**
 * Generate structured JSON export
 */
export function generateStructuredJSON(
  dataset: AnalyticsDataset,
  exportId: string
): string {
  console.log('[JSONGenerator] Generating structured JSON');

  const jsonExport: JSONExport = {
    metadata: {
      exportId,
      userId: dataset.userId,
      generatedAt: dataset.generatedAt.toISOString(),
      timeRange: {
        start: dataset.timeRange.start.toISOString(),
        end: dataset.timeRange.end.toISOString(),
        period: dataset.timeRange.period,
      },
      format: 'json-structured',
      version: '1.0.0',
    },
    data: dataset,
  };

  const json = JSON.stringify(jsonExport, null, 2);

  console.log('[JSONGenerator] Structured JSON generated');
  return json;
}

/**
 * Generate flat JSON export (optimized for APIs)
 */
export function generateFlatJSON(dataset: AnalyticsDataset): string {
  console.log('[JSONGenerator] Generating flat JSON');

  const flatData = {
    userId: dataset.userId,
    generatedAt: dataset.generatedAt.toISOString(),
    timeRange: {
      start: dataset.timeRange.start.toISOString(),
      end: dataset.timeRange.end.toISOString(),
      period: dataset.timeRange.period,
    },
    totals: dataset.aggregations.totals,
    averages: dataset.aggregations.averages,
    trends: dataset.aggregations.trends,
    dataPoints: {
      tokenUsage: dataset.metrics.tokenUsage.length,
      quality: dataset.metrics.quality.length,
      tools: dataset.metrics.tools.length,
      conversations: dataset.metrics.conversations.length,
      errors: dataset.metrics.errors.length,
      latency: dataset.metrics.latency.length,
    },
  };

  const json = JSON.stringify(flatData, null, 2);

  console.log('[JSONGenerator] Flat JSON generated');
  return json;
}

/**
 * Generate time-series optimized JSON
 */
export function generateTimeSeriesJSON(dataset: AnalyticsDataset): string {
  console.log('[JSONGenerator] Generating time-series JSON');

  const timeSeriesData = {
    metadata: {
      userId: dataset.userId,
      generatedAt: dataset.generatedAt.toISOString(),
      period: dataset.timeRange.period,
    },
    series: {
      tokenUsage: dataset.metrics.tokenUsage.map(point => ({
        t: point.timestamp.toISOString(),
        tokens: point.totalTokens,
        cost: point.estimatedCost,
        model: point.modelId,
      })),
      quality: dataset.metrics.quality.map(point => ({
        t: point.timestamp.toISOString(),
        rating: point.rating,
        status: point.successStatus,
        model: point.modelId,
      })),
      latency: dataset.metrics.latency.map(point => ({
        t: point.timestamp.toISOString(),
        ms: point.latencyMs,
        tps: point.tokensPerSecond,
        model: point.modelId,
      })),
    },
  };

  const json = JSON.stringify(timeSeriesData, null, 2);

  console.log('[JSONGenerator] Time-series JSON generated');
  return json;
}

/**
 * Validate JSON schema
 */
export function validateJSONSchema(jsonString: string): {
  valid: boolean;
  errors: string[];
} {
  console.log('[JSONGenerator] Validating JSON schema');

  const errors: string[] = [];

  try {
    const parsed = JSON.parse(jsonString);

    if (!parsed.metadata) {
      errors.push('Missing metadata section');
    }

    if (!parsed.data && !parsed.series) {
      errors.push('Missing data or series section');
    }

    if (parsed.metadata && !parsed.metadata.generatedAt) {
      errors.push('Missing generatedAt in metadata');
    }

    console.log('[JSONGenerator] Validation complete', {
      valid: errors.length === 0,
      errors: errors.length,
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    errors.push(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    console.error('[JSONGenerator] Validation failed:', errors);
    
    return {
      valid: false,
      errors,
    };
  }
}
