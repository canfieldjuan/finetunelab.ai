/**
 * Inference Deployment Status API
 * Purpose: Get status of a deployed inference endpoint
 * Endpoint: GET /api/inference/deployments/[id]/status
 * Date: 2025-11-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runpodServerlessService } from '@/lib/inference/runpod-serverless-service';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import { decrypt } from '@/lib/models/encryption';
import type {
  GetInferenceDeploymentStatusApiResponse,
  InferenceProvider,
} from '@/lib/inference/deployment.types';
import { STATUS } from '@/lib/constants';

export const runtime = 'nodejs';

/**
 * GET /api/inference/deployments/[id]/status
 *
 * Get deployment status and metrics
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deploymentId } = await params;
  console.log('[InferenceStatusAPI] Get deployment status:', deploymentId);

  try {
    // ========================================================================
    // Step 1: Authenticate user
    // ========================================================================
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[InferenceStatusAPI] No authorization header');
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authorization header required' } },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[InferenceStatusAPI] Authentication failed:', authError);
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Please login' } },
        { status: 401 }
      );
    }

    console.log('[InferenceStatusAPI] Authenticated user:', user.email);

    // ========================================================================
    // Step 2: Get deployment record from database
    // ========================================================================
    console.log('[InferenceStatusAPI] Fetching deployment record...');

    const { data: deployment, error: dbError } = await supabase
      .from('inference_deployments')
      .select('*')
      .eq('id', deploymentId)
      .eq('user_id', user.id)
      .single();

    if (dbError || !deployment) {
      console.error('[InferenceStatusAPI] Deployment not found:', dbError);
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

    console.log('[InferenceStatusAPI] Deployment found:', deployment.deployment_name);

    // ========================================================================
    // Step 3: Get provider API key
    // ========================================================================
    console.log('[InferenceStatusAPI] Retrieving provider API key...');

    let apiKey: string;

    if (deployment.provider === STATUS.RUNPOD_SERVERLESS) {
      const secret = await secretsManager.getSecret(user.id, 'runpod', supabase);

      if (!secret) {
        console.error('[InferenceStatusAPI] No RunPod API key found');
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
    // Step 4: Get status from provider
    // ========================================================================
    console.log('[InferenceStatusAPI] Fetching status from provider...');

    let providerStatus;

    try {
      if (deployment.provider === STATUS.RUNPOD_SERVERLESS) {
        providerStatus = await runpodServerlessService.getEndpointStatus(
          deployment.deployment_id,
          apiKey
        );
      }
    } catch (error) {
      console.error('[InferenceStatusAPI] Failed to get status from provider:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PROVIDER_ERROR',
            message: 'Failed to get status from provider',
            details: error instanceof Error ? error.message : String(error),
          },
        },
        { status: 500 }
      );
    }

    if (!providerStatus) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PROVIDER_ERROR',
            message: 'Provider returned no status',
          },
        },
        { status: 500 }
      );
    }

    console.log('[InferenceStatusAPI] Status retrieved:', providerStatus.status);

    // ========================================================================
    // Step 5: Update database with latest status
    // ========================================================================
    console.log('[InferenceStatusAPI] Updating database with latest status...');

    const { error: updateError } = await supabase
      .from('inference_deployments')
      .update({
        status: providerStatus.status,
        current_spend: providerStatus.cost.current_spend,
        request_count: providerStatus.cost.request_count,
        metrics: providerStatus.metrics || {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', deploymentId);

    if (updateError) {
      console.error('[InferenceStatusAPI] Failed to update database:', updateError);
      // Continue anyway, we have the status
    }

    // ========================================================================
    // Step 6: Return status response
    // ========================================================================
    const provider = deployment.provider as InferenceProvider;
    const response: GetInferenceDeploymentStatusApiResponse = {
      success: true,
      deployment: {
        ...providerStatus,
        provider,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[InferenceStatusAPI] Status check error:', error);

    const response: GetInferenceDeploymentStatusApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get deployment status',
        details: error instanceof Error ? error.message : String(error),
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}
