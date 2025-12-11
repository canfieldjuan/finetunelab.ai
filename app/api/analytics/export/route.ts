/**
 * Analytics Export API
 * POST /api/analytics/export
 * 
 * Generate analytics export files (CSV, JSON, or Report)
 * Phase 3: Backend API Endpoints
 * Date: October 25, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import {
  aggregateTokenUsageData,
  aggregateQualityMetrics,
  aggregateToolUsageData,
  aggregateConversationMetrics,
  aggregateErrorData,
  aggregateLatencyData,
} from '@/lib/analytics/dataAggregator';
import {
  generateCompleteDatasetCSV,
  generateOverviewCSV,
  generateTimeSeriesCSV,
  generateModelComparisonCSV,
  generateToolUsageCSV,
  generateQualityTrendsCSV,
} from '@/lib/analytics/export/csvGenerator';
import {
  generateStructuredJSON,
  generateFlatJSON,
  generateTimeSeriesJSON,
} from '@/lib/analytics/export/jsonGenerator';
import {
  generateExecutiveSummary,
  generateDetailedAnalysis,
  generateVisualizations,
  generateRecommendations,
} from '@/lib/analytics/export/reportGenerator';
import { writeExportFile } from '@/lib/analytics/export/storage';
import type { DateRange, AnalyticsDataset } from '@/lib/analytics/types';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface ExportRequest {
  startDate: string;
  endDate: string;
  format: 'csv' | 'json' | 'report';
  exportType: 'overview' | 'timeseries' | 'complete' | 'model_comparison' | 'tool_usage' | 'quality_trends';
  includeMetrics?: string[];
}

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
 * Validate export request
 */
function validateExportRequest(body: unknown): {
  request: ExportRequest | null;
  error: string | null;
} {
  console.log('[Analytics Export API] Validating request');

  if (!body || typeof body !== 'object') {
    return { request: null, error: 'Invalid request body' };
  }

  const req = body as Partial<ExportRequest>;

  if (!req.startDate || !req.endDate) {
    return { request: null, error: 'startDate and endDate are required' };
  }

  if (!req.format || !['csv', 'json', 'report'].includes(req.format)) {
    return { request: null, error: 'format must be csv, json, or report' };
  }

  const validTypes = ['overview', 'timeseries', 'complete', 'model_comparison', 'tool_usage', 'quality_trends'];
  if (!req.exportType || !validTypes.includes(req.exportType)) {
    return { request: null, error: `exportType must be one of: ${validTypes.join(', ')}` };
  }

  console.log('[Analytics Export API] Request valid');
  return { request: req as ExportRequest, error: null };
}

/**
 * Aggregate analytics data
 */
async function aggregateData(
  userId: string,
  startDate: string,
  endDate: string,
  includeMetrics?: string[]
): Promise<AnalyticsDataset> {
  console.log('[Analytics Export API] Aggregating data');

  const dateRange: DateRange = {
    start: new Date(startDate),
    end: new Date(endDate),
    period: 'all',
  };

  const metrics = includeMetrics || ['tokens', 'quality', 'tools', 'conversations', 'errors', 'latency'];

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

  console.log('[Analytics Export API] Data aggregation complete');
  return dataset;
}

/**
 * Generate export file content
 */
async function generateExportContent(
  dataset: AnalyticsDataset,
  format: string,
  exportType: string,
  exportId: string
): Promise<string> {
  console.log('[Analytics Export API] Generating', format, exportType);

  if (format === 'csv') {
    switch (exportType) {
      case 'overview':
        return generateOverviewCSV(dataset);
      case 'timeseries':
        return generateTimeSeriesCSV(dataset);
      case 'model_comparison':
        return generateModelComparisonCSV(dataset);
      case 'tool_usage':
        return generateToolUsageCSV(dataset);
      case 'quality_trends':
        return generateQualityTrendsCSV(dataset);
      case 'complete':
      default:
        return generateCompleteDatasetCSV(dataset);
    }
  }

  if (format === 'json') {
    switch (exportType) {
      case 'timeseries':
        return generateTimeSeriesJSON(dataset);
      case 'overview':
      case 'complete':
        return generateStructuredJSON(dataset, exportId);
      default:
        return generateFlatJSON(dataset);
    }
  }

  if (format === 'report') {
    const summary = generateExecutiveSummary(dataset);
    const analysis = generateDetailedAnalysis(dataset);
    const visualizations = generateVisualizations(dataset);
    const recommendations = generateRecommendations(dataset);

    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        userId: dataset.userId,
        period: {
          start: dataset.timeRange.start.toISOString(),
          end: dataset.timeRange.end.toISOString(),
        },
      },
      summary,
      sections: analysis,
      visualizations,
      recommendations,
    };

    return JSON.stringify(report, null, 2);
  }

  throw new Error(`Unsupported format: ${format}`);
}

/**
 * Create export record in database
 */
async function createExportRecord(
  userId: string,
  exportId: string,
  request: ExportRequest,
  filePath: string,
  fileSize: number
) {
  console.log('[Analytics Export API] Creating export record');

  const supabase = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
  );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data, error } = await supabase
    .from('analytics_exports')
    .insert({
      id: exportId,
      user_id: userId,
      format: request.format,
      export_type: request.exportType,
      start_date: request.startDate,
      end_date: request.endDate,
      included_metrics: JSON.stringify(request.includeMetrics || []),
      file_path: filePath,
      file_size: fileSize,
      file_name: `analytics_${request.exportType}_${exportId}.${request.format}`,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Analytics Export API] DB error:', error);
    throw new Error('Failed to create export record');
  }

  console.log('[Analytics Export API] Export record created');
  return data;
}

/**
 * POST handler
 */
export async function POST(req: NextRequest) {
  try {
    const { error: authError, user } = await authenticateUser(req);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    console.log('[Analytics Export API] Request from user:', user.id);

    const body = await req.json();
    const { request, error: validationError } = validateExportRequest(body);
    if (validationError || !request) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const exportId = randomUUID();

    const dataset = await aggregateData(
      user.id,
      request.startDate,
      request.endDate,
      request.includeMetrics
    );

    const content = await generateExportContent(
      dataset,
      request.format,
      request.exportType,
      exportId
    );

    const { filePath, fileSize } = await writeExportFile(
      exportId,
      request.format,
      content
    );

    const exportRecord = await createExportRecord(
      user.id,
      exportId,
      request,
      filePath,
      fileSize
    );

    console.log('[Analytics Export API] Export complete:', exportId);

    return NextResponse.json({
      success: true,
      exportId,
      downloadUrl: `/api/analytics/download/${exportId}`,
      expiresAt: exportRecord.expires_at,
      fileSize,
      format: request.format,
      exportType: request.exportType,
    });
  } catch (error) {
    console.error('[Analytics Export API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    );
  }
}
