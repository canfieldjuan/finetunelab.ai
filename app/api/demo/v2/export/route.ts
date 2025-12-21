/**
 * Demo V2 Export API
 * GET /api/demo/v2/export - Export demo batch test results
 *
 * Query params:
 * - session_id: Demo session ID (required)
 * - format: csv | json (default: csv)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDemoSessionMetrics,
  getDemoPromptResults,
  getDemoTestRunSummary,
  validateDemoSession,
} from '@/lib/demo/demo-analytics.service';

export const runtime = 'nodejs';

/**
 * Escape CSV value
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Convert results to CSV format
 */
function generateCSV(
  results: Array<{
    id: string;
    prompt: string;
    response: string | null;
    latency_ms: number;
    success: boolean;
    error: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    created_at: string;
  }>,
  metrics: {
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
  },
  modelName: string
): string {
  const lines: string[] = [];

  // Header section
  lines.push('# Demo Batch Test Export');
  lines.push(`# Model: ${modelName}`);
  lines.push(`# Export Date: ${new Date().toISOString()}`);
  lines.push(`# Powered by FineTuneLab`);
  lines.push('');

  // Metrics summary
  lines.push('# Summary Metrics');
  lines.push(`Total Prompts,${metrics.totalPrompts}`);
  lines.push(`Successful,${metrics.completedPrompts}`);
  lines.push(`Failed,${metrics.failedPrompts}`);
  lines.push(`Success Rate,${metrics.successRate.toFixed(1)}%`);
  lines.push(`Average Latency,${metrics.avgLatencyMs.toFixed(0)}ms`);
  lines.push(`P50 Latency,${metrics.p50LatencyMs.toFixed(0)}ms`);
  lines.push(`P95 Latency,${metrics.p95LatencyMs.toFixed(0)}ms`);
  lines.push(`P99 Latency,${metrics.p99LatencyMs.toFixed(0)}ms`);
  lines.push(`Total Input Tokens,${metrics.totalInputTokens}`);
  lines.push(`Total Output Tokens,${metrics.totalOutputTokens}`);
  lines.push('');

  // Results header
  lines.push('# Individual Results');
  lines.push('prompt_id,prompt,response,latency_ms,success,error,input_tokens,output_tokens,created_at');

  // Results data
  for (const result of results) {
    const row = [
      escapeCSVValue(result.id),
      escapeCSVValue(result.prompt),
      escapeCSVValue(result.response),
      escapeCSVValue(result.latency_ms),
      escapeCSVValue(result.success),
      escapeCSVValue(result.error),
      escapeCSVValue(result.input_tokens),
      escapeCSVValue(result.output_tokens),
      escapeCSVValue(result.created_at),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/**
 * Generate JSON export
 */
function generateJSON(
  results: Array<{
    id: string;
    prompt: string;
    response: string | null;
    latency_ms: number;
    success: boolean;
    error: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    created_at: string;
  }>,
  metrics: {
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
  },
  modelName: string,
  testRun: {
    id: string;
    status: string;
    started_at: string;
    completed_at: string | null;
  } | null
): object {
  return {
    meta: {
      exportedAt: new Date().toISOString(),
      model: modelName,
      poweredBy: 'FineTuneLab',
    },
    testRun: testRun ? {
      id: testRun.id,
      status: testRun.status,
      startedAt: testRun.started_at,
      completedAt: testRun.completed_at,
    } : null,
    metrics: {
      totalPrompts: metrics.totalPrompts,
      successfulPrompts: metrics.completedPrompts,
      failedPrompts: metrics.failedPrompts,
      successRate: parseFloat(metrics.successRate.toFixed(1)),
      latency: {
        average: parseFloat(metrics.avgLatencyMs.toFixed(0)),
        p50: parseFloat(metrics.p50LatencyMs.toFixed(0)),
        p95: parseFloat(metrics.p95LatencyMs.toFixed(0)),
        p99: parseFloat(metrics.p99LatencyMs.toFixed(0)),
      },
      tokens: {
        totalInput: metrics.totalInputTokens,
        totalOutput: metrics.totalOutputTokens,
        total: metrics.totalInputTokens + metrics.totalOutputTokens,
      },
    },
    results: results.map(r => ({
      id: r.id,
      prompt: r.prompt,
      response: r.response,
      latencyMs: r.latency_ms,
      success: r.success,
      error: r.error,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      createdAt: r.created_at,
    })),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    const format = searchParams.get('format') || 'csv';

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id parameter' }, { status: 400 });
    }

    if (format !== 'csv' && format !== 'json') {
      return NextResponse.json({ error: 'Invalid format. Use csv or json' }, { status: 400 });
    }

    // Validate session
    const validation = await validateDemoSession(sessionId);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid session' },
        { status: validation.error === 'Session expired' ? 410 : 404 }
      );
    }

    // Get all data
    const [metrics, results, testRun] = await Promise.all([
      getDemoSessionMetrics(sessionId),
      getDemoPromptResults(sessionId, { limit: 1000 }),
      getDemoTestRunSummary(sessionId),
    ]);

    if (!metrics) {
      return NextResponse.json({ error: 'No test results found' }, { status: 404 });
    }

    const modelName = validation.modelName || 'Unknown Model';
    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const jsonContent = generateJSON(results, metrics, modelName, testRun);

      return new Response(JSON.stringify(jsonContent, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="finetunelab-batch-test-${timestamp}.json"`,
        },
      });
    }

    // CSV format
    const csvContent = generateCSV(results, metrics, modelName);

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="finetunelab-batch-test-${timestamp}.csv"`,
      },
    });
  } catch (error) {
    console.error('[DemoExport] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
