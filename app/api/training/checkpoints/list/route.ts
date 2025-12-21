/**
 * Checkpoint Listing API
 *
 * GET /api/training/checkpoints/list?jobId=xxx
 * Returns list of available checkpoints for a training job
 *
 * Phase: Checkpoint Selection Feature
 * Date: 2025-10-31
 * Updated: 2025-12-04 - Added database fallback when training server unavailable
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { CheckpointListResponse, TrainingCheckpoint } from '@/lib/training/checkpoint.types';

/**
 * Fallback to database when training server is unavailable
 * Creates a synthetic "best" checkpoint entry from job metrics
 */
async function getCheckpointsFromDatabase(jobId: string): Promise<CheckpointListResponse> {
  console.log('[CheckpointListAPI] Falling back to database for job:', jobId);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[CheckpointListAPI] Missing Supabase credentials for fallback');
    return {
      success: false,
      job_id: jobId,
      checkpoints: [],
      error: 'Training server unavailable and database credentials missing'
    };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get job info from database
  const { data: job, error } = await supabase
    .from('local_training_jobs')
    .select('id, model_name, status, best_eval_loss, best_checkpoint_step, best_checkpoint_epoch, best_checkpoint_path, metadata, completed_at')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    console.error('[CheckpointListAPI] Database query failed:', error);
    return {
      success: false,
      job_id: jobId,
      checkpoints: [],
      error: `Job ${jobId} not found in database`
    };
  }

  // For completed jobs without explicit checkpoint path, create a synthetic entry
  // This allows deployment to proceed using the model_url or job info
  const checkpoints: TrainingCheckpoint[] = [];

  if (job.status === 'completed') {
    // Get HuggingFace repo from metadata if available
    const hfRepo = job.metadata?.hf_repo;
    const checkpointPath = job.best_checkpoint_path || hfRepo || `merged_model`;

    // Create a synthetic "best" checkpoint entry
    const bestCheckpoint: TrainingCheckpoint = {
      path: checkpointPath,
      epoch: job.best_checkpoint_epoch || undefined,
      step: job.best_checkpoint_step || undefined,
      eval_loss: job.best_eval_loss || undefined,
      train_loss: undefined, // Not stored separately for best checkpoint
      is_best: true,
      is_latest: true,
      created_at: job.completed_at || undefined,
    };

    checkpoints.push(bestCheckpoint);
    console.log('[CheckpointListAPI] Created synthetic checkpoint from database:', bestCheckpoint.path);
  }

  return {
    success: true,
    job_id: jobId,
    checkpoints,
    best_checkpoint: checkpoints.length > 0 ? checkpoints[0].path : undefined,
    message: checkpoints.length > 0
      ? 'Checkpoint info retrieved from database (training server unavailable)'
      : 'No checkpoint information available'
  };
}

export async function GET(req: NextRequest) {
  console.log('[CheckpointListAPI] Request received');

  // Get jobId from query parameters
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing required parameter: jobId'
      } as CheckpointListResponse,
      { status: 400 }
    );
  }

  console.log('[CheckpointListAPI] Fetching checkpoints for job:', jobId);

  // Check if this is a cloud job (RunPod, Lambda, etc.)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let isCloudJob = false;

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: cloudDeployment } = await supabase
        .from('cloud_deployments')
        .select('platform')
        .eq('config->>job_id', jobId)
        .maybeSingle();

      if (cloudDeployment) {
        isCloudJob = true;
        console.log('[CheckpointListAPI] Job is a cloud deployment on', cloudDeployment.platform);
      }
    } catch (err) {
      console.log('[CheckpointListAPI] Could not check if cloud job:', err);
    }
  }

  // Try training server first (only for local jobs, or to get actual checkpoint files)
  const trainingServerUrl = process.env.TRAINING_SERVER_URL || 'http://localhost:8000';

  try {
    const response = await fetch(`${trainingServerUrl}/api/training/checkpoints/${jobId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Short timeout - if server isn't responding, fallback quickly
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[CheckpointListAPI] Received', data.checkpoints?.length || 0, 'checkpoints from training server');

      // If training server has actual checkpoints, use them
      if (data.checkpoints && data.checkpoints.length > 0) {
        const result: CheckpointListResponse = {
          success: true,
          job_id: data.job_id || jobId,
          checkpoints: data.checkpoints,
          best_checkpoint: data.best_checkpoint,
          message: data.message
        };
        return NextResponse.json(result);
      }

      // Training server returned empty checkpoints
      // For cloud jobs, fall back to database to create synthetic checkpoint
      if (!isCloudJob) {
        // For local jobs with no checkpoints, return empty
        const result: CheckpointListResponse = {
          success: true,
          job_id: data.job_id || jobId,
          checkpoints: [],
          best_checkpoint: data.best_checkpoint,
          message: data.message
        };
        return NextResponse.json(result);
      }

      // Cloud job with empty training server response - continue to database fallback
      console.log('[CheckpointListAPI] Training server returned empty checkpoints for cloud job - trying database fallback');
    } else {
      // Training server returned error - try database fallback
      console.log('[CheckpointListAPI] Training server returned', response.status, '- trying database fallback');
    }

  } catch (_error) {
    // Training server unreachable - this is expected when server isn't running
    console.log('[CheckpointListAPI] Training server unreachable - trying database fallback');
  }

  // Fallback to database
  try {
    const dbResult = await getCheckpointsFromDatabase(jobId);

    if (dbResult.success && dbResult.checkpoints.length > 0) {
      return NextResponse.json(dbResult);
    }

    // No checkpoints found anywhere
    return NextResponse.json(
      {
        success: false,
        job_id: jobId,
        checkpoints: [],
        error: dbResult.error || 'No checkpoints available. Training server may not be running.'
      } as CheckpointListResponse,
      { status: 200 } // Return 200 with empty checkpoints, not 500
    );

  } catch (dbError) {
    console.error('[CheckpointListAPI] Database fallback failed:', dbError);

    return NextResponse.json(
      {
        success: false,
        job_id: jobId,
        checkpoints: [],
        error: 'Unable to retrieve checkpoints. Training server unavailable.'
      } as CheckpointListResponse,
      { status: 200 } // Return 200 with empty checkpoints
    );
  }
}
