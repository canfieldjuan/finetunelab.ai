/**
 * Local Training Job Status API
 * GET /api/training/local/[jobId]/status
 *
 * Purpose: Get detailed status and metrics for a local training job
 * Reads from Supabase database (local_training_jobs + local_training_metrics)
 *
 * Phase 3: Database Integration
 * Date: 2025-10-28
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[LocalTraining Status] GET status for job:', jobId);

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    // Authentication - verify user is logged in
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.log('[LocalTraining Status] No authorization header provided');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.log('[LocalTraining Status] Authentication failed:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[LocalTraining Status] User authenticated:', user.id);

    // Use service role key for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get job details - filter by user_id for security
    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id) // Security: Only allow users to view their own jobs
      .single();

    if (jobError) {
      console.error('[LocalTraining Status] Job query error:', jobError);
      return NextResponse.json(
        { error: 'Training job not found', details: jobError.message },
        { status: 404 }
      );
    }

    if (!job) {
      console.error('[LocalTraining Status] Job not found:', jobId);
      return NextResponse.json(
        { error: 'Training job not found' },
        { status: 404 }
      );
    }

    console.log('[LocalTraining Status] Job found:', job.id, 'status:', job.status);

    // Get latest metrics with all fields
    const { data: latestMetric } = await supabase
      .from('local_training_metrics')
      .select('*')
      .eq('job_id', jobId)
      .order('step', { ascending: false })
      .limit(1)
      .single();

    // Get recent metrics for trend calculation (last 10 points)
    const { data: recentMetrics } = await supabase
      .from('local_training_metrics')
      .select('step, train_loss')
      .eq('job_id', jobId)
      .order('step', { ascending: false })
      .limit(10);

    // Calculate loss trend if we have enough data
    let calculatedLossTrend = job.loss_trend; // Use persisted value if available
    if (!calculatedLossTrend && recentMetrics && recentMetrics.length >= 5) {
      const losses = recentMetrics
        .filter(m => m.train_loss !== null)
        .map(m => m.train_loss as number)
        .reverse(); // Oldest to newest

      if (losses.length >= 5) {
        const firstHalf = losses.slice(0, Math.floor(losses.length / 2));
        const secondHalf = losses.slice(Math.floor(losses.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

        if (changePercent < -5) {
          calculatedLossTrend = 'improving';
        } else if (changePercent > 5) {
          calculatedLossTrend = 'degrading';
        } else {
          calculatedLossTrend = 'stable';
        }
      }
    }

    // Calculate progress
    let progress = 0;
    if (job.total_steps && latestMetric) {
      progress = Math.round((latestMetric.step / job.total_steps) * 100);
    }

    // Calculate elapsed and remaining time
    let elapsed_seconds = 0;
    let remaining_seconds = 0;
    if (job.started_at) {
      const startTime = new Date(job.started_at).getTime();
      const now = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
      elapsed_seconds = Math.round((now - startTime) / 1000);

      // Estimate remaining time based on progress
      if (progress > 0 && progress < 100 && job.status === 'running') {
        const timePerPercent = elapsed_seconds / progress;
        remaining_seconds = Math.round(timePerPercent * (100 - progress));
      }
    }

    // Calculate epochs without improvement
    let epochs_without_improvement = 0;
    if (job.best_epoch !== null && latestMetric?.epoch) {
      epochs_without_improvement = latestMetric.epoch - job.best_epoch;
    }

    // Helper function to safely calculate perplexity
    const safeExp = (value: number | null | undefined): number | null => {
      if (value === null || value === undefined) return null;
      const result = Math.exp(value);
      // Check for infinity or NaN
      if (!isFinite(result)) return null;
      return result;
    };

    // Check for stale job (no updates in > 5 minutes)
    let staleWarning: string | undefined;
    if (job.status === 'running' || job.status === 'pending') {
      const updated_at = job.updated_at;
      if (updated_at) {
        const lastUpdateTime = new Date(updated_at).getTime();
        const now = Date.now();
        const staleDuration = (now - lastUpdateTime) / 1000; // seconds

        if (staleDuration > 300) { // 5 minutes = 300 seconds
          const minutes = Math.floor(staleDuration / 60);
          staleWarning = `⚠️ No updates received in ${minutes} minute(s). The training process may have terminated unexpectedly.`;
          console.log('[LocalTraining Status] Stale job detected:', jobId, 'stale for', minutes, 'minutes');
        }
      }
    }

    const statusResponse = {
      job_id: jobId,
      status: job.status,
      model_name: job.model_name,

      // Progress
      current_step: latestMetric?.step || 0,
      current_epoch: latestMetric?.epoch || 0,
      total_steps: job.total_steps,
      total_epochs: job.total_epochs,
      total_samples: job.total_samples,
      progress: progress,

      // Loss metrics
      loss: latestMetric?.train_loss,
      eval_loss: latestMetric?.eval_loss,
      best_eval_loss: job.best_eval_loss,
      best_epoch: job.best_epoch,
      best_step: job.best_step,
      loss_trend: calculatedLossTrend,
      epochs_without_improvement: epochs_without_improvement,

      // Perplexity - with safety checks for Infinity/NaN
      train_perplexity: latestMetric?.train_perplexity || safeExp(latestMetric?.train_loss),
      eval_perplexity: latestMetric?.perplexity || safeExp(latestMetric?.eval_loss),

      // Training parameters
      learning_rate: latestMetric?.learning_rate,
      grad_norm: latestMetric?.grad_norm,

      // GPU metrics
      gpu_memory_allocated_gb: latestMetric?.gpu_memory_allocated_gb,
      gpu_memory_reserved_gb: latestMetric?.gpu_memory_reserved_gb,
      gpu_utilization_percent: latestMetric?.gpu_utilization_percent,

      // Throughput
      samples_per_second: latestMetric?.samples_per_second,
      tokens_per_second: latestMetric?.tokens_per_second,

      // Timestamps
      started_at: job.started_at,
      completed_at: job.completed_at,
      elapsed_seconds: elapsed_seconds,
      remaining_seconds: remaining_seconds,

      // Error if failed
      error: job.status === 'failed' ? (job.config?.error || 'Training failed') : undefined,

      // Warning for stale jobs
      warning: staleWarning,

      // Resume tracking fields
      resumed_from_job_id: job.resumed_from_job_id,
      resume_from_checkpoint: job.resume_from_checkpoint,
    };

    console.log('[LocalTraining Status] Sending response for job:', jobId);
    
    // Try to stringify to catch any serialization issues
    try {
      JSON.stringify(statusResponse);
    } catch (stringifyError) {
      console.error('[LocalTraining Status] JSON stringify error:', stringifyError);
      console.error('[LocalTraining Status] Problematic response object:', statusResponse);
      return NextResponse.json(
        { error: 'Failed to serialize response', details: stringifyError instanceof Error ? stringifyError.message : 'Unknown error' },
        { status: 500 }
      );
    }

    return NextResponse.json(statusResponse);

  } catch (error) {
    console.error('[LocalTraining Status] Error:', error);
    console.error('[LocalTraining Status] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('[LocalTraining Status] Job ID:', jobId);
    return NextResponse.json(
      {
        error: 'Failed to get training status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
