/**
 * Demo Export Handler with Persona Support
 * Connects demo batch test results to unified export v2 system
 * Supports: Executive, Engineering, Onboarding personas
 * Date: 2026-01-03
 */

import type { NextRequest } from 'next/server';
import type { AnalyticsDataset } from '@/lib/analytics/types';

export interface DemoExportRequest {
  sessionId: string;
  format: 'csv' | 'json' | 'html' | 'pdf';
  audience?: 'executive' | 'engineering' | 'onboarding';
}

export interface DemoExportMetrics {
  totalPrompts: number;
  completedPrompts: number;
  failedPrompts: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  successRate: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
}

export interface DemoPromptResult {
  id: string;
  prompt: string;
  response: string | null;
  latency_ms: number;
  success: boolean;
  error: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

/**
 * Transform demo batch test results into analytics export format
 * This bridges the gap between demo API and unified export v2
 */
export function transformDemoToAnalyticsDataset(
  sessionId: string,
  modelName: string,
  metrics: DemoExportMetrics,
  results: DemoPromptResult[],
  audience: 'executive' | 'engineering' | 'onboarding' = 'executive'
): AnalyticsDataset {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);

  // Build dataset that matches AnalyticsDataset interface
  // from lib/analytics/types.ts
  return {
    userId: `demo-${sessionId}`,
    timeRange: {
      start: oneHourAgo,
      end: now,
      period: 'hour' as const,
    },
    metrics: {
      tokenUsage: results.map((r, idx) => ({
        timestamp: new Date(r.created_at),
        messageId: r.id,
        inputTokens: r.input_tokens || 0,
        outputTokens: r.output_tokens || 0,
        totalTokens: (r.input_tokens || 0) + (r.output_tokens || 0),
        estimatedCost: 0, // Demo mode, no cost tracking
        modelId: modelName,
        conversationId: `demo-conv-${idx}`,
      })),
      quality: results.map((r, idx) => ({
        timestamp: new Date(r.created_at),
        messageId: r.id,
        conversationId: `demo-conv-${idx}`,
        modelId: modelName,
        rating: r.success ? 5 : 1,
        successStatus: r.success ? 'success' : 'failure',
        evaluationType: 'demo',
      })),
      tools: [], // Demo doesn't track tool usage
      conversations: [{
        timestamp: oneHourAgo,
        conversationId: sessionId,
        messageCount: results.length,
        turnCount: results.length,
        durationMs: now.getTime() - oneHourAgo.getTime(),
        completionStatus: 'completed',
        modelId: modelName,
      }],
      errors: results
        .filter(r => !r.success && r.error)
        .map(r => ({
          timestamp: new Date(r.created_at),
          messageId: r.id,
          conversationId: sessionId,
          errorType: 'execution_error',
          errorMessage: r.error || 'Unknown error',
          fallbackUsed: false,
          modelId: modelName,
        })),
      latency: results.map((r, idx) => ({
        timestamp: new Date(r.created_at),
        messageId: r.id,
        conversationId: `demo-conv-${idx}`,
        modelId: modelName,
        latencyMs: r.latency_ms,
        tokenCount: (r.input_tokens || 0) + (r.output_tokens || 0),
        tokensPerSecond: r.latency_ms > 0
          ? ((r.input_tokens || 0) + (r.output_tokens || 0)) / (r.latency_ms / 1000)
          : 0,
      })),
    },
    aggregations: {
      totals: {
        messages: metrics.totalPrompts,
        conversations: 1,
        tokens: metrics.totalInputTokens + metrics.totalOutputTokens,
        cost: metrics.totalCost,
        evaluations: 0,
        errors: metrics.failedPrompts,
      },
      averages: {
        tokensPerMessage: (metrics.totalInputTokens + metrics.totalOutputTokens) / metrics.totalPrompts,
        costPerMessage: metrics.totalCost / metrics.totalPrompts,
        rating: metrics.successRate / 20, // Convert % to 1-5 scale
        successRate: metrics.successRate,
        errorRate: 100 - metrics.successRate,
        latencyMs: metrics.avgLatencyMs,
      },
      trends: {
        tokenUsage: {
          direction: 'stable' as const,
          changePercent: 0,
          dataPoints: results.length,
          confidence: 'medium' as const,
        },
        quality: {
          direction: metrics.successRate >= 80 ? ('up' as const) : ('down' as const),
          changePercent: 0,
          dataPoints: results.length,
          confidence: 'medium' as const,
        },
        latency: {
          direction: 'stable' as const,
          changePercent: 0,
          dataPoints: results.length,
          confidence: 'medium' as const,
        },
        errorRate: {
          direction: metrics.failedPrompts === 0 ? ('up' as const) : ('stable' as const),
          changePercent: 0,
          dataPoints: results.length,
          confidence: 'medium' as const,
        },
      },
    },
    generatedAt: now,
  };
}

/**
 * Get audience-specific export configuration
 */
export function getPersonaExportConfig(audience: 'executive' | 'engineering' | 'onboarding') {
  switch (audience) {
    case 'executive':
      return {
        includeMetadata: true,
        includeCharts: true,
        includeRecommendations: true,
        detailLevel: 'low' as const,
        technicalLanguage: false,
        maxPages: 1,
        sections: ['summary', 'kpis', 'cost-trend', 'actions'],
      };

    case 'engineering':
      return {
        includeMetadata: true,
        includeCharts: true,
        includeRecommendations: true,
        detailLevel: 'high' as const,
        technicalLanguage: true,
        maxPages: undefined,
        sections: ['summary', 'performance', 'errors', 'latency', 'optimization'],
      };

    case 'onboarding':
      return {
        includeMetadata: true,
        includeCharts: true,
        includeRecommendations: false,
        detailLevel: 'medium' as const,
        technicalLanguage: false,
        maxPages: 5,
        sections: ['overview', 'usage-patterns', 'best-practices', 'faq'],
      };
  }
}

/**
 * Example usage documentation
 */
export const USAGE_EXAMPLE = `
// In your API route handler:

import { getDemoSessionMetrics, getDemoPromptResults } from '@/lib/demo/demo-analytics.service';
import { transformDemoToAnalyticsDataset, getPersonaExportConfig } from '@/BYOM-Demo-Test-Page/demo-export-handler';
import { renderTemplate } from '@/lib/analytics/export/templates';
import { renderReportToHtml, renderReportToPdf } from '@/lib/analytics/export/renderers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id')!;
  const format = searchParams.get('format') as 'html' | 'pdf';
  const audience = searchParams.get('audience') as 'executive' | 'engineering' | 'onboarding';

  // Fetch demo data
  const metrics = await getDemoSessionMetrics(sessionId);
  const results = await getDemoPromptResults(sessionId);
  const modelName = 'demo-model'; // Get from session

  // Transform to analytics dataset
  const dataset = transformDemoToAnalyticsDataset(
    sessionId,
    modelName,
    metrics,
    results,
    audience
  );

  // Render using persona template
  const renderedReport = renderTemplate(audience, dataset);

  // Generate output
  if (format === 'html') {
    const html = renderReportToHtml(renderedReport);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  } else {
    const pdfBuffer = await renderReportToPdf(renderedReport);
    return new Response(pdfBuffer, {
      headers: { 'Content-Type': 'application/pdf' }
    });
  }
}
`;
