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
      .select('id, job_token')
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

    const { error: updateError } = await supabase
      .from('local_training_jobs')
      .update({
        current_step: metrics.step,
        current_epoch: metrics.epoch,
        loss: metrics.loss,
        eval_loss: metrics.eval_loss,
        learning_rate: metrics.learning_rate,
        grad_norm: metrics.grad_norm,
        samples_per_second: metrics.samples_per_second,
        gpu_memory_allocated_gb: metrics.gpu_memory_allocated_gb,
        gpu_memory_reserved_gb: metrics.gpu_memory_reserved_gb,
        gpu_utilization_percent: metrics.gpu_utilization_percent,
        perplexity: metrics.perplexity,
        train_perplexity: metrics.train_perplexity,
        elapsed_seconds: metrics.elapsed_seconds,
        remaining_seconds: metrics.remaining_seconds,
        progress: metrics.progress,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('[Metrics API] Update failed:', updateError);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Metrics API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

