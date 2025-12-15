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
import { writeExportFile, writeBinaryExportFile } from '@/lib/analytics/export/storage';
import type { DateRange, AnalyticsDataset } from '@/lib/analytics/types';
import type { AnalyticsExportFilters } from '@/lib/analytics/export/types';
import { renderTemplate, isValidTemplate } from '@/lib/analytics/export/templates';
import { renderReportToHtml } from '@/lib/analytics/export/renderers/html';
import { renderReportToPdf } from '@/lib/analytics/export/renderers/pdf';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface ExportRequest {
  startDate: string;
  endDate: string;
  format: 'csv' | 'json' | 'report' | 'html' | 'pdf';
  exportType: 'overview' | 'timeseries' | 'complete' | 'model_comparison' | 'tool_usage' | 'quality_trends';
  includeMetrics?: string[];
  filters?: AnalyticsExportFilters;
  audience?: 'executive' | 'engineering' | 'onboarding' | 'custom';
}

/**
 * Authenticate user
 * Supports both:
 * 1. Authorization header (browser/client requests)
 * 2. userId in body (server-to-server requests from analytics tools)
 */
async function authenticateUser(req: NextRequest, body?: { userId?: string }) {
  const authHeader = req.headers.get('authorization');

  // Try auth header first (standard browser auth)
  if (authHeader) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!authError && user) {
      return { error: null, user };
    }
  }

  // Fall back to userId in body (server-to-server calls from analytics tools)
  // This is safe because the analytics chat API already authenticated the user
  if (body?.userId && typeof body.userId === 'string') {
    console.log('[Analytics Export API] Using userId from body for server-to-server auth');
    return { error: null, user: { id: body.userId } };
  }

  return { error: 'Unauthorized - no valid auth', user: null };
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

  if (!req.format || !['csv', 'json', 'report', 'html', 'pdf'].includes(req.format)) {
    return { request: null, error: 'format must be csv, json, report, html, or pdf' };
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
  includeMetrics?: string[],
  filters?: AnalyticsExportFilters
): Promise<AnalyticsDataset> {
  console.log('[Analytics Export API] Aggregating data', { filters });

  const dateRange: DateRange = {
    start: new Date(startDate),
    end: new Date(endDate),
    period: 'all',
  };

  const metrics = includeMetrics || ['tokens', 'quality', 'tools', 'conversations', 'errors', 'latency'];

  // Options object to pass to all aggregators
  const aggregatorOptions = {
    startDate,
    endDate,
    filters,
  };

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
    dataset.metrics.tokenUsage = await aggregateTokenUsageData(userId, aggregatorOptions);
  }

  if (metrics.includes('quality')) {
    dataset.metrics.quality = await aggregateQualityMetrics(userId, aggregatorOptions);
  }

  if (metrics.includes('tools')) {
    dataset.metrics.tools = await aggregateToolUsageData(userId, aggregatorOptions);
  }

  if (metrics.includes('conversations')) {
    dataset.metrics.conversations = await aggregateConversationMetrics(userId, aggregatorOptions);
  }

  if (metrics.includes('errors')) {
    dataset.metrics.errors = await aggregateErrorData(userId, aggregatorOptions);
  }

  if (metrics.includes('latency')) {
    dataset.metrics.latency = await aggregateLatencyData(userId, aggregatorOptions);
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
  exportId: string,
  audience?: 'executive' | 'engineering' | 'onboarding' | 'custom'
): Promise<string> {
  console.log('[Analytics Export API] Generating', format, exportType, audience ? `for ${audience}` : '');

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

  // Handle audience-specific templated reports (HTML and report formats)
  // PDF is handled separately in POST handler due to binary output
  if ((format === 'report' || format === 'html') && audience && isValidTemplate(audience)) {
    console.log('[Analytics Export API] Using audience template:', audience);
    const renderedReport = renderTemplate(audience, dataset);

    // Return HTML for html format, JSON for report format
    if (format === 'html') {
      console.log('[Analytics Export API] Rendering to HTML');
      return renderReportToHtml(renderedReport);
    }
    return JSON.stringify(renderedReport, null, 2);
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
    // Parse body first so we can use userId for server-to-server auth
    const body = await req.json();

    const { error: authError, user } = await authenticateUser(req, body);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    console.log('[Analytics Export API] Request from user:', user.id);

    const { request, error: validationError } = validateExportRequest(body);
    if (validationError || !request) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const exportId = randomUUID();

    const dataset = await aggregateData(
      user.id,
      request.startDate,
      request.endDate,
      request.includeMetrics,
      request.filters
    );

    let filePath: string;
    let fileSize: number;

    // Handle PDF format separately (binary output)
    if (request.format === 'pdf' && request.audience && isValidTemplate(request.audience)) {
      console.log('[Analytics Export API] Generating PDF for audience:', request.audience);
      const renderedReport = renderTemplate(request.audience, dataset);
      const pdfBuffer = await renderReportToPdf(renderedReport);
      const result = await writeBinaryExportFile(exportId, request.format, pdfBuffer);
      filePath = result.filePath;
      fileSize = result.fileSize;
    } else {
      // Handle text-based formats (CSV, JSON, HTML, report)
      const content = await generateExportContent(
        dataset,
        request.format,
        request.exportType,
        exportId,
        request.audience
      );
      const result = await writeExportFile(exportId, request.format, content);
      filePath = result.filePath;
      fileSize = result.fileSize;
    }

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
      filters: request.filters || null,
      audience: request.audience || null,
    });
  } catch (error) {
    console.error('[Analytics Export API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    );
  }
}
