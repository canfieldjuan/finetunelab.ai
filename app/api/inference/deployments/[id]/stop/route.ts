/**
 * Inference Deployment Stop API
 * Purpose: Stop/terminate a deployed inference endpoint
 * Endpoint: DELETE /api/inference/deployments/[id]/stop
 * Date: 2025-11-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runpodServerlessService } from '@/lib/inference/runpod-serverless-service';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import { decrypt } from '@/lib/models/encryption';
import type { StopInferenceDeploymentApiResponse } from '@/lib/inference/deployment.types';
import { STATUS } from '@/lib/constants';

export const runtime = 'nodejs';

/**
 * DELETE /api/inference/deployments/[id]/stop
 *
 * Stop a running inference deployment
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deploymentId } = await params;
  console.log('[InferenceStopAPI] Stop deployment request:', deploymentId);

  try {
    // ========================================================================
    // Step 1: Authenticate user
    // ========================================================================
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[InferenceStopAPI] No authorization header');
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authorization header required' } },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[InferenceStopAPI] Authentication failed:', authError);
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Please login' } },
        { status: 401 }
      );
    }

    console.log('[InferenceStopAPI] Authenticated user:', user.email);

    // ========================================================================
    // Step 2: Get deployment record from database
    // ========================================================================
    console.log('[InferenceStopAPI] Fetching deployment record...');

    const { data: deployment, error: dbError } = await supabase
      .from('inference_deployments')
      .select('*')
      .eq('id', deploymentId)
      .eq('user_id', user.id)
      .single();

    if (dbError || !deployment) {
      console.error('[InferenceStopAPI] Deployment not found:', dbError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Deployment not found',
            details: dbError?.message,
          },
        },
        { status: 404 }
      );
    }

    console.log('[InferenceStopAPI] Deployment found:', deployment.deployment_name);

    // Check if already stopped
    if (deployment.status === STATUS.STOPPED) {
      console.log('[InferenceStopAPI] Deployment already stopped');
      const response: StopInferenceDeploymentApiResponse = {
        success: true,
        deployment_id: deploymentId,
        status: STATUS.STOPPED,
      };
      return NextResponse.json(response);
    }

    // ========================================================================
    // Step 3: Get provider API key
    // ========================================================================
    console.log('[InferenceStopAPI] Retrieving provider API key...');

    let apiKey: string;

    if (deployment.provider === 'runpod-serverless') {
      const secret = await secretsManager.getSecret(user.id, 'runpod', supabase);

      if (!secret) {
        console.error('[InferenceStopAPI] No RunPod API key found');
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NO_CREDENTIALS',
              message: 'No RunPod API key found',
              details: 'Please add your RunPod API key in Settings > Secrets',
            },
          },
          { status: 401 }
        );
      }

      apiKey = decrypt(secret.api_key_encrypted);
    } else {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNSUPPORTED_PROVIDER',
            message: `Provider ${deployment.provider} not yet supported`,
          },
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // Step 4: Stop endpoint via provider
    // ========================================================================
    console.log('[InferenceStopAPI] Stopping endpoint via provider...');

    try {
      if (deployment.provider === 'runpod-serverless') {
        await runpodServerlessService.stopEndpoint(
          deployment.deployment_id,
          apiKey
        );
      }
    } catch (error) {
      console.error('[InferenceStopAPI] Failed to stop endpoint:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PROVIDER_ERROR',
            message: 'Failed to stop endpoint',
            details: error instanceof Error ? error.message : String(error),
          },
        },
        { status: 500 }
      );
    }

    console.log('[InferenceStopAPI] Endpoint stopped successfully');

    // ========================================================================
    // Step 5: Update database status
    // ========================================================================
    console.log('[InferenceStopAPI] Updating database status...');

    const { error: updateError } = await supabase
      .from('inference_deployments')
      .update({
        status: STATUS.STOPPED,
        stopped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', deploymentId);

    if (updateError) {
      console.error('[InferenceStopAPI] Failed to update database:', updateError);
      // Endpoint is stopped, so we'll return success with warning
      const response: StopInferenceDeploymentApiResponse = {
        success: true,
        deployment_id: deploymentId,
        status: STATUS.STOPPED,
        error: {
          code: 'DB_UPDATE_WARNING',
          message: 'Endpoint stopped but failed to update database',
          details: updateError.message,
        },
      };
      return NextResponse.json(response);
    }

    // ========================================================================
    // Step 6: Return success response
    // ========================================================================
    const response: StopInferenceDeploymentApiResponse = {
      success: true,
      deployment_id: deploymentId,
      status: STATUS.STOPPED,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[InferenceStopAPI] Stop deployment error:', error);

    const response: StopInferenceDeploymentApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to stop deployment',
        details: error instanceof Error ? error.message : String(error),
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}
