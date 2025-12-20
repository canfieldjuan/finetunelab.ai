/**
 * @swagger
 * /api/training/deploy/runpod:
 *   post:
 *     summary: Deploy training job to RunPod
 *     description: |
 *       Start a fine-tuning training job on RunPod's GPU infrastructure.
 *
 *       This endpoint provisions a GPU pod, sets up the training environment,
 *       and begins model fine-tuning with your specified configuration and dataset.
 *
 *       **Features:**
 *       - Auto-provisioned GPU pods (A100, A6000, RTX 4090, etc.)
 *       - Automatic environment setup
 *       - Real-time metrics reporting
 *       - Budget controls and cost monitoring
 *       - Auto-shutdown on completion
 *
 *       **Use Cases:**
 *       - Start fine-tuning jobs programmatically
 *       - Scale training across multiple GPUs
 *       - Train models without local GPU hardware
 *
 *       **Workflow:**
 *       1. Create training configuration
 *       2. Upload dataset
 *       3. Deploy to RunPod
 *       4. Monitor via status endpoint
 *       5. Retrieve trained model artifacts
 *
 *       **Note:** Requires RunPod API key configured in Settings > Secrets
 *     tags:
 *       - Training
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - training_config_id
 *             properties:
 *               training_config_id:
 *                 type: string
 *                 description: Training configuration ID
 *                 example: "cfg_abc123"
 *               gpu_type:
 *                 type: string
 *                 enum: [NVIDIA_A100_80GB, NVIDIA_A100_40GB, NVIDIA_A6000, NVIDIA_RTX_A5000, NVIDIA_RTX_4090]
 *                 description: GPU type to use
 *                 example: "NVIDIA_A100_80GB"
 *               gpu_count:
 *                 type: integer
 *                 default: 1
 *                 description: Number of GPUs
 *                 example: 1
 *               docker_image:
 *                 type: string
 *                 description: Custom Docker image (optional)
 *                 example: "runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel"
 *               volume_size_gb:
 *                 type: integer
 *                 default: 50
 *                 description: Persistent volume size in GB
 *                 example: 100
 *               budget_limit:
 *                 type: number
 *                 description: Maximum budget in USD
 *                 example: 50.00
 *               environment_variables:
 *                 type: object
 *                 description: Custom environment variables
 *                 additionalProperties:
 *                   type: string
 *                 example:
 *                   WANDB_API_KEY: "your-wandb-key"
 *                   HF_TOKEN: "your-hf-token"
 *     responses:
 *       200:
 *         description: Training job deployed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deployment_id:
 *                   type: string
 *                   example: "pod_abc123"
 *                 pod_id:
 *                   type: string
 *                   example: "pod_abc123"
 *                 pod_url:
 *                   type: string
 *                   format: uri
 *                   example: "https://pod-abc123.runpod.io"
 *                 status:
 *                   type: string
 *                   enum: [CREATED, RUNNING, EXITED, FAILED]
 *                   example: "RUNNING"
 *                 gpu_type:
 *                   type: string
 *                   example: "NVIDIA_A100_80GB"
 *                 gpu_count:
 *                   type: integer
 *                   example: 1
 *                 cost:
 *                   type: object
 *                   properties:
 *                     estimated_cost:
 *                       type: number
 *                       example: 25.50
 *                     cost_per_hour:
 *                       type: number
 *                       example: 1.89
 *                 message:
 *                   type: string
 *                   example: "RunPod deployment created successfully"
 *       400:
 *         description: Missing required fields or RunPod API key not configured
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "RunPod API key not configured"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Training configuration not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   get:
 *     summary: Get RunPod deployment status
 *     description: |
 *       Check the status of a running or completed RunPod training deployment.
 *
 *       Returns real-time information about:
 *       - Pod status (running, stopped, failed)
 *       - Training metrics
 *       - Cost information
 *       - Resource usage
 *     tags:
 *       - Training
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: deployment_id
 *         required: true
 *         schema:
 *           type: string
 *         description: RunPod deployment/pod ID
 *         example: "pod_abc123"
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deployment_id:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [CREATED, RUNNING, EXITED, FAILED]
 *                 pod_url:
 *                   type: string
 *                 cost:
 *                   type: object
 *                   properties:
 *                     actual_cost:
 *                       type: number
 *                       example: 12.45
 *                 metrics:
 *                   type: object
 *                   description: Training metrics (if available)
 *       400:
 *         description: Missing deployment_id parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Stop RunPod deployment
 *     description: |
 *       Stop a running RunPod training deployment.
 *
 *       This will:
 *       - Stop the training process
 *       - Terminate the GPU pod
 *       - Save final model checkpoints (if configured)
 *       - Update cost tracking
 *     tags:
 *       - Training
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: deployment_id
 *         required: true
 *         schema:
 *           type: string
 *         description: RunPod deployment/pod ID
 *         example: "pod_abc123"
 *     responses:
 *       200:
 *         description: Deployment stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deployment_id:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: "stopped"
 *                 message:
 *                   type: string
 *                   example: "RunPod deployment stopped successfully"
 *       400:
 *         description: Missing deployment_id parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runPodService } from '@/lib/training/runpod-service';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import { decrypt } from '@/lib/models/encryption';
import type { RunPodDeploymentRequest } from '@/lib/training/deployment.types';
import crypto from 'crypto';

export const runtime = 'nodejs';

// ============================================================================
// POST - Deploy to RunPod
// ============================================================================

export async function POST(request: NextRequest) {
  let jobId: string | undefined;
  let supabase: any;

  try {
    console.log('[RunPod API] Received deployment request');

    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[RunPod API] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: RunPodDeploymentRequest = await request.json();
    const {
      training_config_id,
      gpu_type,
      gpu_count,
      docker_image,
      volume_size_gb,
      environment_variables,
      budget_limit,
    } = body;

    console.log('[RunPod API] Request:', {
      training_config_id,
      gpu_type,
      gpu_count,
      user_id: user.id,
    });

    // Validate required fields
    if (!training_config_id) {
      return NextResponse.json(
        { error: 'Missing required field: training_config_id' },
        { status: 400 }
      );
    }

    // Retrieve RunPod API key from secrets vault
    const secret = await secretsManager.getSecret(user.id, 'runpod', supabase);
    
    if (!secret) {
      console.error('[RunPod API] No RunPod credentials found');
      return NextResponse.json(
        { error: 'RunPod API key not configured. Please add your RunPod credentials in the Secrets Vault.' },
        { status: 400 }
      );
    }

    // Decrypt API key
    let runpodApiKey: string;
    try {
      runpodApiKey = decrypt(secret.api_key_encrypted);
    } catch (error) {
      console.error('[RunPod API] Failed to decrypt API key:', error);
      return NextResponse.json(
        { error: 'Failed to decrypt RunPod API key' },
        { status: 500 }
      );
    }

    // Retrieve HuggingFace credentials for model upload (optional)
    let hfToken: string | undefined;
    let hfRepoName: string | undefined;

    const hfSecret = await secretsManager.getSecret(user.id, 'huggingface', supabase);
    if (hfSecret) {
      try {
        hfToken = decrypt(hfSecret.api_key_encrypted);

        // Debug: Log the entire metadata structure
        console.log('[RunPod API] HuggingFace metadata:', JSON.stringify(hfSecret.metadata));

        // Try multiple possible paths for username
        let hfUsername =
          hfSecret.metadata?.huggingface?.username ||  // Expected path
          hfSecret.metadata?.username ||                // Alternative path
          (hfSecret.metadata as any)?.hf_username;      // Another alternative

        console.log('[RunPod API] Extracted username:', hfUsername);

        // If username not in metadata, try to fetch it from HuggingFace API
        if (hfToken && !hfUsername) {
          console.log('[RunPod API] Fetching HuggingFace username from API...');
          try {
            const hfResponse = await fetch('https://huggingface.co/api/whoami', {
              headers: { 'Authorization': `Bearer ${hfToken}` }
            });
            if (hfResponse.ok) {
              const hfData = await hfResponse.json();
              hfUsername = hfData.name;
              console.log('[RunPod API] ✓ Retrieved HuggingFace username from API:', hfUsername);
            } else {
              console.warn('[RunPod API] Failed to fetch HF username:', hfResponse.status);
            }
          } catch (apiError) {
            console.warn('[RunPod API] Error fetching HF username:', apiError);
          }
        }

        if (hfToken && hfUsername) {
          // Auto-generate repo name from HF username + config name
          // Format: username/config-name (sanitized)
          const sanitizedConfigName = training_config_id.slice(0, 8); // Use first 8 chars of ID as fallback
          hfRepoName = `${hfUsername}/finetune-${sanitizedConfigName}`;
          console.log('[RunPod API] ✓ HuggingFace upload enabled:', hfRepoName);
        } else {
          console.log('[RunPod API] ℹ HuggingFace credentials incomplete (missing username)');
        }
      } catch (error) {
        console.warn('[RunPod API] Failed to decrypt HuggingFace token:', error);
      }
    } else {
      console.log('[RunPod API] ℹ No HuggingFace credentials - model upload disabled');
    }

    // Fetch training configuration with attached datasets via junction table
    const { data: trainingConfig, error: configError } = await supabase
      .from('training_configs')
      .select(`
        *,
        datasets:training_config_datasets(
          dataset:training_datasets(*)
        )
      `)
      .eq('id', training_config_id)
      .eq('user_id', user.id)
      .single();

    if (configError || !trainingConfig) {
      console.error('[RunPod API] Training config not found:', configError);
      return NextResponse.json(
        { error: 'Training configuration not found' },
        { status: 404 }
      );
    }

    console.log('[RunPod API] Retrieved training config:', trainingConfig.name);

    // Extract dataset from junction table
    const attachedDatasets = trainingConfig.datasets || [];
    const dataset = attachedDatasets[0]?.dataset;
    const datasetStoragePath = dataset?.storage_path;

    console.log('[RunPod API] Attached datasets count:', attachedDatasets.length);
    if (dataset) {
      console.log('[RunPod API] Using dataset:', dataset.name, 'at', datasetStoragePath);
    }

    let datasetDownloadUrl: string;

    if (datasetStoragePath) {
      console.log('[RunPod API] Generating download URL for dataset:', datasetStoragePath);

      try {
        const { datasetUrlService } = await import('@/lib/training/dataset-url-service');
        const urlData = await datasetUrlService.generateDownloadUrl(
          datasetStoragePath,
          user.id,
          supabase,
          2,
          dataset.storage_provider || 'supabase'
        );

        datasetDownloadUrl = urlData.url;
        console.log('[RunPod API] Dataset download URL generated:', urlData.token.substring(0, 10));
      } catch (error) {
        console.error('[RunPod API] Failed to generate dataset URL:', error);
        return NextResponse.json(
          {
            error: 'Failed to prepare dataset for download',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    } else {
      console.error('[RunPod API] No dataset attached to this training configuration');
      return NextResponse.json(
        { error: 'Please attach a dataset to this training configuration before deploying' },
        { status: 400 }
      );
    }

    jobId = crypto.randomUUID();
    const jobToken = crypto.randomBytes(32).toString('base64url');

    // Extract model name from config JSON
    console.log('[RunPod API] Config structure:', {
      has_config_json: !!trainingConfig.config_json,
      has_model_in_config: !!trainingConfig.config_json?.model,
      model_name: trainingConfig.config_json?.model?.name,
      model_name_type: typeof trainingConfig.config_json?.model?.name,
      model_name_raw: JSON.stringify(trainingConfig.config_json?.model?.name),
      config_keys: trainingConfig.config_json ? Object.keys(trainingConfig.config_json) : [],
      full_model_object: JSON.stringify(trainingConfig.config_json?.model)
    });

    const modelName = trainingConfig.config_json?.model?.name ||
                      trainingConfig.model_name ||
                      'Qwen/Qwen2.5-0.5B-Instruct'; // Fallback to a small public model

    console.log('[RunPod API] Using model:', modelName);
    console.log('[RunPod API] Model name has slash:', modelName.includes('/'));
    console.log('[RunPod API] Model name characters:', modelName.split('').map((c: string) => `${c}(${c.charCodeAt(0)})`).join(' '));

    // Get dataset metadata for sample count
    const { data: datasetMetadata } = await supabase
      .from('training_datasets')
      .select('sample_count, train_samples, val_samples')
      .eq('storage_path', datasetStoragePath)
      .single();

    console.log('[RunPod API] Dataset metadata:', datasetMetadata);

    // Calculate total_steps from config
    const config = trainingConfig.config_json;
    const batchSize = config?.training?.batch_size || 4;
    const gradAccum = config?.training?.gradient_accumulation_steps || 8;
    const numEpochs = config?.training?.num_epochs || 3;
    const sampleCount = datasetMetadata?.sample_count || 0;

    let totalSteps = null;
    if (sampleCount > 0) {
      const effectiveBatch = batchSize * gradAccum;
      const stepsPerEpoch = Math.ceil(sampleCount / effectiveBatch);
      totalSteps = stepsPerEpoch * numEpochs;
      console.log('[RunPod API] Calculated total_steps:', totalSteps, `(${sampleCount} samples / ${effectiveBatch} batch * ${numEpochs} epochs)`);
    }

    const { error: jobError } = await supabase
      .from('local_training_jobs')
      .insert({
        id: jobId,
        user_id: user.id,
        model_name: modelName,
        dataset_path: datasetStoragePath,
        status: 'pending',
        job_token: jobToken,
        config: trainingConfig.config_json,
        started_at: new Date().toISOString(),
        // Add dataset metadata
        total_samples: datasetMetadata?.sample_count || null,
        train_samples: datasetMetadata?.train_samples || null,
        val_samples: datasetMetadata?.val_samples || null,
        // Add calculated total_steps
        total_steps: totalSteps,
        expected_total_steps: totalSteps,
      });

    if (jobError) {
      console.error('[RunPod API] Failed to create job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create training job' },
        { status: 500 }
      );
    }

    console.log('[RunPod API] Created job:', jobId);

    // Auto-detect app URL from request if NEXT_PUBLIC_APP_URL not set
    console.log('[RunPod API] DEBUG - NEXT_PUBLIC_APP_URL env var:', process.env.NEXT_PUBLIC_APP_URL);
    console.log('[RunPod API] DEBUG - Request host:', request.headers.get('host'));
    console.log('[RunPod API] DEBUG - Request protocol:', request.headers.get('x-forwarded-proto'));

    let appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      const host = request.headers.get('host');
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      appUrl = `${protocol}://${host}`;
      console.log('[RunPod API] Auto-detected app URL from request:', appUrl);
    } else {
      console.log('[RunPod API] Using NEXT_PUBLIC_APP_URL from environment:', appUrl);
    }

    console.log('[RunPod API] DEBUG - Final appUrl value:', appUrl);

    if (appUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
      console.error('[RunPod API] ⚠️  WARNING: Using localhost URL in production!');
      console.error('[RunPod API] Metrics API will be unreachable from RunPod pods.');
    }

    const trainingScript = runPodService.generateTrainingScript(
      modelName,
      datasetStoragePath,
      trainingConfig.config_json || {}
    );

    // Construct URLs that will be passed to RunPod
    // Note: job_id is passed in POST body, not URL path
    const metricsApiUrl = `${appUrl}/api/training/local/metrics`;
    const alertApiUrl = `${appUrl}/api/alerts/trigger`;

    console.log('[RunPod API] DEBUG - Constructed METRICS_API_URL:', metricsApiUrl);
    console.log('[RunPod API] DEBUG - Constructed ALERT_API_URL:', alertApiUrl);

    const deployment = await runPodService.createPod(
      {
        training_config_id,
        gpu_type,
        gpu_count,
        docker_image,
        volume_size_gb,
        environment_variables: {
          ...environment_variables,
          JOB_ID: jobId,
          JOB_TOKEN: jobToken,
          USER_ID: user.id,  // Pass user ID for predictions persistence
          // Fixed environment variable names to match Python script expectations
          SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
          SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          // Also provide service role key as fallback for RLS bypass if needed
          SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          DATASET_URL: datasetDownloadUrl,
          MODEL_NAME: modelName,
          // Metrics API configuration for cloud training metrics reporting
          METRICS_API_URL: metricsApiUrl,
          // Alert API configuration for job status notifications
          ALERT_API_URL: alertApiUrl,
          INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || '',
          ...(hfToken && hfRepoName && {
            HF_TOKEN: hfToken,
            HF_REPO_NAME: hfRepoName
          }), // Include HF credentials if available
          // Performance tuning for cloud training
          DEFAULT_DATALOADER_NUM_WORKERS: '4',
          DEFAULT_DATALOADER_PREFETCH_FACTOR: '2',
          DEFAULT_PRETOKENIZE: 'true',
        },
        budget_limit,
      },
      runpodApiKey,
      trainingScript,
      trainingConfig.config_json,  // Pass training config for time estimation
      dataset?.total_examples       // Pass dataset size for time estimation
    );

    console.log('[RunPod API] Pod created:', deployment.pod_id);

    // Store deployment in database
    const { error: insertError } = await supabase
      .from('cloud_deployments')
      .insert({
        user_id: user.id,
        platform: 'runpod',
        training_config_id,
        deployment_id: deployment.pod_id,
        status: deployment.status,
        url: deployment.pod_url,
        config: {
          job_id: jobId, // Link to local_training_jobs record
          gpu_type,
          gpu_count,
          docker_image,
          volume_size_gb,
          environment_variables,
        },
        estimated_cost: deployment.cost.estimated_cost,
        cost_per_hour: deployment.cost.cost_per_hour,
        budget_limit,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[RunPod API] Failed to store deployment:', insertError);
      // Don't fail the request - pod was created successfully
    }

    console.log('[RunPod API] Deployment stored in database');

    return NextResponse.json({
      job_id: jobId,  // Local training job ID for status tracking
      deployment_id: deployment.pod_id,
      pod_id: deployment.pod_id,
      pod_url: deployment.pod_url,
      status: deployment.status,
      gpu_type: deployment.gpu_type,
      gpu_count: deployment.gpu_count,
      cost: deployment.cost,
      message: 'RunPod deployment created successfully',
    });

  } catch (error) {
    console.error('[RunPod API] Deployment failed:', error);

    // Clean up: Mark job as failed if it was created
    if (jobId && supabase) {
      console.log('[RunPod API] Marking job as failed:', jobId);
      try {
        await supabase
          .from('local_training_jobs')
          .update({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString()
          })
          .eq('id', jobId);
      } catch (updateError) {
        console.error('[RunPod API] Failed to update job status:', updateError);
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to create RunPod deployment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get deployment status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    console.log('[RunPod API] Received status request');

    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
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
      console.error('[RunPod API] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get deployment ID from query
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deployment_id');

    if (!deploymentId) {
      return NextResponse.json(
        { error: 'Missing deployment_id parameter' },
        { status: 400 }
      );
    }

    console.log('[RunPod API] Getting status for pod:', deploymentId);

    // Retrieve RunPod API key
    const secret = await secretsManager.getSecret(user.id, 'runpod', supabase);
    
    if (!secret) {
      return NextResponse.json(
        { error: 'RunPod API key not configured' },
        { status: 400 }
      );
    }

    const runpodApiKey = decrypt(secret.api_key_encrypted);

    // Get pod status
    const status = await runPodService.getPodStatus(deploymentId, runpodApiKey);

    console.log('[RunPod API] Current status:', status.status);

    // Update database record
    const { error: updateError } = await supabase
      .from('cloud_deployments')
      .update({
        status: status.status,
        actual_cost: status.cost.actual_cost,
        updated_at: new Date().toISOString(),
      })
      .eq('deployment_id', deploymentId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[RunPod API] Failed to update status:', updateError);
    }

    return NextResponse.json({
      deployment_id: status.pod_id,
      status: status.status,
      pod_url: status.pod_url,
      cost: status.cost,
      metrics: status.metrics,
    });

  } catch (error) {
    console.error('[RunPod API] Status check failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get deployment status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Stop deployment
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    console.log('[RunPod API] Received stop request');

    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
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
      console.error('[RunPod API] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get deployment ID from query
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deployment_id');

    if (!deploymentId) {
      return NextResponse.json(
        { error: 'Missing deployment_id parameter' },
        { status: 400 }
      );
    }

    console.log('[RunPod API] Stopping pod:', deploymentId);

    // Retrieve RunPod API key
    const secret = await secretsManager.getSecret(user.id, 'runpod', supabase);
    
    if (!secret) {
      return NextResponse.json(
        { error: 'RunPod API key not configured' },
        { status: 400 }
      );
    }

    const runpodApiKey = decrypt(secret.api_key_encrypted);

    // Stop pod
    await runPodService.stopPod(deploymentId, runpodApiKey);

    console.log('[RunPod API] Pod stopped');

    // Update database record
    const { error: updateError } = await supabase
      .from('cloud_deployments')
      .update({
        status: 'stopped',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('deployment_id', deploymentId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[RunPod API] Failed to update status:', updateError);
    }

    return NextResponse.json({
      deployment_id: deploymentId,
      status: 'stopped',
      message: 'RunPod deployment stopped successfully',
    });

  } catch (error) {
    console.error('[RunPod API] Stop failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to stop deployment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
