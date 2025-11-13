/**
 * Local Training Metrics Persistence API
 * POST /api/training/local/metrics
 *
 * Purpose: Batch insert training metrics for analytics
 * Called by: Python training server (localhost:8000)
 * Phase: Metrics Persistence
 * Date: 2025-10-27
 * Auth: Requires user authentication via Bearer token
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[LocalTrainingMetrics] CRITICAL: Missing environment variables!');
  console.error('[LocalTrainingMetrics] NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('[LocalTrainingMetrics] SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
}

interface MetricPoint {
  step: number;
  epoch: number;
  train_loss?: number | null;
  eval_loss?: number | null;
  learning_rate?: number | null;
  grad_norm?: number | null;
  gpu_memory_allocated_gb?: number | null;
  gpu_memory_reserved_gb?: number | null;
  gpu_utilization_percent?: number | null;
  perplexity?: number | null;
  train_perplexity?: number | null;
  samples_per_second?: number | null;
  tokens_per_second?: number | null;
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  console.log('[LocalTrainingMetrics] POST request received');

  // Verify Supabase configuration
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    // Check if request has a body
    const contentLength = request.headers.get('content-length');
    if (!contentLength || contentLength === '0') {
      console.log('[LocalTrainingMetrics] Empty request body received');
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      );
    }

    // Parse JSON with error handling
    let body;
    try {
      // Clone the request to read the raw text for debugging
      const clonedRequest = request.clone();
      const rawText = await clonedRequest.text();
      
      if (!rawText || rawText.trim().length === 0) {
        console.error('[LocalTrainingMetrics] Empty request body received');
        return NextResponse.json(
          { error: 'Empty request body' },
          { status: 400 }
        );
      }
      
      body = JSON.parse(rawText);
    } catch (parseError) {
      console.error('[LocalTrainingMetrics] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { job_id, metrics } = body;

    console.log('[LocalTrainingMetrics] Persisting metrics for job:', job_id);
    console.log('[LocalTrainingMetrics] Metrics count:', metrics?.length || 0);

    if (!job_id) {
      return NextResponse.json(
        { error: 'job_id is required' },
        { status: 400 }
      );
    }

    if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
      return NextResponse.json(
        { error: 'metrics array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key
    // Service role bypasses RLS and never expires
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const metricsData = metrics.map((m: MetricPoint) => ({
      job_id,
      step: m.step,
      epoch: m.epoch,
      train_loss: m.train_loss ?? null,
      eval_loss: m.eval_loss ?? null,
      learning_rate: m.learning_rate ?? null,
      grad_norm: m.grad_norm ?? null,
      gpu_memory_allocated_gb: m.gpu_memory_allocated_gb ?? null,
      gpu_memory_reserved_gb: m.gpu_memory_reserved_gb ?? null,
      gpu_utilization_percent: m.gpu_utilization_percent ?? null,
      perplexity: m.perplexity ?? null,
      train_perplexity: m.train_perplexity ?? null,
      samples_per_second: m.samples_per_second ?? null,
      tokens_per_second: m.tokens_per_second ?? null,
      timestamp: m.timestamp ?? new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('local_training_metrics')
      .insert(metricsData)
      .select();

    if (error) {
      console.error('[LocalTrainingMetrics] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to persist metrics', details: error.message },
        { status: 500 }
      );
    }

    console.log('[LocalTrainingMetrics] Persisted', data?.length || 0, 'metric points');

    return NextResponse.json({
      success: true,
      count: data?.length || 0
    });

  } catch (error) {
    console.error('[LocalTrainingMetrics] Request error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
