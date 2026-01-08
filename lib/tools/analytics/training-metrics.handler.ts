/**
 * Training Metrics Tool Handler
 *
 * Provides access to training job status, metrics, and history.
 * Operations:
 * - get_job_status: Current status, progress, epoch, step
 * - get_job_metrics: Loss curves, GPU usage, throughput
 * - list_jobs: All training jobs with filters
 * - get_job_details: Full config and hyperparameters
 */

import { createClient } from '@supabase/supabase-js';

// Use placeholder during build when env var isn't available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface TrainingMetricsArgs {
  operation: 'get_job_status' | 'get_job_metrics' | 'list_jobs' | 'get_job_details';
  jobId?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'all';
  limit?: number;
  offset?: number;
}

interface JobConfigMetadata {
  job_name?: string;
  jobName?: string;
}

interface JobConfig {
  metadata?: JobConfigMetadata;
  job_name?: string;
  jobName?: string;
  [key: string]: unknown;
}

export async function executeTrainingMetrics(
  args: Record<string, unknown>,
  userId: string,
  authHeader?: string,
  authClient?: unknown
): Promise<unknown> {
  console.log('[TrainingMetrics] Executing:', args.operation);

  const { operation, jobId, status, limit, offset } = args as unknown as TrainingMetricsArgs;

  try {
    switch (operation) {
      case 'get_job_status':
        return await getJobStatus(jobId!, userId, authHeader!);

      case 'get_job_metrics':
        return await getJobMetrics(jobId!, userId, authHeader!);

      case 'list_jobs':
        return await listJobs(userId, status, limit, offset, authHeader!);

      case 'get_job_details':
        return await getJobDetails(jobId!, userId, authHeader!);

      default:
        return { error: `Unknown operation: ${operation}` };
    }
  } catch (error) {
    console.error('[TrainingMetrics] Error:', error);
    return {
      error: error instanceof Error ? error.message : 'Training metrics operation failed'
    };
  }
}

/**
 * Get current training job status
 */
async function getJobStatus(jobId: string, userId: string, authHeader: string): Promise<unknown> {
  console.log('[TrainingMetrics] Getting status for job:', jobId);

  try {
    // Call the existing status API endpoint
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/training/local/${jobId}/status`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TrainingMetrics] Status API error:', response.status, errorText);
      return {
        error: `Failed to get job status: ${response.status}`,
        details: errorText.slice(0, 200),
      };
    }

    const data = await response.json();
    console.log('[TrainingMetrics] Status retrieved:', {
      job_id: data.job_id,
      status: data.status,
      progress: data.progress,
    });

    return {
      success: true,
      job: {
        job_id: data.job_id,
        status: data.status,
        model_name: data.model_name,
        model_display_name: data.model_display_name,
        job_name: data.job_name,
        dataset_name: data.dataset_name,

        // Progress
        current_step: data.current_step,
        current_epoch: data.current_epoch,
        total_steps: data.total_steps,
        total_epochs: data.total_epochs,
        progress: data.progress,

        // Loss metrics
        loss: data.loss,
        eval_loss: data.eval_loss,
        best_eval_loss: data.best_eval_loss,
        loss_trend: data.loss_trend,

        // Performance
        train_perplexity: data.train_perplexity,
        perplexity: data.perplexity,
        samples_per_second: data.samples_per_second,

        // GPU metrics
        gpu_memory_allocated_gb: data.gpu_memory_allocated_gb,
        gpu_memory_reserved_gb: data.gpu_memory_reserved_gb,
        gpu_utilization_percent: data.gpu_utilization_percent,

        // Timing
        elapsed_seconds: data.elapsed_seconds,
        remaining_seconds: data.remaining_seconds,
        estimated_completion: data.estimated_completion,

        // Timestamps
        started_at: data.started_at,
        created_at: data.created_at,

        // Error info if failed
        error_message: data.error_message,
      }
    };
  } catch (error) {
    console.error('[TrainingMetrics] getJobStatus error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get job status'
    };
  }
}

/**
 * Get detailed metrics for a training job
 */
async function getJobMetrics(jobId: string, userId: string, authHeader: string): Promise<unknown> {
  console.log('[TrainingMetrics] Getting metrics for job:', jobId);

  try {
    // Use Supabase to get full metrics from database
    if (!supabaseUrl || !supabaseServiceKey) {
      return { error: 'Server configuration error' };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: job, error } = await supabase
      .from('local_training_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (error || !job) {
      console.error('[TrainingMetrics] Job not found:', error);
      return { error: 'Job not found or access denied' };
    }

    return {
      success: true,
      metrics: {
        job_id: job.id,
        status: job.status,

        // Progress metrics
        current_step: job.current_step,
        current_epoch: job.current_epoch,
        total_steps: job.total_steps,
        total_epochs: job.total_epochs,
        progress: job.progress,

        // Loss metrics
        loss: job.loss,
        eval_loss: job.eval_loss,
        best_eval_loss: job.best_eval_loss,
        final_loss: job.final_loss,
        final_eval_loss: job.final_eval_loss,
        loss_trend: job.loss_trend,
        epochs_without_improvement: job.epochs_without_improvement,

        // Quality metrics
        perplexity: job.perplexity,
        train_perplexity: job.train_perplexity,

        // GPU metrics
        gpu_memory_allocated_gb: job.gpu_memory_allocated_gb,
        gpu_memory_reserved_gb: job.gpu_memory_reserved_gb,
        gpu_utilization_percent: job.gpu_utilization_percent,

        // Performance metrics
        samples_per_second: job.samples_per_second,
        learning_rate: job.learning_rate,
        grad_norm: job.grad_norm,

        // Timing
        elapsed_seconds: job.elapsed_seconds,
        remaining_seconds: job.remaining_seconds,

        // Data metrics
        total_samples: job.total_samples,
        train_samples: job.train_samples,
        val_samples: job.val_samples,
        total_tokens_processed: job.total_tokens_processed,

        // Best checkpoint info
        best_epoch: job.best_epoch,
        best_step: job.best_step,
        best_checkpoint_path: job.best_checkpoint_path,

        // Timestamps
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        updated_at: job.updated_at,
      }
    };
  } catch (error) {
    console.error('[TrainingMetrics] getJobMetrics error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get job metrics'
    };
  }
}

/**
 * List training jobs with filters
 */
async function listJobs(
  userId: string,
  status?: string,
  limit: number = 50,
  offset: number = 0,
  authHeader?: string
): Promise<unknown> {
  console.log('[TrainingMetrics] Listing jobs for user:', userId, { status, limit, offset });

  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return { error: 'Server configuration error' };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from('local_training_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply status filter if provided and not 'all'
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: jobs, error, count } = await query;

    if (error) {
      console.error('[TrainingMetrics] List jobs error:', error);
      return { error: 'Failed to list jobs: ' + error.message };
    }

    console.log('[TrainingMetrics] Found', jobs?.length || 0, 'jobs');

    return {
      success: true,
      jobs: jobs?.map(job => {
        // Extract job_name from config if available
        const config = job.config as JobConfig;
        const job_name = config?.metadata?.job_name ||
                        config?.metadata?.jobName ||
                        config?.job_name ||
                        config?.jobName ||
                        `Training ${job.model_name?.split('/').pop() || 'Job'}`;

        return {
          job_id: job.id,
          job_name,
          status: job.status,
          model_name: job.model_name,
          dataset_path: job.dataset_path,

          // Progress
          progress: job.progress,
          current_epoch: job.current_epoch,
          total_epochs: job.total_epochs,

          // Key metrics
          loss: job.loss,
          eval_loss: job.eval_loss,
          best_eval_loss: job.best_eval_loss,

          // Timestamps
          created_at: job.created_at,
          started_at: job.started_at,
          completed_at: job.completed_at,

          // Error if failed
          error_message: job.error_message,
        };
      }) || [],
      total_count: count || jobs?.length || 0,
      limit,
      offset,
    };
  } catch (error) {
    console.error('[TrainingMetrics] listJobs error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to list jobs'
    };
  }
}

/**
 * Get detailed job configuration and hyperparameters
 */
async function getJobDetails(jobId: string, userId: string, authHeader: string): Promise<unknown> {
  console.log('[TrainingMetrics] Getting details for job:', jobId);

  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return { error: 'Server configuration error' };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: job, error } = await supabase
      .from('local_training_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (error || !job) {
      console.error('[TrainingMetrics] Job not found:', error);
      return { error: 'Job not found or access denied' };
    }

    // Extract job_name from config if available
    const config = job.config as JobConfig;
    const job_name = config?.metadata?.job_name ||
                    config?.metadata?.jobName ||
                    config?.job_name ||
                    config?.jobName ||
                    `Training ${job.model_name?.split('/').pop() || 'Job'}`;

    return {
      success: true,
      job_details: {
        // Core info
        job_id: job.id,
        job_name,
        status: job.status,

        // Model info
        model_name: job.model_name,
        base_model: job.base_model,

        // Dataset info
        dataset_path: job.dataset_path,
        total_samples: job.total_samples,
        train_samples: job.train_samples,
        val_samples: job.val_samples,

        // Hyperparameters
        learning_rate: job.learning_rate,
        max_learning_rate: job.max_learning_rate,
        min_learning_rate: job.min_learning_rate,
        batch_size: job.batch_size,
        gradient_accumulation_steps: job.gradient_accumulation_steps,
        warmup_steps: job.warmup_steps,
        total_epochs: job.total_epochs,
        total_steps: job.total_steps,

        // Training configuration
        config: job.config,

        // Checkpoint info
        best_checkpoint_path: job.best_checkpoint_path,
        best_epoch: job.best_epoch,
        best_step: job.best_step,
        best_eval_loss: job.best_eval_loss,

        // Resume info
        resumed_from_job_id: job.resumed_from_job_id,
        resumed_from_checkpoint: job.resumed_from_checkpoint,

        // Timestamps
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        updated_at: job.updated_at,

        // Results
        final_loss: job.final_loss,
        final_eval_loss: job.final_eval_loss,

        // Error info
        error_message: job.error_message,
      }
    };
  } catch (error) {
    console.error('[TrainingMetrics] getJobDetails error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get job details'
    };
  }
}
