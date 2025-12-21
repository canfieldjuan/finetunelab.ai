import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runPodService } from '@/lib/training/runpod-service';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import { decrypt } from '@/lib/secrets/encryption';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const trainingServerUrl = process.env.NEXT_PUBLIC_TRAINING_SERVER_URL || 'http://localhost:8000';
const trainingServerApiKey = process.env.TRAINING_SERVER_API_KEY;

type ControlAction = 'cancel' | 'pause' | 'resume';

type ControlRequestBody = {
  action?: ControlAction;
  checkpoint_path?: string;
};

const ACTION_LABELS: Record<ControlAction, string> = {
  cancel: 'cancel',
  pause: 'pause',
  resume: 'resume',
};

function buildBackendUrl(action: ControlAction, jobId: string, checkpointPath?: string): string {
  const base = `${trainingServerUrl}/api/training`;

  if (action === 'cancel') {
    return `${base}/cancel/${jobId}`;
  }

  if (action === 'pause') {
    return `${base}/pause/${jobId}`;
  }

  const resumeUrl = `${base}/resume/${jobId}`;
  if (checkpointPath) {
    return `${resumeUrl}?checkpoint_path=${encodeURIComponent(checkpointPath)}`;
  }
  return resumeUrl;
}

async function verifyUser(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return { status: 401, body: { error: 'Unauthorized' } } as const;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: 401, body: { error: 'Unauthorized' } } as const;
  }

  return { status: 200, user, supabase } as const;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const controlParams = await params;
  const jobId = controlParams.jobId;

  if (!trainingServerUrl) {
    return NextResponse.json(
      { error: 'Training server URL is not configured' },
      { status: 500 }
    );
  }

  let body: ControlRequestBody = {};
  try {
    body = await request.json();
  } catch {
    // If no body was provided, body stays empty and validation below will fail gracefully.
  }

  const action = body.action;
  if (!action || !(action in ACTION_LABELS)) {
    return NextResponse.json(
      { error: 'Invalid or missing action. Expected cancel, pause, or resume.' },
      { status: 400 }
    );
  }

  const authResult = await verifyUser(request);
  if (authResult.status !== 200 || !('user' in authResult)) {
    return NextResponse.json(authResult.body, { status: authResult.status });
  }

  const { user, supabase } = authResult;

  // Ensure the job belongs to the authenticated user before forwarding the action.
  const { data: job, error: jobError } = await supabase
    .from('local_training_jobs')
    .select('id, user_id, status')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single();

  if (jobError || !job) {
    const statusCode = jobError?.code === 'PGRST116' ? 404 : 403;
    return NextResponse.json(
      { error: 'Training job not found or access denied' },
      { status: statusCode }
    );
  }

  // Check if this is a cloud deployment (RunPod, etc.)
  if (action === 'cancel') {
    const { data: cloudDeployment } = await supabase
      .from('cloud_deployments')
      .select('deployment_id, platform')
      .eq('config->>job_id', jobId)
      .maybeSingle();

    if (cloudDeployment && cloudDeployment.platform === 'runpod') {
      console.log('[TrainingControl] Cancelling RunPod pod:', cloudDeployment.deployment_id);

      try {
        const secret = await secretsManager.getSecret(user.id, 'runpod', supabase);
        if (!secret) {
          return NextResponse.json(
            { success: false, error: 'RunPod API key not configured' },
            { status: 400 }
          );
        }

        const runpodApiKey = decrypt(secret.api_key_encrypted);
        await runPodService.stopPod(cloudDeployment.deployment_id, runpodApiKey);

        await supabase
          .from('cloud_deployments')
          .update({
            status: 'stopped',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('deployment_id', cloudDeployment.deployment_id);

        await supabase
          .from('local_training_jobs')
          .update({
            status: 'cancelled',
            completed_at: new Date().toISOString()
          })
          .eq('id', jobId);

        console.log('[TrainingControl] RunPod pod terminated successfully');

        return NextResponse.json({
          success: true,
          action: 'cancel',
          job_id: jobId,
          message: 'RunPod pod terminated successfully'
        });
      } catch (error) {
        console.error('[TrainingControl] Error terminating RunPod pod:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to terminate RunPod pod' },
          { status: 500 }
        );
      }
    }
  }

  try {
    const backendUrl = buildBackendUrl(action, jobId, body.checkpoint_path);
    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        ...(trainingServerApiKey ? { Authorization: `Bearer ${trainingServerApiKey}` } : {}),
      },
    });

    type BackendResponseBody = {
      success?: boolean;
      message?: string;
      error?: string;
      [key: string]: unknown;
    } | null;

    let backendJson: BackendResponseBody = null;
    try {
      backendJson = await backendResponse.json();
    } catch {
      backendJson = null;
    }

    const backendSuccess = backendJson?.success ?? backendResponse.ok;

    if (!backendSuccess) {
      const status = backendResponse.status || 502;
      return NextResponse.json(
        {
          success: false,
          error:
            backendJson?.message ||
            backendJson?.error ||
            `Failed to ${ACTION_LABELS[action]} training job`,
          details: backendJson,
        },
        { status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        action,
        job_id: jobId,
        result: backendJson,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[TrainingControl] Error invoking backend:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Unable to ${ACTION_LABELS[action]} job. Training server unavailable.`,
      },
      { status: 502 }
    );
  }
}
