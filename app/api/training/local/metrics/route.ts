/**
 * Local Training Metrics Persistence API
 * POST /api/training/local/metrics - Batch insert metrics (training server)
 * GET /api/training/local/metrics - Fetch metrics for a job (SDK/UI)
 *
 * Purpose: Batch insert training metrics for analytics, or fetch metrics
 * Called by: Python training server (localhost:8000), SDK, UI
 * Phase: Metrics Persistence
 * Date: 2025-10-27
 * Updated: 2025-12-13 - Added GET handler with API key auth for SDK access
 * Auth: POST requires job token, GET requires session or API key with 'training' scope
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateTraining } from '@/lib/auth/training-auth';

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
    // Verify job_token authentication (required for cloud-safe ingestion)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[LocalTrainingMetrics] Missing or invalid authorization header');
      return NextResponse.json(
        { error: 'Unauthorized: Bearer token required' },
        { status: 401 }
      );
    }

    const jobToken = authHeader.substring(7); // Remove 'Bearer ' prefix

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
    let supabase;
    try {
      supabase = createClient(supabaseUrl, supabaseServiceKey);
    } catch (clientError) {
      console.error('[LocalTrainingMetrics] Failed to create Supabase client:', clientError);
      return NextResponse.json(
        { error: 'Database client initialization failed', details: String(clientError) },
        { status: 500 }
      );
    }

    // Verify the job exists and token matches
    console.log('[LocalTrainingMetrics] Querying job:', job_id);
    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('id, job_token, status')
      .eq('id', job_id)
      .single();

    if (jobError) {
      console.error('[LocalTrainingMetrics] Job query error:', jobError);
      return NextResponse.json(
        { error: 'Job query failed', details: jobError.message },
        { status: 500 }
      );
    }

    if (!job) {
      console.error('[LocalTrainingMetrics] Job not found:', job_id);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    console.log('[LocalTrainingMetrics] Job found, comparing tokens');
    console.log('[LocalTrainingMetrics] DB token:', job.job_token?.substring(0, 10) + '...');
    console.log('[LocalTrainingMetrics] Request token:', jobToken?.substring(0, 10) + '...');

    if (job.job_token !== jobToken) {
      console.error('[LocalTrainingMetrics] Invalid job token - mismatch');
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

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

    // Update job progress based on the latest metric point (highest step)
    const latest = (metrics as MetricPoint[]).reduce<MetricPoint>((best, current) => {
      if (current.step > best.step) return current;
      return best;
    }, metrics[0] as MetricPoint);

    const latestTrainLoss = latest.train_loss ?? (latest as unknown as { loss?: number | null }).loss ?? null;
    const latestEpoch = latest.epoch ?? 0;

    const jobUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      current_step: latest.step,
      current_epoch: latestEpoch,
      loss: latestTrainLoss,
      eval_loss: latest.eval_loss ?? null,
      learning_rate: latest.learning_rate ?? null,
      grad_norm: latest.grad_norm ?? null,
      samples_per_second: latest.samples_per_second ?? null,
      gpu_memory_allocated_gb: latest.gpu_memory_allocated_gb ?? null,
      gpu_memory_reserved_gb: latest.gpu_memory_reserved_gb ?? null,
      gpu_utilization_percent: latest.gpu_utilization_percent ?? null,
      perplexity: latest.perplexity ?? null,
      train_perplexity: latest.train_perplexity ?? null,
    };

    // Keep job status consistent: first metrics implies the job is running.
    if (job.status === 'pending' || job.status === 'queued') {
      jobUpdate.status = 'running';
    }

    const { error: updateError } = await supabase
      .from('local_training_jobs')
      .update(jobUpdate)
      .eq('id', job_id);

    if (updateError) {
      // Do not fail metrics persistence if the summary update fails
      console.warn('[LocalTrainingMetrics] Job summary update failed:', updateError);
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

/**
 * GET /api/training/local/metrics
 * Fetch training metrics for a job
 *
 * Query parameters:
 * - job_id: Required - Training job ID
 * - limit: Max results (default 1000)
 * - offset: Pagination offset (default 0)
 *
 * Auth: Session token or API key with 'training' scope
 */
export async function GET(request: NextRequest) {
  console.log('[LocalTrainingMetrics] GET request received');

  // Verify Supabase configuration
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    // Authentication - supports both session tokens (UI) and API keys (SDK)
    const authResult = await authenticateTraining(request);
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const userId = authResult.userId;
    console.log('[LocalTrainingMetrics] User authenticated:', userId, 'mode:', authResult.mode);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('job_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '1000', 10), 5000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!jobId) {
      return NextResponse.json(
        { error: 'job_id query parameter is required' },
        { status: 400 }
      );
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First verify the user owns this job
    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobError || !job) {
      console.log('[LocalTrainingMetrics] Job not found or not owned by user:', jobId);
      return NextResponse.json(
        { error: 'Training job not found' },
        { status: 404 }
      );
    }

    // Fetch metrics for this job
    const { data: metrics, error: metricsError, count } = await supabase
      .from('local_training_metrics')
      .select('step, epoch, train_loss, eval_loss, learning_rate, grad_norm, samples_per_second, tokens_per_second, gpu_memory_allocated_gb, gpu_memory_reserved_gb, gpu_utilization_percent, perplexity, train_perplexity, timestamp', { count: 'exact' })
      .eq('job_id', jobId)
      .order('step', { ascending: true })
      .range(offset, offset + limit - 1);

    if (metricsError) {
      console.error('[LocalTrainingMetrics] Query error:', metricsError);
      return NextResponse.json(
        { error: 'Failed to fetch metrics', details: metricsError.message },
        { status: 500 }
      );
    }

    console.log('[LocalTrainingMetrics] Found', metrics?.length || 0, 'metrics for job', jobId);

    return NextResponse.json({
      job_id: jobId,
      metrics: metrics || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('[LocalTrainingMetrics] GET error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
