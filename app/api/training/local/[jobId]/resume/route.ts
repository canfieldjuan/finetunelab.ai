/**
 * Resume Training from Checkpoint API
 * POST /api/training/local/[jobId]/resume
 *
 * Purpose: Resume a failed or cancelled training job from a checkpoint
 * Phase 1: Advanced Training Features - Checkpoint Resume API
 * Date: 2025-11-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { LocalTrainingProvider } from '@/lib/services/training-providers/local.provider';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('[ResumeTraining] Module loaded');

/**
 * POST handler - Resume training from checkpoint
 * Accepts: { checkpoint_path?, resume_from_best?, config_adjustments? }
 * Returns: { success, job_id, resumed_from, checkpoint_path }
 *
 * Phase 4: Intelligent Resume - Added config_adjustments parameter
 * to allow merging config changes when resuming failed jobs
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  // Await params per Next.js 15 requirements
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[ResumeTraining] POST request received for job:', jobId);

  // Environment validation
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[ResumeTraining] CRITICAL: Missing Supabase environment variables');
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    // Authentication - verify user is logged in
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.log('[ResumeTraining] No authorization header provided');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[ResumeTraining] Authentication failed:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[ResumeTraining] User authenticated:', user.id);

    // Parse request body
    const body = await request.json();
    const { checkpoint_path, resume_from_best, config_adjustments } = body;

    console.log('[ResumeTraining] Request params:', {
      checkpoint_path,
      resume_from_best,
      config_adjustments,
    });

    // Get original job from database
    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id) // Ensure user owns this job
      .single();

    if (jobError) {
      console.error('[ResumeTraining] Job query error:', jobError);
      return NextResponse.json(
        { error: 'Training job not found', details: jobError.message },
        { status: 404 }
      );
    }

    if (!job) {
      console.log('[ResumeTraining] Job not found for user:', user.id);
      return NextResponse.json(
        { error: 'Training job not found' },
        { status: 404 }
      );
    }

    console.log('[ResumeTraining] Job found:', job.id, 'Status:', job.status);

    // Verify job is in resumable state
    if (!['failed', 'cancelled'].includes(job.status)) {
      console.log('[ResumeTraining] Job not in resumable state:', job.status);
      return NextResponse.json(
        {
          error: 'Can only resume failed or cancelled jobs',
          current_status: job.status,
          allowed_statuses: ['failed', 'cancelled']
        },
        { status: 400 }
      );
    }

    // Determine which checkpoint to use
    let resumeCheckpoint = checkpoint_path;

    // If resume_from_best is true and no specific checkpoint provided, fetch best checkpoint
    if (resume_from_best && !checkpoint_path) {
      console.log('[ResumeTraining] Fetching best checkpoint from backend');

      try {
        // Call FastAPI backend to get checkpoint list
        const backendUrl = process.env.NEXT_PUBLIC_TRAINING_BACKEND_URL || 'http://localhost:8000';
        const checkpointsRes = await fetch(
          `${backendUrl}/api/training/checkpoints/${jobId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (checkpointsRes.ok) {
          const checkpointsData = await checkpointsRes.json();
          resumeCheckpoint = checkpointsData.best_checkpoint;
          console.log('[ResumeTraining] Best checkpoint found:', resumeCheckpoint);
        } else {
          console.warn('[ResumeTraining] Failed to fetch checkpoints:', checkpointsRes.status);
        }
      } catch (fetchError) {
        console.error('[ResumeTraining] Error fetching checkpoints:', fetchError);
        // Continue without checkpoint - backend will handle
      }
    }

    // Validate we have a checkpoint to resume from
    if (!resumeCheckpoint) {
      console.log('[ResumeTraining] No checkpoint specified or found');
      return NextResponse.json(
        {
          error: 'No checkpoint specified and no best checkpoint found',
          suggestion: 'Provide checkpoint_path or set resume_from_best to true'
        },
        { status: 400 }
      );
    }

    console.log('[ResumeTraining] Resuming from checkpoint:', resumeCheckpoint);

    // Create resume configuration with proper structure (Phase 4: Intelligent Resume)
    // Ensure required sections exist for backend validation and trainer
    const baseConfig = job.config || {};
    const resumeConfig = {
      ...baseConfig,
      // Ensure model section exists (required by backend)
      model: baseConfig.model || {
        name: job.model_name || 'Qwen/Qwen3-1.7B',
      },
      // Ensure data section exists (required by trainer)
      data: baseConfig.data || {
        strategy: 'standard',
      },
      // Ensure training section exists (required by backend)
      training: baseConfig.training || {},
      // Add checkpoint resume configuration
      checkpoint_resume: {
        enabled: true,
        checkpoint_path: resumeCheckpoint,
        resume_from_best: resume_from_best || false,
      },
    };

    // Apply config adjustments with proper field mapping (Phase 4: Intelligent Resume)
    if (config_adjustments && Object.keys(config_adjustments).length > 0) {
      console.log('[ResumeTraining] Config adjustments received:', config_adjustments);

      // Map analyzer field names to stored field names in training config
      const fieldMapping: Record<string, string> = {
        'per_device_train_batch_size': 'batch_size',
        'per_device_eval_batch_size': 'eval_batch_size',
        'gradient_accumulation_steps': 'gradient_accumulation_steps',
        'learning_rate': 'learning_rate',
        'gradient_checkpointing': 'gradient_checkpointing',
      };

      // Ensure training section exists
      if (!resumeConfig.training) {
        resumeConfig.training = {};
      }

      // Apply each adjustment to the correct location
      Object.keys(config_adjustments).forEach(displayField => {
        const storedField = fieldMapping[displayField];
        if (storedField) {
          resumeConfig.training[storedField] = config_adjustments[displayField];
          console.log(`[ResumeTraining] Mapped ${displayField} -> training.${storedField} = ${config_adjustments[displayField]}`);
        } else {
          console.warn(`[ResumeTraining] Unknown field in config_adjustments: ${displayField}`);
        }
      });

      console.log('[ResumeTraining] Config adjustments applied to training section');
    }
    console.log('[ResumeTraining] Resume config created');

    // Submit new training job to backend
    const backendUrl = process.env.NEXT_PUBLIC_TRAINING_BACKEND_URL || 'http://localhost:8000';
    const provider = new LocalTrainingProvider({
      type: 'local',
      base_url: backendUrl,
    });

    // Generate new job ID for resumed job
    const newJobId = `${jobId}-resume-${Date.now()}`;

    const trainingRequest = {
      config: resumeConfig,
      dataset_path: job.dataset_path,
      execution_id: newJobId,
      name: `${job.model_name || 'model'} (Resumed from ${jobId})`,
      user_id: user.id,  // Required by backend TrainingRequest model
    };

    console.log('[ResumeTraining] Submitting resumed job:', newJobId);

    const result = await provider.executeTraining(trainingRequest);

    if (!result.success) {
      console.error('[ResumeTraining] Job submission failed:', result.error);
      return NextResponse.json(
        {
          error: 'Failed to submit resumed training job',
          details: result.error
        },
        { status: 500 }
      );
    }

    // Create database record for resumed job
    const { error: insertError } = await supabase
      .from('local_training_jobs')
      .insert({
        id: newJobId,
        user_id: user.id,
        model_name: job.model_name,
        dataset_path: job.dataset_path,
        status: 'pending',
        config: resumeConfig,
        total_epochs: job.total_epochs,
        resume_from_checkpoint: resumeCheckpoint,
        resumed_from_job_id: jobId,
        started_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[ResumeTraining] Failed to create database record:', insertError);
      // Job is already submitted to backend, so just warn
      console.warn('[ResumeTraining] Job running but database record not created');
    }

    console.log('[ResumeTraining] Resume successful:', newJobId);

    return NextResponse.json({
      success: true,
      job_id: newJobId,
      resumed_from: jobId,
      checkpoint_path: resumeCheckpoint,
      message: 'Training resumed successfully',
    }, { status: 200 });
  } catch (error) {
    console.error('[ResumeTraining] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process resume request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
