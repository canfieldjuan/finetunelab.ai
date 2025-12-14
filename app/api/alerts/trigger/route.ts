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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[AlertTrigger] Error:', err);
    return NextResponse.json(
      { error: 'Failed to process alert trigger' },
      { status: 500 }
    );
  }
}
