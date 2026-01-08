/**
 * Analytics Tool Metrics API
 * Provides aggregate performance data for analytics assistant tools
 * Date: 2026-01-02
 * Phase 4: Enhanced Logging
 *
 * GET /api/analytics/tools/metrics
 *   Query params:
 *     - user_id: Filter by user (optional, defaults to authenticated user)
 *     - tool_name: Filter by tool (optional)
 *     - start_date: Start of date range (ISO 8601, optional)
 *     - end_date: End of date range (ISO 8601, optional)
 *     - status: Filter by status (success/error, optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface ToolMetrics {
  tool_name: string;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  success_rate: number;
  avg_duration_ms: number | null;
  median_duration_ms: number | null;
  p95_duration_ms: number | null;
  error_breakdown: Record<string, number>;
}

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const toolName = searchParams.get('tool_name');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const status = searchParams.get('status');

    // Build query
    let query = authClient
      .from('analytics_tool_logs')
      .select('*')
      .eq('user_id', user.id); // Users can only see their own metrics

    if (toolName) {
      query = query.eq('tool_name', toolName);
    }

    if (startDate) {
      query = query.gte('started_at', startDate);
    }

    if (endDate) {
      query = query.lte('started_at', endDate);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: logs, error } = await query.order('started_at', { ascending: false });

    if (error) {
      console.error('[ToolMetricsAPI] Error fetching logs:', error);
      return NextResponse.json({ error: 'Failed to fetch tool metrics' }, { status: 500 });
    }

    // Aggregate metrics by tool
    const metricsByTool = new Map<string, ToolMetrics>();

    for (const log of logs || []) {
      const toolName = log.tool_name;

      if (!metricsByTool.has(toolName)) {
        metricsByTool.set(toolName, {
          tool_name: toolName,
          total_executions: 0,
          successful_executions: 0,
          failed_executions: 0,
          success_rate: 0,
          avg_duration_ms: null,
          median_duration_ms: null,
          p95_duration_ms: null,
          error_breakdown: {},
        });
      }

      const metrics = metricsByTool.get(toolName)!;
      metrics.total_executions++;

      if (log.status === 'success') {
        metrics.successful_executions++;
      } else if (log.status === 'error') {
        metrics.failed_executions++;

        // Track error types
        const errorType = log.error_type || 'unknown';
        metrics.error_breakdown[errorType] = (metrics.error_breakdown[errorType] || 0) + 1;
      }
    }

    // Calculate success rates and duration stats
    for (const metrics of metricsByTool.values()) {
      metrics.success_rate = metrics.total_executions > 0
        ? (metrics.successful_executions / metrics.total_executions) * 100
        : 0;

      // Get durations for this tool
      const durations = logs
        ?.filter(log => log.tool_name === metrics.tool_name && log.duration_ms !== null)
        .map(log => log.duration_ms!)
        .sort((a, b) => a - b) || [];

      if (durations.length > 0) {
        // Average
        metrics.avg_duration_ms = Math.round(
          durations.reduce((sum, d) => sum + d, 0) / durations.length
        );

        // Median
        const midpoint = Math.floor(durations.length / 2);
        metrics.median_duration_ms = durations.length % 2 === 0
          ? Math.round((durations[midpoint - 1] + durations[midpoint]) / 2)
          : durations[midpoint];

        // P95
        const p95Index = Math.floor(durations.length * 0.95);
        metrics.p95_duration_ms = durations[p95Index];
      }
    }

    // Convert to array and sort by total executions
    const metricsArray = Array.from(metricsByTool.values())
      .sort((a, b) => b.total_executions - a.total_executions);

    return NextResponse.json({
      success: true,
      metrics: metricsArray,
      total_tools: metricsArray.length,
      date_range: {
        start: startDate || 'all',
        end: endDate || 'now',
      },
    });

  } catch (error) {
    console.error('[ToolMetricsAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
