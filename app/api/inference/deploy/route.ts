/**
 * @swagger
 * /api/inference/deploy:
 *   post:
 *     summary: Deploy model to production inference endpoint
 *     description: |
 *       Deploy your trained models to serverless GPU inference endpoints.
 *
 *       This endpoint creates a production-ready, auto-scaling inference deployment on RunPod Serverless.
 *       Your model will be deployed with:
 *       - Auto-scaling GPU workers (scale to zero when idle)
 *       - Budget controls and spending limits
 *       - Production-grade load balancing
 *       - Per-request billing
 *
 *       **Use Cases:**
 *       - Deploy fine-tuned models to production
 *       - Serve custom LLMs at scale
 *       - A/B test different model versions
 *       - Control infrastructure costs with budget limits
 *
 *       **Workflow:**
 *       1. Train your model or upload model artifacts
 *       2. Store model weights in cloud storage (S3, GCS, etc.)
 *       3. Call this endpoint with model URL and config
 *       4. Use the returned endpoint_url for inference requests
 *
 *       **Note:** Requires RunPod API key configured in Settings > Secrets
 *     tags:
 *       - Inference
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - deployment_name
 *               - base_model
 *               - model_type
 *               - model_storage_url
 *               - budget_limit
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [runpod-serverless]
 *                 description: Infrastructure provider
 *                 example: "runpod-serverless"
 *               deployment_name:
 *                 type: string
 *                 description: Unique name for this deployment
 *                 example: "my-finetuned-llama-v1"
 *               base_model:
 *                 type: string
 *                 description: Base model architecture
 *                 example: "meta-llama/Llama-2-7b-hf"
 *               model_type:
 *                 type: string
 *                 enum: [base, finetuned, quantized]
 *                 description: Type of model deployment
 *                 example: "finetuned"
 *               model_storage_url:
 *                 type: string
 *                 format: uri
 *                 description: Cloud storage URL where model weights are stored (S3, GCS, etc.)
 *                 example: "s3://my-bucket/models/llama2-finetuned/"
 *               training_config_id:
 *                 type: string
 *                 description: Associated training configuration ID (optional)
 *                 example: "config_abc123"
 *               training_job_id:
 *                 type: string
 *                 description: Associated training job ID (optional)
 *                 example: "job_xyz789"
 *               model_artifact_id:
 *                 type: string
 *                 description: Model artifact ID from training (optional)
 *                 example: "artifact_def456"
 *               gpu_type:
 *                 type: string
 *                 enum: [NVIDIA_A100_80GB, NVIDIA_A40, NVIDIA_RTX_A6000, NVIDIA_RTX_A5000]
 *                 description: GPU type for inference workers (defaults to optimal for model size)
 *                 example: "NVIDIA_A100_80GB"
 *               min_workers:
 *                 type: integer
 *                 default: 0
 *                 description: Minimum number of workers (0 = scale to zero when idle)
 *                 example: 0
 *               max_workers:
 *                 type: integer
 *                 default: 3
 *                 description: Maximum number of workers for auto-scaling
 *                 example: 5
 *               budget_limit:
 *                 type: number
 *                 description: Monthly budget limit in USD
 *                 example: 100.00
 *               auto_stop_on_budget:
 *                 type: boolean
 *                 default: true
 *                 description: Automatically stop deployment when budget is reached
 *                 example: true
 *               environment_variables:
 *                 type: object
 *                 description: Custom environment variables for inference container
 *                 additionalProperties:
 *                   type: string
 *                 example:
 *                   MAX_BATCH_SIZE: "8"
 *                   TEMPERATURE: "0.7"
 *     responses:
 *       200:
 *         description: Deployment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 deployment_id:
 *                   type: string
 *                   description: Unique deployment identifier
 *                   example: "dep_abc123xyz"
 *                 endpoint_url:
 *                   type: string
 *                   format: uri
 *                   description: Production inference endpoint URL
 *                   example: "https://api.runpod.ai/v2/my-endpoint-abc123/runsync"
 *                 status:
 *                   type: string
 *                   enum: [INITIALIZING, RUNNING, STOPPED, FAILED]
 *                   description: Current deployment status
 *                   example: "INITIALIZING"
 *       400:
 *         description: Bad request - Missing required fields or invalid provider
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       enum: [VALIDATION_ERROR, UNSUPPORTED_PROVIDER]
 *                       example: "VALIDATION_ERROR"
 *                     message:
 *                       type: string
 *                       example: "Missing required field: budget_limit"
 *       401:
 *         description: Unauthorized - Missing or invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       enum: [UNAUTHORIZED, NO_CREDENTIALS]
 *                       example: "NO_CREDENTIALS"
 *                     message:
 *                       type: string
 *                       example: "No RunPod API key found"
 *                     details:
 *                       type: string
 *                       example: "Please add your RunPod API key in Settings > Secrets"
 *       500:
 *         description: Internal server error - Deployment failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       enum: [DEPLOYMENT_FAILED, INTERNAL_ERROR]
 *                       example: "DEPLOYMENT_FAILED"
 *                     message:
 *                       type: string
 *                       example: "Failed to create inference endpoint"
 *                     details:
 *                       type: string
 *                       example: "RunPod API error: Invalid GPU type"
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
      min_workers = parseInt(process.env.INFERENCE_DEFAULT_MIN_WORKERS || '0', 10),
      max_workers = parseInt(process.env.INFERENCE_DEFAULT_MAX_WORKERS || '3', 10),
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
