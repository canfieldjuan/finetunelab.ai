/**
 * DAG Metrics Endpoint
 * 
 * GET /api/training/dag/metrics/[id] - Get real-time metrics for a DAG execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: executionId } = await params;

    if (!executionId) {
      return NextResponse.json(
        { error: 'Missing execution ID' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[DAG-METRICS] Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[DAG-METRICS] Fetching metrics for execution: ${executionId}`);

    type TrainingMetricRow = {
      metric_name: string;
      timestamp: string;
      metric_value: number | null;
      metric_string: string | null;
      metadata?: Record<string, unknown> | null;
    };

    const { data: metrics, error } = await supabase
      .from('training_metrics')
      .select('*')
      .eq('job_id', executionId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('[DAG-METRICS] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch metrics', details: error.message },
        { status: 500 }
      );
    }

    const groupedMetrics: Record<string, Array<{
      timestamp: string;
      value: number | null;
      stringValue: string | null;
      metadata?: Record<string, unknown> | null;
    }>> = {};
    
    ((metrics || []) as TrainingMetricRow[]).forEach((metric) => {
      if (!groupedMetrics[metric.metric_name]) {
        groupedMetrics[metric.metric_name] = [];
      }
      
      groupedMetrics[metric.metric_name].push({
        timestamp: metric.timestamp,
        value: metric.metric_value,
        stringValue: metric.metric_string,
        metadata: metric.metadata,
      });
    });

    console.log(`[DAG-METRICS] Returning ${Object.keys(groupedMetrics).length} metric types`);

    return NextResponse.json({
      success: true,
      executionId,
      metrics: groupedMetrics,
      totalDataPoints: metrics?.length || 0,
    });

  } catch (error) {
    console.error('[DAG-METRICS] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
