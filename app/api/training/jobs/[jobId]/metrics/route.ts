/**
 * Training Job Metrics API
 * POST /api/training/jobs/[jobId]/metrics
 * Purpose: Receive metrics updates from training scripts (local or cloud)
 * Auth: Job-specific token (no user auth required)
 * Date: 2025-11-14
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function safePerplexity(loss: unknown): number | null {
  if (typeof loss !== 'number' || !Number.isFinite(loss)) return null;
  if (loss >= 100) return null;
  return Math.exp(loss);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const jobToken = authHeader.substring(7);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('id, job_token, status')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.job_token !== jobToken) {
      return NextResponse.json(
        { error: 'Invalid job token' },
        { status: 401 }
      );
    }

    const metrics = await request.json();
    if (typeof metrics?.step !== 'number') {
      return NextResponse.json(
        { error: 'Invalid metrics payload: step is required' },
        { status: 400 }
      );
    }

    const currentEpochRaw = metrics?.epoch;
    const currentEpoch = typeof currentEpochRaw === 'number' ? Math.trunc(currentEpochRaw) : 0;

    const trainLoss = (typeof metrics?.loss === 'number' ? metrics.loss : null) ??
      (typeof metrics?.train_loss === 'number' ? metrics.train_loss : null);
    const evalLoss = typeof metrics?.eval_loss === 'number' ? metrics.eval_loss : null;

    const trainPerplexity = (typeof metrics?.train_perplexity === 'number' ? metrics.train_perplexity : null) ?? safePerplexity(trainLoss);
    const perplexity = (typeof metrics?.perplexity === 'number' ? metrics.perplexity : null) ?? safePerplexity(evalLoss);

    const nowIso = new Date().toISOString();

    const jobUpdate: Record<string, unknown> = {
      current_step: metrics.step,
      current_epoch: currentEpoch,
      loss: trainLoss,
      eval_loss: evalLoss,
      learning_rate: typeof metrics?.learning_rate === 'number' ? metrics.learning_rate : null,
      grad_norm: typeof metrics?.grad_norm === 'number' ? metrics.grad_norm : null,
      samples_per_second: typeof metrics?.samples_per_second === 'number' ? metrics.samples_per_second : null,
      gpu_memory_allocated_gb: typeof metrics?.gpu_memory_allocated_gb === 'number' ? metrics.gpu_memory_allocated_gb : null,
      gpu_memory_reserved_gb: typeof metrics?.gpu_memory_reserved_gb === 'number' ? metrics.gpu_memory_reserved_gb : null,
      gpu_utilization_percent: typeof metrics?.gpu_utilization_percent === 'number' ? metrics.gpu_utilization_percent : null,
      perplexity,
      train_perplexity: trainPerplexity,
      elapsed_seconds: typeof metrics?.elapsed_seconds === 'number' ? metrics.elapsed_seconds : null,
      remaining_seconds: typeof metrics?.remaining_seconds === 'number' ? metrics.remaining_seconds : null,
      progress: typeof metrics?.progress === 'number' ? metrics.progress : null,
      updated_at: nowIso,
    };

    if (job.status === 'pending' || job.status === 'queued') {
      jobUpdate.status = 'running';
    }

    const { error: updateError } = await supabase
      .from('local_training_jobs')
      .update(jobUpdate)
      .eq('id', jobId);

    if (updateError) {
      console.error('[Metrics API] Update failed:', updateError);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    // Insert a time-series metric point for charts.
    try {
      const { error: insertError } = await supabase
        .from('local_training_metrics')
        .insert({
          job_id: jobId,
          step: metrics.step,
          epoch: currentEpoch,
          train_loss: trainLoss,
          eval_loss: evalLoss,
          learning_rate: typeof metrics?.learning_rate === 'number' ? metrics.learning_rate : null,
          grad_norm: typeof metrics?.grad_norm === 'number' ? metrics.grad_norm : null,
          samples_per_second: typeof metrics?.samples_per_second === 'number' ? metrics.samples_per_second : null,
          tokens_per_second: typeof metrics?.tokens_per_second === 'number' ? metrics.tokens_per_second : null,
          gpu_memory_allocated_gb: typeof metrics?.gpu_memory_allocated_gb === 'number' ? metrics.gpu_memory_allocated_gb : null,
          gpu_memory_reserved_gb: typeof metrics?.gpu_memory_reserved_gb === 'number' ? metrics.gpu_memory_reserved_gb : null,
          gpu_utilization_percent: typeof metrics?.gpu_utilization_percent === 'number' ? metrics.gpu_utilization_percent : null,
          perplexity,
          train_perplexity: trainPerplexity,
          timestamp: nowIso,
        });

      if (insertError) {
        console.warn('[Metrics API] Metrics insert failed:', insertError);
      }
    } catch (insertCatch) {
      console.warn('[Metrics API] Metrics insert threw:', insertCatch);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Metrics API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

