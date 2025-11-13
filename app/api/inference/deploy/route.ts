/**
 * Inference Deployment API
 * Purpose: Deploy trained models to RunPod Serverless inference endpoints
 * Endpoint: POST /api/inference/deploy
 * Date: 2025-11-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runpodServerlessService } from '@/lib/inference/runpod-serverless-service';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import { decrypt } from '@/lib/models/encryption';
import type {
  CreateInferenceDeploymentApiRequest,
  CreateInferenceDeploymentApiResponse,
  RunPodServerlessDeploymentRequest,
  RunPodServerlessGPU,
} from '@/lib/inference/deployment.types';

export const runtime = 'nodejs';

/**
 * POST /api/inference/deploy
 *
 * Create a new inference deployment to RunPod Serverless
 */
export async function POST(req: NextRequest) {
  console.log('[InferenceDeployAPI] Received deployment request');

  try {
    // ========================================================================
    // Step 1: Authenticate user
    // ========================================================================
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[InferenceDeployAPI] No authorization header');
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
      console.error('[InferenceDeployAPI] Authentication failed:', authError);
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Please login' } },
        { status: 401 }
      );
    }

    console.log('[InferenceDeployAPI] Authenticated user:', user.email);

    // ========================================================================
    // Step 2: Parse and validate request
    // ========================================================================
    const body: CreateInferenceDeploymentApiRequest = await req.json();
    const {
      provider,
      deployment_name,
      base_model,
      model_type,
      model_storage_url,
      training_config_id,
      training_job_id,
      model_artifact_id,
      gpu_type,
      min_workers = 0,
      max_workers = 3,
      budget_limit,
      auto_stop_on_budget = true,
      environment_variables,
    } = body;

    // Validate required fields
    if (!provider) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: provider' } },
        { status: 400 }
      );
    }

    if (!deployment_name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: deployment_name' } },
        { status: 400 }
      );
    }

    if (!base_model) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: base_model' } },
        { status: 400 }
      );
    }

    if (!model_type) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: model_type' } },
        { status: 400 }
      );
    }

    if (!budget_limit) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: budget_limit' } },
        { status: 400 }
      );
    }

    if (!model_storage_url) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: model_storage_url' } },
        { status: 400 }
      );
    }

    // Validate provider
    if (provider !== 'runpod-serverless') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNSUPPORTED_PROVIDER',
            message: `Provider ${provider} not yet supported. Currently only 'runpod-serverless' is available.`,
          },
        },
        { status: 400 }
      );
    }

    console.log('[InferenceDeployAPI] Provider:', provider);
    console.log('[InferenceDeployAPI] Deployment name:', deployment_name);
    console.log('[InferenceDeployAPI] Base model:', base_model);
    console.log('[InferenceDeployAPI] Model type:', model_type);
    console.log('[InferenceDeployAPI] Budget limit:', budget_limit);

    // ========================================================================
    // Step 3: Get RunPod API key from secrets vault
    // ========================================================================
    console.log('[InferenceDeployAPI] Retrieving RunPod API key...');

    const secret = await secretsManager.getSecret(user.id, 'runpod', supabase);

    if (!secret) {
      console.error('[InferenceDeployAPI] No RunPod API key found');
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

    const runpodApiKey = decrypt(secret.api_key_encrypted);
    console.log('[InferenceDeployAPI] RunPod API key retrieved');

    // ========================================================================
    // Step 4: Create serverless endpoint via RunPod
    // ========================================================================
    console.log('[InferenceDeployAPI] Creating RunPod Serverless endpoint...');

    const deploymentRequest: RunPodServerlessDeploymentRequest = {
      deployment_name,
      model_storage_url,
      base_model,
      model_type,
      budget_limit,
      auto_stop_on_budget,
      gpu_type: gpu_type as RunPodServerlessGPU | undefined,
      min_workers,
      max_workers,
      environment_variables,
      training_config_id,
      training_job_id,
      model_artifact_id,
    };

    let deploymentResponse;

    try {
      deploymentResponse = await runpodServerlessService.createEndpoint(
        deploymentRequest,
        runpodApiKey
      );
    } catch (error) {
      console.error('[InferenceDeployAPI] Endpoint creation failed:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEPLOYMENT_FAILED',
            message: 'Failed to create inference endpoint',
            details: error instanceof Error ? error.message : String(error),
          },
        },
        { status: 500 }
      );
    }

    console.log('[InferenceDeployAPI] Endpoint created:', deploymentResponse.endpoint_id);

    // ========================================================================
    // Step 5: Store deployment record in database
    // ========================================================================
    console.log('[InferenceDeployAPI] Storing deployment record...');

    const { data: deploymentRecord, error: insertError } = await supabase
      .from('inference_deployments')
      .insert({
        user_id: user.id,
        training_config_id: training_config_id || null,
        training_job_id: training_job_id || null,
        model_artifact_id: model_artifact_id || null,
        provider,
        deployment_name,
        deployment_id: deploymentResponse.endpoint_id,
        endpoint_url: deploymentResponse.endpoint_url,
        status: deploymentResponse.status,
        config: {
          gpu_type: deploymentResponse.gpu_type,
          min_workers,
          max_workers,
          auto_stop_on_budget,
          environment_variables,
        },
        model_type: model_type,
        base_model: base_model,
        model_storage_url: model_storage_url,
        cost_per_request: deploymentResponse.cost.cost_per_request,
        budget_limit: deploymentResponse.cost.budget_limit,
        current_spend: deploymentResponse.cost.current_spend,
        request_count: deploymentResponse.cost.request_count,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[InferenceDeployAPI] Failed to store deployment record:', insertError);
      // Endpoint is already created, so we'll return success with warning
      const response: CreateInferenceDeploymentApiResponse = {
        success: true,
        deployment_id: deploymentResponse.deployment_id,
        endpoint_url: deploymentResponse.endpoint_url,
        status: deploymentResponse.status,
        error: {
          code: 'DB_INSERT_WARNING',
          message: 'Deployment created but failed to store record in database',
          details: insertError.message,
        },
      };
      return NextResponse.json(response);
    }

    console.log('[InferenceDeployAPI] Deployment record stored:', deploymentRecord.id);

    // ========================================================================
    // Step 6: Return success response
    // ========================================================================
    const response: CreateInferenceDeploymentApiResponse = {
      success: true,
      deployment_id: deploymentResponse.deployment_id,
      endpoint_url: deploymentResponse.endpoint_url,
      status: deploymentResponse.status,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[InferenceDeployAPI] Deployment error:', error);

    const response: CreateInferenceDeploymentApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Deployment failed',
        details: error instanceof Error ? error.message : String(error),
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}
