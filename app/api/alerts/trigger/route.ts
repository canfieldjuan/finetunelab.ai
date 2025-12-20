/**
 * Alert Trigger API
 * POST /api/alerts/trigger - Trigger alert for training job event
 * Called internally by training server
 * Date: 2025-12-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendTrainingJobAlert, AlertType, TrainingJobAlertData } from '@/lib/alerts';

export const runtime = 'nodejs';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || process.env.ALERT_TRIGGER_API_KEY;

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');

  if (!INTERNAL_API_KEY) {
    console.warn('[AlertTrigger] INTERNAL_API_KEY not configured, allowing request');
  } else if (apiKey !== INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const validTypes: AlertType[] = [
      'job_started',
      'job_completed',
      'job_failed',
      'job_cancelled',
      'gpu_oom',
      'disk_warning',
      'timeout_warning',
    ];

    if (!body.type || !validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid alert type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (!body.job_id || !body.user_id) {
      return NextResponse.json(
        { error: 'job_id and user_id are required' },
        { status: 400 }
      );
    }

    // Fetch additional job details from database to enhance email
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let enhancedJobData: TrainingJobAlertData = {
      jobId: body.job_id,
      userId: body.user_id,
      modelName: body.model_name || null,
      baseModel: body.base_model || null,
      status: body.status || body.type.replace('job_', ''),
      progress: body.progress ?? null,
      currentStep: body.current_step ?? null,
      totalSteps: body.total_steps ?? null,
      loss: body.loss ?? null,
      duration: body.duration ?? null,
      errorMessage: body.error_message || null,
      errorType: body.error_type || null,
    };

    // Enhance with database details for completed/failed jobs
    if (supabaseUrl && supabaseServiceKey && (body.type === 'job_completed' || body.type === 'job_failed')) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch job with config and dataset details
        const { data: job } = await supabase
          .from('local_training_jobs')
          .select(`
            *,
            training_config:training_configs(
              config_json,
              datasets:training_config_datasets(
                dataset:training_datasets(name, total_examples)
              )
            )
          `)
          .eq('id', body.job_id)
          .single();

        if (job) {
          const config = job.config;
          const dataset = job.training_config?.datasets?.[0]?.dataset;

          // Extract training configuration details
          if (config) {
            enhancedJobData.trainingMethod = config.training?.method || null;
            enhancedJobData.learningRate = config.training?.learning_rate || null;
            enhancedJobData.batchSize = config.training?.batch_size || null;
            enhancedJobData.numEpochs = config.training?.num_epochs || null;
            enhancedJobData.baseModel = enhancedJobData.baseModel || config.model?.name || null;
          }

          // Extract dataset information
          if (dataset) {
            enhancedJobData.datasetName = dataset.name || null;
            enhancedJobData.datasetSamples = dataset.total_examples || null;
          }

          // Fetch latest metrics for completed jobs
          if (body.type === 'job_completed') {
            const { data: metrics } = await supabase
              .from('local_training_metrics')
              .select('eval_loss, perplexity, gpu_memory_allocated_gb')
              .eq('job_id', body.job_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (metrics) {
              enhancedJobData.evalLoss = metrics.eval_loss ?? null;
              enhancedJobData.perplexity = metrics.perplexity ?? null;
              enhancedJobData.gpuMemoryUsed = metrics.gpu_memory_allocated_gb ?? null;
            }
          }

          console.log('[AlertTrigger] Enhanced job data with database details');
        }
      } catch (enhanceError) {
        console.warn('[AlertTrigger] Failed to enhance job data:', enhanceError);
        // Continue with basic data - don't fail the alert
      }
    }

    console.log('[AlertTrigger] Processing:', body.type, 'for job:', body.job_id);

    await sendTrainingJobAlert(body.type as AlertType, enhancedJobData);

    // Update job status in database for completed/failed jobs (reuse Supabase client from above)
    if (supabaseUrl && supabaseServiceKey && (body.type === 'job_completed' || body.type === 'job_failed')) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (body.type === 'job_completed') {
          updates.status = 'completed';
          updates.completed_at = new Date().toISOString();
          console.log('[AlertTrigger] Updating job status to completed');
        } else if (body.type === 'job_failed') {
          updates.status = 'failed';
          updates.error = body.error_message || 'Training failed';
          updates.failed_at = new Date().toISOString();
          console.log('[AlertTrigger] Updating job status to failed');
        }

        const { error: updateError } = await supabase
          .from('local_training_jobs')
          .update(updates)
          .eq('id', body.job_id);

        if (updateError) {
          console.error('[AlertTrigger] Failed to update job status:', updateError);
          // Don't fail the alert - notification already sent
        } else {
          console.log('[AlertTrigger] Job status updated successfully');
        }
      } catch (updateErr) {
        console.error('[AlertTrigger] Error updating job status:', updateErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[AlertTrigger] Error:', err);
    return NextResponse.json(
      { error: 'Failed to process alert trigger' },
      { status: 500 }
    );
  }
}
