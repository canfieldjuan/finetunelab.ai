/**
 * Alert Trigger API
 * POST /api/alerts/trigger - Trigger alert for training job event
 * Called internally by training server
 * Date: 2025-12-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendTrainingJobAlert, AlertType, TrainingJobAlertData } from '@/lib/alerts';
import { createClient } from '@supabase/supabase-js';
import { runpodService } from '@/lib/training/runpod-service';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';

export const runtime = 'nodejs';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || process.env.ALERT_TRIGGER_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    const jobData: TrainingJobAlertData = {
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

    console.log('[AlertTrigger] Processing:', body.type, 'for job:', body.job_id);

    await sendTrainingJobAlert(body.type as AlertType, jobData);

    // Auto-terminate RunPod pods on completion or failure
    if ((body.type === 'job_completed' || body.type === 'job_failed') && supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: cloudDeployment } = await supabase
          .from('cloud_deployments')
          .select('deployment_id, platform')
          .eq('config->>job_id', body.job_id)
          .maybeSingle();

        if (cloudDeployment && cloudDeployment.platform === 'runpod') {
          console.log('[AlertTrigger] Auto-terminating RunPod pod:', cloudDeployment.deployment_id);

          const secret = await secretsManager.getSecret(body.user_id, 'runpod', supabase);
          if (secret?.value) {
            await runpodService.stopPod(cloudDeployment.deployment_id, secret.value);

            await supabase
              .from('cloud_deployments')
              .update({
                status: 'stopped',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('deployment_id', cloudDeployment.deployment_id);

            console.log('[AlertTrigger] RunPod pod terminated successfully');
          } else {
            console.warn('[AlertTrigger] RunPod API key not found, cannot terminate pod');
          }
        }
      } catch (error) {
        console.error('[AlertTrigger] Error auto-terminating RunPod pod:', error);
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
