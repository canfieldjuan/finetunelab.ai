/**
 * @swagger
 * /api/training/local/{jobId}/status:
 *   get:
 *     summary: Get real-time training job status
 *     description: |
 *       Monitor a training job in real-time with comprehensive status and performance metrics.
 *
 *       This endpoint provides everything you need to build a live training dashboard:
 *       - **Progress tracking** - Current step, epoch, and percentage complete
 *       - **Loss metrics** - Training and validation loss with trend analysis
 *       - **Performance metrics** - Throughput, GPU usage, and estimated time remaining
 *       - **Quality indicators** - Perplexity calculations and improvement tracking
 *       - **Health monitoring** - Stale job detection and error reporting
 *
 *       **Use Cases:**
 *       - Build real-time training dashboards
 *       - Monitor long-running fine-tuning jobs
 *       - Track training progress programmatically
 *       - Detect training failures early
 *       - Display live metrics in your application
 *
 *       **Metrics Included:**
 *       - Progress: steps, epochs, percentage, time estimates
 *       - Loss: train_loss, eval_loss, best_eval_loss, trend analysis
 *       - GPU: memory usage (allocated/reserved), utilization %
 *       - Throughput: samples/second, tokens/second
 *       - Quality: perplexity, epochs without improvement
 *     tags:
 *       - Metrics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Training job ID
 *         example: "job_abc123"
 *     responses:
 *       200:
 *         description: Training status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 job_id:
 *                   type: string
 *                   example: "job_abc123"
 *                 status:
 *                   type: string
 *                   enum: [pending, running, completed, failed, cancelled]
 *                   example: "running"
 *                 model_name:
 *                   type: string
 *                   example: "meta-llama/Llama-2-7b-hf"
 *                 model_display_name:
 *                   type: string
 *                   example: "Llama 2 7B"
 *                 job_name:
 *                   type: string
 *                   example: "Customer Support Fine-tune"
 *                 dataset_name:
 *                   type: string
 *                   example: "support-conversations-v2"
 *                 current_step:
 *                   type: integer
 *                   example: 450
 *                 current_epoch:
 *                   type: integer
 *                   example: 2
 *                 total_steps:
 *                   type: integer
 *                   example: 1000
 *                 total_epochs:
 *                   type: integer
 *                   example: 3
 *                 progress:
 *                   type: integer
 *                   description: Percentage complete (0-100)
 *                   example: 45
 *                 loss:
 *                   type: number
 *                   description: Current training loss
 *                   example: 0.234
 *                 eval_loss:
 *                   type: number
 *                   description: Current validation loss
 *                   example: 0.198
 *                 best_eval_loss:
 *                   type: number
 *                   description: Best validation loss achieved
 *                   example: 0.187
 *                 loss_trend:
 *                   type: string
 *                   enum: [improving, stable, degrading]
 *                   example: "improving"
 *                 train_perplexity:
 *                   type: number
 *                   example: 1.26
 *                 eval_perplexity:
 *                   type: number
 *                   example: 1.22
 *                 learning_rate:
 *                   type: number
 *                   example: 0.00002
 *                 gpu_memory_allocated_gb:
 *                   type: number
 *                   example: 22.4
 *                 gpu_memory_reserved_gb:
 *                   type: number
 *                   example: 24.0
 *                 gpu_utilization_percent:
 *                   type: number
 *                   example: 98.5
 *                 samples_per_second:
 *                   type: number
 *                   example: 12.3
 *                 tokens_per_second:
 *                   type: number
 *                   example: 2450.0
 *                 elapsed_seconds:
 *                   type: integer
 *                   example: 3600
 *                 remaining_seconds:
 *                   type: integer
 *                   example: 4400
 *                 epochs_without_improvement:
 *                   type: integer
 *                   description: Epochs since last validation improvement
 *                   example: 0
 *                 warning:
 *                   type: string
 *                   description: Warning message for stale jobs
 *                   example: "⚠️ No updates received in 12 minute(s). The training process may have terminated unexpectedly."
 *                 error:
 *                   type: string
 *                   description: Error message if status is failed
 *                   example: "CUDA out of memory"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Training job not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { STATUS } from '@/lib/constants';
import { authenticateTraining } from '@/lib/auth/training-auth';

type TrainingJobConfigSnapshot = {
  metadata?: {
    job_name?: string;
    jobName?: string;
  };
  job_name?: string;
  jobName?: string;
  training?: {
    job_name?: string;
    package_name?: string;
    gpu_memory_gb?: number;
    gpuMemoryGb?: number;
  };
  name?: string;
  model?: {
    display_name?: string;
    displayName?: string;
    name?: string;
  };
  dataset?: {
    name?: string;
  };
  data?: {
    dataset_name?: string;
    datasetName?: string;
  };
  hardware?: {
    gpu?: {
      memory_gb?: number;
      memoryGb?: number;
    };
  };
  system?: {
    gpu?: {
      memory_gb?: number;
    };
  };
};

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
    // Authentication - supports both session tokens (UI) and API keys (SDK)
    const authResult = await authenticateTraining(request);
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const userId = authResult.userId;
    console.log('[LocalTraining Status] User authenticated:', userId, 'mode:', authResult.mode);

    // Use service role key for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get job details - filter by user_id for security
    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId) // Security: Only allow users to view their own jobs
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

    const configData: Record<string, unknown> =
      job.config && typeof job.config === 'object' ? (job.config as Record<string, unknown>) : {};

    const configSnapshot = configData as TrainingJobConfigSnapshot;

    const getDatasetNameFromPath = (path?: string | null): string | undefined => {
      if (!path) return undefined;
      const trimmed = path.trim();
      if (!trimmed) return undefined;
      const segments = trimmed.split(/[/\\]/);
      const lastSegment = segments.pop() || trimmed;
      return lastSegment.replace(/\.[^.]+$/, '') || lastSegment;
    };

    const resolvedJobName: string =
      configSnapshot.metadata?.job_name ||
      configSnapshot.metadata?.jobName ||
      configSnapshot.job_name ||
      configSnapshot.jobName ||
      configSnapshot.training?.job_name ||
      configSnapshot.training?.package_name ||
      configSnapshot.name ||
      job.model_name ||
      job.id;

    const resolvedModelDisplayName: string =
      configSnapshot.model?.display_name ||
      configSnapshot.model?.displayName ||
      configSnapshot.model?.name ||
      job.model_name;

    const resolvedDatasetName: string | undefined =
      configSnapshot.dataset?.name ||
      configSnapshot.data?.dataset_name ||
      configSnapshot.data?.datasetName ||
      getDatasetNameFromPath(job.dataset_path);

    const resolvedGpuTotalMemory: number | undefined =
      configSnapshot.hardware?.gpu?.memory_gb ||
      configSnapshot.hardware?.gpu?.memoryGb ||
      configSnapshot.system?.gpu?.memory_gb ||
      configSnapshot.training?.gpu_memory_gb ||
      configSnapshot.training?.gpuMemoryGb ||
      job.gpu_memory_reserved_gb ||
      job.gpu_memory_allocated_gb ||
      undefined;

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
      .limit(parseInt(process.env.TRAINING_METRICS_RECENT_LIMIT || '10', 10));

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
      if (progress > 0 && progress < 100 && job.status === STATUS.RUNNING) {
        const timePerPercent = elapsed_seconds / progress;
        remaining_seconds = Math.round(timePerPercent * (100 - progress));
      }
    }

    // Use epochs_without_improvement from the database (calculated by Python trainer)
    // The Python trainer correctly tracks this by incrementing the counter each time
    // eval_loss doesn't improve, and resetting to 0 when it does improve.
    // Note: This counts "evaluations without improvement", not necessarily full epochs,
    // since evaluations can happen multiple times per epoch depending on eval_strategy.
    const epochs_without_improvement = job.epochs_without_improvement || 0;

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
    if (job.status === STATUS.RUNNING || job.status === STATUS.PENDING) {
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
      model_display_name: resolvedModelDisplayName,
      job_name: resolvedJobName,
      dataset_name: resolvedDatasetName,
      dataset_path: job.dataset_path,
      gpu_total_memory_gb: resolvedGpuTotalMemory,

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
      best_checkpoint_path: job.best_checkpoint_path,
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
      error: job.status === STATUS.FAILED ? (job.config?.error || 'Training failed') : undefined,

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

/**
 * PATCH /api/training/local/{jobId}/status
 * Update job status from Python worker
 *
 * Request body:
 * {
 *   status: "running" | "completed" | "failed" | "cancelled" | "paused",
 *   error?: string
 * }
 *
 * Authentication: Bearer token (job_token)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[LocalTraining Status PATCH] Updating status for job:', jobId);

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    // Extract and validate job_token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[LocalTraining Status PATCH] Missing or invalid authorization header');
      return NextResponse.json(
        { error: 'Unauthorized: Bearer token required' },
        { status: 401 }
      );
    }

    const jobToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Parse request body
    const body = await request.json();
    const { status, error } = body;

    // Validate status
    const validStatuses = ['running', 'completed', 'failed', 'cancelled', 'paused'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify job exists and token matches
    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('id, job_token, status, completed_at')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('[LocalTraining Status PATCH] Job not found:', jobId);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.job_token !== jobToken) {
      console.error('[LocalTraining Status PATCH] Invalid job token');
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    // Prepare update
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Set completion timestamp for terminal statuses
    if (['completed', 'failed', 'cancelled'].includes(status) && !job.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }

    // Update error in config if provided
    if (error && status === 'failed') {
      // Get existing config or create new one
      const { data: currentJob } = await supabase
        .from('local_training_jobs')
        .select('config')
        .eq('id', jobId)
        .single();

      const existingConfig = currentJob?.config || {};
      updateData.config = {
        ...existingConfig,
        error
      };
    }

    // Update job status
    const { error: updateError } = await supabase
      .from('local_training_jobs')
      .update(updateData)
      .eq('id', jobId);

    if (updateError) {
      console.error('[LocalTraining Status PATCH] Failed to update status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update status', details: updateError.message },
        { status: 500 }
      );
    }

    console.log('[LocalTraining Status PATCH] Status updated successfully:', { jobId, status, hasError: !!error });

    return NextResponse.json({
      success: true,
      status,
      updated_at: updateData.updated_at
    });

  } catch (error) {
    console.error('[LocalTraining Status PATCH] Request error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
