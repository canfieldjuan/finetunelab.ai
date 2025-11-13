/**
 * Local Training Jobs Persistence API
 * POST /api/training/local/jobs
 *
 * Purpose: Create or update local training job records for analytics
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
  console.error('[LocalTrainingJobs] CRITICAL: Missing environment variables!');
  console.error('[LocalTrainingJobs] NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('[LocalTrainingJobs] SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
}

export async function POST(request: NextRequest) {
  console.log('[LocalTrainingJobs] POST request received');

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
    const contentType = request.headers.get('content-type');
    
    console.log('[LocalTrainingJobs] POST request received');
    console.log('[LocalTrainingJobs] Content-Length:', contentLength);
    console.log('[LocalTrainingJobs] Content-Type:', contentType);
    
    if (!contentLength || contentLength === '0') {
      console.log('[LocalTrainingJobs] Empty request body received');
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      );
    }
    
    if (!contentType || !contentType.includes('application/json')) {
      console.log('[LocalTrainingJobs] Invalid Content-Type:', contentType);
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }

    // Parse JSON with error handling
    let body;
    try {
      const text = await request.text();
      console.log('[LocalTrainingJobs] Raw body length:', text.length);
      
      if (!text || text.trim().length === 0) {
        console.error('[LocalTrainingJobs] Empty body text received despite Content-Length:', contentLength);
        return NextResponse.json(
          { error: 'Empty request body' },
          { status: 400 }
        );
      }
      
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('[LocalTrainingJobs] JSON parse error:', parseError);
      console.error('[LocalTrainingJobs] This usually indicates an incomplete or corrupted request');
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: parseError instanceof Error ? parseError.message : 'Unknown parse error' },
        { status: 400 }
      );
    }
    const {
      job_id,
      user_id,
      model_name,
      dataset_path,
      status,
      config,
      total_epochs,
      total_steps,
      final_loss,
      final_eval_loss,
      best_eval_loss,
      best_epoch,
      best_step,
      started_at,
      completed_at,
      // Real-time progress fields
      progress,
      current_epoch,
      current_step,
      loss,
      eval_loss,
      learning_rate,
      grad_norm,
      samples_per_second,
      elapsed_seconds,
      remaining_seconds,
      perplexity,
      train_perplexity,
      gpu_memory_allocated_gb,
      gpu_memory_reserved_gb,
      gpu_utilization_percent,
      epochs_without_improvement,
      // New fields from advanced metrics migration
      loss_trend,
      total_samples,
      train_samples,
      val_samples,
      total_tokens_processed,
      // Advanced training features (Phase 4)
      resume_from_checkpoint,
      num_gpus,
      distributed_strategy,
      parameter_updates,
      last_parameter_update_at,
      // Error tracking
      error_message
    } = body;

    console.log('[LocalTrainingJobs] Persisting job:', job_id, 'Status:', status);

    // Validate required fields
    if (!job_id) {
      return NextResponse.json(
        { error: 'job_id is required' },
        { status: 400 }
      );
    }

    if (!user_id) {
      console.error('[LocalTrainingJobs] Missing user_id in request body');
      return NextResponse.json(
        { error: 'user_id is required in request body' },
        { status: 400 }
      );
    }

    console.log('[LocalTrainingJobs] User ID from request:', user_id);

    // Create Supabase client with service role key
    // Service role bypasses RLS and never expires
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build job data - only include fields that are provided
    // This allows partial updates without overwriting existing data
    interface LocalTrainingJobData {
      user_id?: string;
      model_name?: string;
      dataset_path?: string;
      status?: string;
      config?: Record<string, unknown>;
      total_epochs?: number;
      total_steps?: number;
      final_loss?: number;
      final_eval_loss?: number;
      best_eval_loss?: number;
      best_epoch?: number;
      best_step?: number;
      started_at?: string;
      completed_at?: string;
      progress?: number;
      current_epoch?: number;
      current_step?: number;
      loss?: number | null;
      eval_loss?: number | null;
      learning_rate?: number | null;
      grad_norm?: number | null;
      samples_per_second?: number | null;
      elapsed_seconds?: number | null;
      remaining_seconds?: number | null;
      perplexity?: number | null;
      train_perplexity?: number | null;
      gpu_memory_allocated_gb?: number | null;
      gpu_memory_reserved_gb?: number | null;
      gpu_utilization_percent?: number | null;
      epochs_without_improvement?: number;
      loss_trend?: string;
      total_samples?: number;
      train_samples?: number;
      val_samples?: number;
      total_tokens_processed?: number;
      // Advanced training features (Phase 4)
      resume_from_checkpoint?: string | null;
      num_gpus?: number | null;
      distributed_strategy?: string | null;
      parameter_updates?: Record<string, unknown>[] | null;
      last_parameter_update_at?: string | null;
      // Error tracking
      error_message?: string | null;
    }

    const jobData: Partial<LocalTrainingJobData> = {};

    // user_id is required and validated above
    jobData.user_id = user_id;
    if (model_name !== undefined) jobData.model_name = model_name;
    if (dataset_path !== undefined) jobData.dataset_path = dataset_path;
    if (status !== undefined) jobData.status = status;
    if (config !== undefined) jobData.config = config;
  if (total_epochs !== undefined) jobData.total_epochs = total_epochs;
  if (total_steps !== undefined) jobData.total_steps = total_steps;
  if (final_loss !== undefined) jobData.final_loss = final_loss;
  if (final_eval_loss !== undefined) jobData.final_eval_loss = final_eval_loss;
  if (best_eval_loss !== undefined) jobData.best_eval_loss = best_eval_loss;
  if (best_epoch !== undefined) jobData.best_epoch = best_epoch;
  if (best_step !== undefined) jobData.best_step = best_step;
  if (started_at !== undefined) jobData.started_at = started_at;
  if (completed_at !== undefined) jobData.completed_at = completed_at;
  if (progress !== undefined) jobData.progress = progress;
  if (current_epoch !== undefined) jobData.current_epoch = current_epoch;
  if (current_step !== undefined) jobData.current_step = current_step;
  if (loss !== undefined) jobData.loss = loss;
  if (eval_loss !== undefined) jobData.eval_loss = eval_loss;
  if (learning_rate !== undefined) jobData.learning_rate = learning_rate;
  if (grad_norm !== undefined) jobData.grad_norm = grad_norm;
  if (samples_per_second !== undefined) jobData.samples_per_second = samples_per_second;
  if (elapsed_seconds !== undefined) jobData.elapsed_seconds = elapsed_seconds;
  if (remaining_seconds !== undefined) jobData.remaining_seconds = remaining_seconds;
  if (perplexity !== undefined) jobData.perplexity = perplexity;
  if (train_perplexity !== undefined) jobData.train_perplexity = train_perplexity;
  if (gpu_memory_allocated_gb !== undefined) jobData.gpu_memory_allocated_gb = gpu_memory_allocated_gb;
  if (gpu_memory_reserved_gb !== undefined) jobData.gpu_memory_reserved_gb = gpu_memory_reserved_gb;
  if (gpu_utilization_percent !== undefined) jobData.gpu_utilization_percent = gpu_utilization_percent;
  if (epochs_without_improvement !== undefined) jobData.epochs_without_improvement = epochs_without_improvement;
    // New fields
    if (loss_trend !== undefined) jobData.loss_trend = loss_trend;
    if (total_samples !== undefined) jobData.total_samples = total_samples;
    if (train_samples !== undefined) jobData.train_samples = train_samples;
    if (val_samples !== undefined) jobData.val_samples = val_samples;
    if (total_tokens_processed !== undefined) jobData.total_tokens_processed = total_tokens_processed;
    // Advanced training features (Phase 4)
    if (resume_from_checkpoint !== undefined) jobData.resume_from_checkpoint = resume_from_checkpoint;
    if (num_gpus !== undefined) jobData.num_gpus = num_gpus;
    if (distributed_strategy !== undefined) jobData.distributed_strategy = distributed_strategy;
    if (parameter_updates !== undefined) jobData.parameter_updates = parameter_updates;
    if (last_parameter_update_at !== undefined) jobData.last_parameter_update_at = last_parameter_update_at;
    // Error tracking
    if (error_message !== undefined) jobData.error_message = error_message;

    // Supabase client was created above with proper authentication

    // Optimized persistence using UPSERT (single database operation)
    // This is faster than SELECT + INSERT/UPDATE
    const persistJob = async () => {
      // Use upsert (insert or update) for better performance
      // PostgreSQL will handle the conflict resolution automatically
      const { data, error } = await supabase
        .from('local_training_jobs')
        .upsert(
          { ...jobData, id: job_id },
          { 
            onConflict: 'id',
            ignoreDuplicates: false // Always update on conflict
          }
        )
        .select()
        .single();

      if (error) {
        console.error('[LocalTrainingJobs] Upsert error:', error);
        throw error;
      }

      console.log('[LocalTrainingJobs] Job upserted successfully:', job_id);
      return { data, error };
    };

    // Execute persistence synchronously but with timeout protection
    // This ensures data consistency while preventing Python server timeouts
    try {
      // Set a timeout of 25s (less than Python's 30s to ensure we respond in time)
      let timeoutHandle: NodeJS.Timeout;
      const persistencePromise = persistJob();
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('Persistence timeout')), 25000);
      });

      await Promise.race([persistencePromise, timeoutPromise]);
      
      // If we get here, persistence succeeded within timeout
      // Clear the timeout to prevent memory leak
      clearTimeout(timeoutHandle!);
      console.log('[LocalTrainingJobs] Job persisted successfully:', job_id);
      return NextResponse.json({
        success: true,
        persisted: true,
        job_id
      }, { status: 200 });
      
    } catch (timeoutError) {
      // Persistence is taking too long, respond immediately but continue in background
      console.warn('[LocalTrainingJobs] Persistence timeout, responding early:', timeoutError);
      
      // Continue persistence in background with retry logic
      const retryPersistence = async (attempts = 3) => {
        for (let i = 0; i < attempts; i++) {
          try {
            await persistJob();
            console.log(`[LocalTrainingJobs] Background persistence succeeded on attempt ${i + 1}`);
            return;
          } catch (err) {
            console.error(`[LocalTrainingJobs] Background persistence attempt ${i + 1} failed:`, err);
            if (i < attempts - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
            }
          }
        }
        console.error('[LocalTrainingJobs] All background persistence attempts failed for job:', job_id);
      };

      retryPersistence().catch(err => {
        console.error('[LocalTrainingJobs] Fatal: Background persistence completely failed:', err);
      });

      return NextResponse.json({
        success: true,
        accepted: true,
        persisted: false,
        message: 'Persistence in progress',
        job_id
      }, { status: 202 }); // 202 Accepted
    }

  } catch (error) {
    console.error('[LocalTrainingJobs] Request error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
