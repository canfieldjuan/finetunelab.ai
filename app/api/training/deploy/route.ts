/**
 * Training Deployment API
 *
 * Deploy trained models to local inference servers (vLLM, Ollama)
 *
 * POST /api/training/deploy
 * - Spawns vLLM/Ollama server with trained model
 * - Adds model to llm_models table
 * - Returns deployment status and model ID
 *
 * Phase: Tier 2 - Training Integration
 * Date: 2025-10-28
 */

import { NextRequest, NextResponse } from 'next/server';
import { inferenceServerManager, type OllamaConfig, sanitizeOllamaModelName } from '@/lib/services/inference-server-manager';
import { runpodServerlessService } from '@/lib/inference/runpod-serverless-service';
import { fireworksDeploymentService } from '@/lib/inference/fireworks-deployment-service';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import { decrypt } from '@/lib/models/encryption';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import path from 'path';
import { STATUS } from '@/lib/constants';
import type { RunPodServerlessGPU } from '@/lib/inference/deployment.types';

export async function POST(req: NextRequest) {
  console.log('[DeployAPI] Received deployment request');

  try {
    // Parse request body
    const body = await req.json();
    console.log('[DeployAPI] Request body:', JSON.stringify(body, null, 2));
    
    const { job_id, server_type, checkpoint_path, name, config } = body;

    // Get Authorization header and create authenticated Supabase client
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[DeployAPI] No authorization header provided');
      return NextResponse.json(
        { error: 'Unauthorized - Authorization header required' },
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

    // Validate required fields
    if (!server_type || ![STATUS.VLLM, STATUS.OLLAMA, STATUS.RUNPOD, STATUS.RUNPOD_SERVERLESS, 'fireworks'].includes(server_type)) {
      return NextResponse.json(
        { error: 'Invalid server_type. Must be "vllm", "ollama", "runpod", "runpod-serverless", or "fireworks"' },
        { status: 400 }
      );
    }

    // job_id is optional - only required for training deployments, not for base/external models
    // If not provided, must provide model_path in config
    if (!job_id && !config?.model_path) {
      return NextResponse.json(
        { error: 'Either job_id or config.model_path must be provided' },
        { status: 400 }
      );
    }

    // ========================================================================
    // Step 0: Check if vLLM is available (if deploying to vLLM)
    // ========================================================================
    if (server_type === STATUS.VLLM) {
      console.log('[DeployAPI] Checking vLLM availability...');

      // Check if vLLM is available via Python (native)
      // Native launcher is mandatory so we surface failures immediately
      try {
        // Check native vLLM availability
        const pythonPath = process.env.VLLM_PYTHON_PATH || process.env.PYTHON_PATH || 'python3';
        execSync(`${pythonPath} -c "import vllm"`, {
          encoding: 'utf-8',
          timeout: 5000,
          stdio: 'pipe'
        });
        console.log('[DeployAPI] vLLM is available (native Python)');
      } catch (vllmError) {
        console.error('[DeployAPI] Native vLLM import failed:', vllmError);
        return NextResponse.json(
          {
            error: 'vLLM not available',
            details: 'vLLM must be installed in the configured Python environment. Docker fallback has been removed.',
            hint: 'Run: pip install vllm',
          },
          { status: 400 }
        );
      }
    }

    // Get authenticated user from Supabase session
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[DeployAPI] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - please login to deploy models' },
        { status: 401 }
      );
    }

    const userId = user.id;
    console.log('[DeployAPI] Authenticated user:', user.email);

    // ========================================================================
    // Step 1: Get training job details (optional - used for metadata only)
    // ========================================================================
    let job = null;

    if (job_id) {
      console.log('[DeployAPI] Fetching training job:', job_id);

      const { data: jobData, error: jobError } = await supabase
        .from('local_training_jobs')
        .select('*')
        .eq('id', job_id)
        .single();

      // If job exists in DB, verify it's completed
      if (jobData) {
        if (jobData.status !== STATUS.COMPLETED) {
          return NextResponse.json(
            {
              error: 'Training job not completed',
              details: `Job status is "${jobData.status}". Only completed jobs can be deployed.`,
            },
            { status: 400 }
          );
        }
        job = jobData;
        console.log('[DeployAPI] Training job found in DB:', job.model_name);
      } else {
        console.warn('[DeployAPI] Training job not in DB, proceeding with filesystem-only deployment:', jobError?.message);
      }
    } else {
      console.log('[DeployAPI] No job_id provided, deploying base/external model');
    }

    // ========================================================================
    // Step 2: Determine model path
    // ========================================================================
    // Two modes:
    // 1. Local deployment (from Add Model dialog): config.model_path provided directly
    // 2. Training deployment: construct path from job_id
    let modelPath: string;

    if (config?.model_path) {
      // Local deployment mode: use provided model path directly
      // Can be HuggingFace model ID (e.g., "Qwen/Qwen2.5-0.5B") or local path
      modelPath = config.model_path;
      console.log('[DeployAPI] Local deployment mode - using provided model path:', modelPath);
    } else {
      // Training deployment mode: determine if checkpoint is HuggingFace repo or local path
      // HuggingFace repos match pattern: "username/repo-name" (exactly one slash, no other path indicators)
      // Local paths: "checkpoint-850", "merged_model", "lib/training/logs/checkpoint-850"
      const isHuggingFaceRepo = checkpoint_path && /^[^\/]+\/[^\/]+$/.test(checkpoint_path);

      if (isHuggingFaceRepo) {
        // Checkpoint is a HuggingFace repo (e.g., "Canfield/finetune-c6190493")
        // Use it directly without joining with local base path
        modelPath = checkpoint_path!;
        console.log('[DeployAPI] Training deployment mode - using HuggingFace repo:', modelPath);
      } else {
        // Checkpoint is a local path (e.g., "checkpoint-850" or "merged_model")
        // Construct full local file path
        const outputDir = process.env.TRAINING_OUTPUT_DIR || 'lib/training/logs';
        const basePath = path.join(process.cwd(), outputDir, `job_${job_id}`);
        modelPath = checkpoint_path
          ? path.join(basePath, checkpoint_path)
          : basePath; // Default to base path if no checkpoint specified
        console.log('[DeployAPI] Training deployment mode - using local path:', modelPath);
        console.log('[DeployAPI] Checkpoint:', checkpoint_path || 'default (latest)');
      }
    }

    // ========================================================================
    // Step 2.5: Stop ALL vLLM servers before deploying (local dev cleanup)
    // ========================================================================
    const modelName = name || (job ? `${job.model_name}-trained-${Date.now()}` : `trained-model-${Date.now()}`);

    console.log('[DeployAPI] Stopping ALL vLLM servers before deploying:', modelName);

    // Find ALL running/starting vLLM servers for this user
    const { data: allVllmServers } = await supabase
      .from('local_inference_servers')
      .select('id, status, port, model_name')
      .eq('user_id', userId)
      .eq('server_type', 'vllm')
      .in('status', [STATUS.RUNNING, STATUS.STARTING]);

    if (allVllmServers && allVllmServers.length > 0) {
      console.log(`[DeployAPI] Found ${allVllmServers.length} vLLM server(s) to stop`);

      for (const server of allVllmServers) {
        try {
          console.log(`[DeployAPI] Stopping vLLM server ${server.id} (${server.model_name}) on port ${server.port}`);
          await inferenceServerManager.stopServer(server.id, userId);
        } catch (error) {
          console.error(`[DeployAPI] Failed to stop server ${server.id}:`, error);
          // Continue with other servers even if one fails
        }
      }

      console.log('[DeployAPI] All vLLM servers stopped');
    } else {
      console.log('[DeployAPI] No running vLLM servers found');
    }

    // Check if model entry exists (for UPDATE vs INSERT)
    const { data: existingModel } = await supabase
      .from('llm_models')
      .select('id, name, metadata')
      .eq('user_id', userId)
      .eq('name', modelName)
      .single();

    let shouldUpdateModel = false;

    if (existingModel) {
      console.log('[DeployAPI] Found existing model entry:', existingModel.id);
      shouldUpdateModel = true;
    } else {
      console.log('[DeployAPI] No existing model entry found, will create new one');
    }

    // ========================================================================
    // Step 3: Spawn inference server
    // ========================================================================
    console.log('[DeployAPI] Starting', server_type, 'server');

    let serverInfo;

    // ========================================================================
    // RunPod Common Setup (for both RUNPOD and RUNPOD_SERVERLESS)
    // ========================================================================
    let runpodApiKey: string | undefined;
    let hfToken: string | undefined;
    let hfModelId: string | undefined;
    let deploymentName: string | undefined;

    if (server_type === STATUS.RUNPOD || server_type === STATUS.RUNPOD_SERVERLESS) {
      console.log('[DeployAPI] Setting up RunPod deployment...');

      // Get RunPod API key from secrets vault
      const runpodSecret = await secretsManager.getSecret(userId, 'runpod', supabase);
      if (!runpodSecret) {
        return NextResponse.json(
          { error: 'RunPod API key not configured. Please add your RunPod credentials in Settings > Secrets.' },
          { status: 400 }
        );
      }

      runpodApiKey = decrypt(runpodSecret.api_key_encrypted);

      // Get HuggingFace token for gated models (optional)
      try {
        const hfSecret = await secretsManager.getSecret(userId, 'huggingface', supabase);
        if (hfSecret?.api_key_encrypted) {
          hfToken = decrypt(hfSecret.api_key_encrypted);
        }
      } catch (error) {
        console.warn('[DeployAPI] HuggingFace token not available (optional for gated models)');
      }

      // For RunPod, we need the HuggingFace model ID, not local path
      // If job exists, use job.model_name (the base model from training)
      // If deploying a fine-tuned model that was uploaded to HF, use the HF repo URL
      hfModelId = job?.model_name || config?.model_path || modelPath;
      deploymentName = name || (job ? `${job.model_name.replace('/', '-')}-finetuned` : `model-${Date.now()}`);

      console.log('[DeployAPI] RunPod deployment config:', {
        model: hfModelId,
        name: deploymentName,
        gpu: config?.gpu_type || 'NVIDIA RTX A4000',
        budget: config?.budget_limit || 5,
      });
    }

    if (server_type === STATUS.VLLM) {
      // Start vLLM server
      serverInfo = await inferenceServerManager.startVLLM(
        {
          modelPath,
          modelName: name || (job ? `${job.model_name}-trained-${Date.now()}` : `model-${Date.now()}`),
          gpuMemoryUtilization: config?.gpu_memory_utilization || 0.8,
          maxModelLen: config?.max_model_len || 8192,
          tensorParallelSize: config?.tensor_parallel_size || 1,
          dtype: config?.dtype || 'auto',
          trustRemoteCode: config?.trust_remote_code || false,
        },
        userId,
        job_id || null,
        supabase
      );
    } else if (server_type === STATUS.OLLAMA) {
      // Start Ollama server
      console.log('[DeployAPI] Starting Ollama deployment...');

      const ollamaConfig: OllamaConfig = {
        modelPath: modelPath,
        modelName: name || (job ? `${job.model_name}-trained-${Date.now()}` : `model-${Date.now()}`),
        contextLength: config?.context_length || 4096,
      };

      serverInfo = await inferenceServerManager.startOllama(
        ollamaConfig,
        userId,
        job_id || null,
        supabase
      );

      console.log('[DeployAPI] Ollama deployment successful:', serverInfo.serverId);
    } else if (server_type === STATUS.RUNPOD) {
      // ========================================================================
      // RUNPOD POD DEPLOYMENT - Separate flow, returns early
      // ========================================================================
      console.log('[DeployAPI] Deploying vLLM pod on RunPod...');

      // Deploy vLLM pod on RunPod
      const runpodResponse = await runpodServerlessService.deployVLLMPod(
        {
          deployment_name: deploymentName!,
          model_id: hfModelId!,
          gpu_type: (config?.gpu_type || 'NVIDIA RTX A4000') as RunPodServerlessGPU,
          gpu_count: config?.gpu_count || 1,
          hf_token: hfToken,
          budget_limit: config?.budget_limit || 5,
          volume_size_gb: config?.volume_size_gb || 50,
          use_network_volume: config?.use_network_volume,
          data_center_id: config?.data_center_id, // Will use default in service if not provided
        },
        runpodApiKey!
      );

      console.log('[DeployAPI] RunPod pod deployed:', runpodResponse.endpoint_id);

      // Create or update model entry in llm_models table with RunPod info
      const runpodModelName = deploymentName!;

      // Check if model with same name already exists for this user
      const { data: existingRunpodModel } = await supabase
        .from('llm_models')
        .select('id')
        .eq('user_id', userId)
        .eq('name', runpodModelName)
        .single();

      const modelData = {
        user_id: userId,
        provider: 'runpod',
        name: runpodModelName,
        model_id: hfModelId!,
        served_model_name: hfModelId!,
        base_url: runpodResponse.endpoint_url,
        is_global: false,
        enabled: true,
        training_method: job?.config?.training_method || (job?.config?.use_lora ? 'lora' : 'full'),
        base_model: job?.model_name || hfModelId!,
        training_dataset: job?.dataset_path || null,
        training_date: job?.completed_at || new Date().toISOString(),
        auth_type: 'none',
        metadata: {
          training_job_id: job_id,
          runpod_pod_id: runpodResponse.endpoint_id,
          runpod_endpoint_url: runpodResponse.endpoint_url,
          network_volume_id: runpodResponse.network_volume_id, // Add this
          deployed_at: new Date().toISOString(),
          gpu_type: config?.gpu_type || 'NVIDIA RTX A4000',
          budget_limit: config?.budget_limit || 5,
          deployment_type: 'runpod_vllm',
        },
      };

      let modelEntry;
      let modelError;

      if (existingRunpodModel) {
        // UPDATE existing model
        console.log('[DeployAPI] Updating existing RunPod model entry:', existingRunpodModel.id);
        const result = await supabase
          .from('llm_models')
          .update(modelData)
          .eq('id', existingRunpodModel.id)
          .select()
          .single();
        modelEntry = result.data;
        modelError = result.error;
      } else {
        // INSERT new model
        console.log('[DeployAPI] Creating new RunPod model entry');
        const result = await supabase
          .from('llm_models')
          .insert(modelData)
          .select()
          .single();
        modelEntry = result.data;
        modelError = result.error;
      }

      if (modelError) {
        console.error('[DeployAPI] Failed to save RunPod model entry:', modelError);
        return NextResponse.json(
          {
            success: true,
            pod_id: runpodResponse.endpoint_id,
            endpoint_url: runpodResponse.endpoint_url,
            status: runpodResponse.status,
            model_id: null,
            warning: 'RunPod pod deployed but failed to save model entry',
            error: modelError.message,
          },
          { status: 200 }
        );
      }

      console.log('[DeployAPI] RunPod model entry saved:', modelEntry.id);

      // Also create entry in inference_deployments for cost tracking on /inference page
      const { data: inferenceDeployment, error: inferenceError } = await supabase
        .from('inference_deployments')
        .insert({
          user_id: userId,
          training_config_id: job?.config_id || null,
          training_job_id: job_id || null,
          provider: 'runpod-serverless',
          deployment_name: runpodModelName,
          deployment_id: runpodResponse.endpoint_id,
          endpoint_url: runpodResponse.endpoint_url,
          status: runpodResponse.status,
          network_volume_id: runpodResponse.network_volume_id, // Add this
          config: {
            gpu_type: config?.gpu_type || 'NVIDIA RTX A4000',
            gpu_count: config?.gpu_count || 1,
            deployment_type: 'vllm_pod',
          },
          model_type: 'merged-model',
          base_model: hfModelId!,
          model_storage_url: hfModelId!,
          cost_per_request: 0, // Pod-based = pay per hour, not per request
          budget_limit: config?.budget_limit || 5,
          current_spend: 0,
          request_count: 0,
        })
        .select()
        .single();

      if (inferenceError) {
        console.warn('[DeployAPI] Failed to create inference_deployments entry (non-fatal):', inferenceError.message);
        // Non-fatal - model entry is already created
      } else {
        console.log('[DeployAPI] Inference deployment entry saved:', inferenceDeployment?.id);
      }

      // Return success for RunPod deployment (early return - different flow than local)
      return NextResponse.json({
        success: true,
        server_id: runpodResponse.endpoint_id,
        pod_id: runpodResponse.endpoint_id,
        status: runpodResponse.status,
        base_url: runpodResponse.endpoint_url,
        model_id: modelEntry.id,
        inference_deployment_id: inferenceDeployment?.id,
        model_name: runpodModelName,
        message: 'Model deployed to RunPod successfully! Pod is starting, will be ready in 2-5 minutes.',
      });
    } else if (server_type === STATUS.RUNPOD_SERVERLESS) {
      // ========================================================================
      // RUNPOD SERVERLESS DEPLOYMENT - Auto-scaling endpoint
      // ========================================================================
      console.log('[DeployAPI] Deploying RunPod Serverless endpoint...');

      // Deploy serverless endpoint on RunPod
      const serverlessResponse = await runpodServerlessService.createEndpoint(
        {
          deployment_name: deploymentName!,
          model_storage_url: hfModelId!,
          base_model: hfModelId!,
          model_type: 'merged-model',
          gpu_type: (config?.gpu_type || 'NVIDIA RTX A4000') as RunPodServerlessGPU,
          budget_limit: config?.budget_limit || 10,
          // Worker scaling - default to 1 max worker to stay within quota limits
          min_workers: config?.min_workers ?? 0,
          max_workers: config?.max_workers ?? 1,
          environment_variables: {
            ...(hfToken ? { HUGGINGFACE_TOKEN: hfToken } : {}),
            ...(config?.max_model_len ? { MAX_MODEL_LEN: String(config.max_model_len) } : {}),
            ...(config?.gpu_memory_utilization ? { GPU_MEMORY_UTILIZATION: String(config.gpu_memory_utilization) } : {}),
          },
        },
        runpodApiKey!
      );

      console.log('[DeployAPI] RunPod Serverless endpoint created:', serverlessResponse.endpoint_id);

      // Create entry in inference_deployments for cost tracking
      const { data: inferenceDeployment, error: inferenceError} = await supabase
        .from('inference_deployments')
        .insert({
          user_id: userId,
          training_config_id: job?.config_id || null,
          training_job_id: job_id || null,
          provider: 'runpod-serverless',
          deployment_name: deploymentName!,
          deployment_id: serverlessResponse.endpoint_id,
          endpoint_url: serverlessResponse.endpoint_url,
          status: serverlessResponse.status,
          config: {
            gpu_type: config?.gpu_type || 'NVIDIA RTX A4000',
            gpu_count: config?.gpu_count || 1,
            deployment_type: 'serverless',
          },
          model_type: 'merged-model',
          base_model: hfModelId!,
          model_storage_url: hfModelId!,
          cost_per_request: serverlessResponse.cost.cost_per_request,
          budget_limit: config?.budget_limit || 10,
          current_spend: 0,
          request_count: 0,
        })
        .select()
        .single();

      if (inferenceError) {
        console.warn('[DeployAPI] Failed to create inference_deployments entry (non-fatal):', inferenceError.message);
      } else {
        console.log('[DeployAPI] Inference deployment entry saved:', inferenceDeployment?.id);
      }

      // Create model entry in llm_models table for chat portal integration
      console.log('[DeployAPI] Creating model entry for chat portal...');

      const modelName = deploymentName || `${hfModelId}-serverless`;
      const defaultContextLength = 4096;
      const defaultMaxTokens = 2000;

      console.log('[DeployAPI] Model name:', modelName);
      console.log('[DeployAPI] Base URL:', serverlessResponse.endpoint_url);

      // Check if model already exists for this user
      const { data: existingModel } = await supabase
        .from('llm_models')
        .select('id')
        .eq('user_id', userId)
        .eq('name', modelName)
        .single();

      if (existingModel) {
        console.log('[DeployAPI] Model entry already exists:', existingModel.id);
      } else {
        console.log('[DeployAPI] No existing model found, creating new entry');
      }

      // Build model data object
      const modelData = {
        user_id: userId,
        provider: 'runpod',
        name: modelName,
        model_id: hfModelId!,
        base_url: serverlessResponse.endpoint_url,
        served_model_name: hfModelId!,
        is_global: false,
        enabled: true,
        auth_type: 'none',
        supports_streaming: true,
        supports_functions: false,
        supports_vision: false,
        context_length: config?.max_model_len || defaultContextLength,
        max_output_tokens: defaultMaxTokens,
        training_method: job?.training_method || 'sft',
        base_model: hfModelId!,
        training_dataset: job?.dataset_path || null,
        training_date: job?.completed_at || new Date().toISOString(),
        metadata: {
          training_job_id: job_id,
          runpod_endpoint_id: serverlessResponse.endpoint_id,
          runpod_endpoint_url: serverlessResponse.endpoint_url,
          deployment_type: 'runpod_serverless',
          deployed_at: new Date().toISOString(),
          cost_per_request: serverlessResponse.cost.cost_per_request,
          budget_limit: config?.budget_limit || 10,
        },
      };

      console.log('[DeployAPI] Model data prepared:', {
        name: modelData.name,
        provider: modelData.provider,
        base_url: modelData.base_url,
        context_length: modelData.context_length,
      });

      // Insert or update model entry
      let modelEntry;
      let isNewModel = false;

      try {
        if (existingModel) {
          console.log('[DeployAPI] Updating existing model entry...');
          const { data, error } = await supabase
            .from('llm_models')
            .update(modelData)
            .eq('id', existingModel.id)
            .select()
            .single();

          if (error) {
            console.error('[DeployAPI] Failed to update model entry:', error.message);
            throw error;
          }

          modelEntry = data;
          console.log('[DeployAPI] Model entry updated:', modelEntry.id);
        } else {
          console.log('[DeployAPI] Inserting new model entry...');
          const { data, error } = await supabase
            .from('llm_models')
            .insert(modelData)
            .select()
            .single();

          if (error) {
            console.error('[DeployAPI] Failed to create model entry:', error.message);
            throw error;
          }

          modelEntry = data;
          isNewModel = true;
          console.log('[DeployAPI] Model entry created:', modelEntry.id);
        }

        console.log('[DeployAPI] Model registration complete');
        console.log('[DeployAPI] Model available in chat portal');
      } catch (modelError) {
        console.error('[DeployAPI] Model registration failed (non-fatal):', modelError);
        console.warn('[DeployAPI] Endpoint deployed but model not registered');
      }

      // Return success for RunPod Serverless deployment (early return - different flow than local)
      const successMessage = modelEntry
        ? 'Serverless endpoint created and model registered! Ready to use in chat.'
        : 'Serverless endpoint created! Workers will auto-scale based on demand.';

      console.log('[DeployAPI] Returning deployment response');
      console.log('[DeployAPI] Model ID for redirect:', modelEntry?.id || 'none');

      return NextResponse.json({
        success: true,
        endpoint_id: serverlessResponse.endpoint_id,
        deployment_id: serverlessResponse.deployment_id,
        status: serverlessResponse.status,
        endpoint_url: serverlessResponse.endpoint_url,
        model_id: modelEntry?.id,
        inference_deployment_id: inferenceDeployment?.id,
        deployment_name: deploymentName!,
        message: successMessage,
      });
    } else if (server_type === 'fireworks') {
      // ========================================================================
      // FIREWORKS.AI DEPLOYMENT
      // ========================================================================
      console.log('[DeployAPI] Deploying to Fireworks.ai...');

      // Get Fireworks API key from secrets vault
      const fireworksSecret = await secretsManager.getSecret(userId, 'fireworks', supabase);
      if (!fireworksSecret) {
        return NextResponse.json(
          { error: 'Fireworks.ai API key not configured. Please add it in Settings > Secrets.' },
          { status: 400 }
        );
      }
      const fireworksApiKey = decrypt(fireworksSecret.api_key_encrypted);

      const deploymentName = name || (job ? `${job.model_name.replace('/', '-')}-finetuned` : `model-${Date.now()}`);

      // Note: modelPath is the local path to the trained model files
      const fireworksResponse = await fireworksDeploymentService.deployModel(
        {
          deployment_name: deploymentName,
          model_path: modelPath,
          hf_token: hfToken,
          model_id: config?.model_id || (job ? job.model_name : deploymentName),
        },
        fireworksApiKey
      );

    } else if (server_type === 'fireworks') {
      // ========================================================================
      // FIREWORKS.AI DEPLOYMENT
      // ========================================================================
      console.log('[DeployAPI] Deploying to Fireworks.ai...');

      // Get Fireworks API key from secrets vault
      const fireworksSecret = await secretsManager.getSecret(userId, 'fireworks', supabase);
      if (!fireworksSecret) {
        return NextResponse.json(
          { error: 'Fireworks.ai API key not configured. Please add it in Settings > Secrets.' },
          { status: 400 }
        );
      }
      const fireworksApiKey = decrypt(fireworksSecret.api_key_encrypted);

      const deploymentName = name || (job ? `${job.model_name.replace('/', '-')}-finetuned` : `model-${Date.now()}`);
      
      // Get HuggingFace token for gated models (optional) - required for Fireworks model upload
      try {
        const hfSecret = await secretsManager.getSecret(userId, 'huggingface', supabase);
        if (hfSecret?.api_key_encrypted) {
          hfToken = decrypt(hfSecret.api_key_encrypted);
        }
      } catch (error) {
        console.warn('[DeployAPI] HuggingFace token not available (optional for gated models on Fireworks)');
      }

      // Note: modelPath is the local path to the trained model files
      const fireworksResponse = await fireworksDeploymentService.deployModel(
        {
          deployment_name: deploymentName,
          model_path: modelPath, // Local path to the fine-tuned model
          hf_token: hfToken,
          model_id: hfModelId!, // HuggingFace model ID for reference
          base_model: job?.model_name || hfModelId!, // Base model for Fireworks.ai
        },
        fireworksApiKey
      );

      console.log('[DeployAPI] Fireworks.ai deployment initiated:', fireworksResponse);
      
      const fireworksModelName = deploymentName;

      // --- Save to llm_models table ---
      // Check if model with same name already exists for this user
      const { data: existingFireworksModel } = await supabase
        .from('llm_models')
        .select('id')
        .eq('user_id', userId)
        .eq('name', fireworksModelName)
        .single();

      const llmModelData = {
        user_id: userId,
        provider: 'fireworks', // Provider is now 'fireworks'
        name: fireworksModelName,
        model_id: fireworksResponse.model_id, // Use Fireworks-specific model_id
        served_model_name: fireworksResponse.model_id.split('/').pop(), // e.g., 'model-xxxx'
        base_url: fireworksResponse.endpoint_url,
        is_global: false,
        enabled: true,
        training_method: job?.config?.training_method || (job?.config?.use_lora ? 'lora' : 'full'),
        base_model: job?.model_name || hfModelId!,
        training_dataset: job?.dataset_path || null,
        training_date: job?.completed_at || new Date().toISOString(),
        auth_type: 'bearer', // Fireworks uses bearer token
        metadata: {
          training_job_id: job_id,
          fireworks_deployment_id: fireworksResponse.deployment_id,
          fireworks_model_id: fireworksResponse.model_id,
          deployed_at: new Date().toISOString(),
          // Add any other relevant Fireworks.ai specific metadata here
        },
      };

      let modelEntry;
      let modelError;

      if (existingFireworksModel) {
        console.log('[DeployAPI] Updating existing Fireworks model entry:', existingFireworksModel.id);
        const result = await supabase
          .from('llm_models')
          .update(llmModelData)
          .eq('id', existingFireworksModel.id)
          .select()
          .single();
        modelEntry = result.data;
        modelError = result.error;
      } else {
        console.log('[DeployAPI] Creating new Fireworks model entry');
        const result = await supabase
          .from('llm_models')
          .insert(llmModelData)
          .select()
          .single();
        modelEntry = result.data;
        modelError = result.error;
      }

      if (modelError) {
        console.error('[DeployAPI] Failed to save Fireworks model entry:', modelError);
        return NextResponse.json(
          {
            success: true,
            deployment_id: fireworksResponse.deployment_id,
            status: fireworksResponse.status,
            model_id: null,
            warning: 'Fireworks deployment initiated but failed to save model entry',
            error: modelError.message,
          },
          { status: 200 }
        );
      }
      console.log('[DeployAPI] Fireworks model entry saved:', modelEntry.id);

      // --- Save to inference_deployments table ---
      const { data: inferenceDeployment, error: inferenceError } = await supabase
        .from('inference_deployments')
        .insert({
          user_id: userId,
          training_config_id: job?.config_id || null,
          training_job_id: job_id || null,
          provider: 'fireworks',
          deployment_name: fireworksModelName,
          deployment_id: fireworksResponse.deployment_id,
          endpoint_url: fireworksResponse.endpoint_url,
          status: fireworksResponse.status,
          fireworks_model_id: fireworksResponse.model_id, // Add this
          fireworks_deployment_id: fireworksResponse.deployment_id, // Add this
          config: {
            deployment_type: 'fireworks',
            // Add any other relevant config from request
          },
          model_type: 'merged-model', // Assuming it's a merged model
          base_model: job?.model_name || hfModelId!,
          model_storage_url: hfModelId!, // Or the Fireworks.ai internal ID
          cost_per_request: 0, // Need to get this from Fireworks.ai pricing
          budget_limit: config?.budget_limit || 10,
          current_spend: 0,
          request_count: 0,
        })
        .select()
        .single();

      if (inferenceError) {
        console.warn('[DeployAPI] Failed to create inference_deployments entry for Fireworks (non-fatal):', inferenceError.message);
      } else {
        console.log('[DeployAPI] Inference deployment entry saved for Fireworks:', inferenceDeployment?.id);
      }

      return NextResponse.json({
        success: true,
        server_id: fireworksResponse.deployment_id, // For frontend polling
        pod_id: fireworksResponse.deployment_id, // For frontend polling
        status: fireworksResponse.status,
        base_url: fireworksResponse.endpoint_url,
        model_id: modelEntry.id,
        inference_deployment_id: inferenceDeployment?.id,
        model_name: fireworksModelName,
        message: 'Model deployed to Fireworks.ai successfully! It is now being provisioned.',
      });

    } else {
      return NextResponse.json(
        { error: 'Unsupported server type' },
        { status: 400 }
      );
    }

    console.log('[DeployAPI] Server spawned:', serverInfo.serverId);

    // ========================================================================
    // Step 4: Wait for server to be running (configurable timeout via .env.local)
    // ========================================================================
    console.log('[DeployAPI] Waiting for server to be ready...');

    let serverReady = false;
    const maxWaitTime = parseInt(process.env.INFERENCE_SERVER_READY_TIMEOUT_MS || '30000', 10); // Default: 30s, configured via .env.local
    const startTime = Date.now();
    const pollInterval = parseInt(process.env.INFERENCE_SERVER_POLL_INTERVAL_MS || '2000', 10); // Check every 2 seconds

    while (Date.now() - startTime < maxWaitTime && !serverReady) {
      const status = await inferenceServerManager.getServerStatus(serverInfo.serverId, userId, supabase);

      if (status?.status === STATUS.RUNNING) {
        serverReady = true;
        console.log('[DeployAPI] Server is running!');
        break;
      } else if (status?.status === STATUS.ERROR) {
        console.error('[DeployAPI] Server failed to start:', status.errorMessage);
        return NextResponse.json(
          {
            error: 'Server failed to start',
            details: status.errorMessage || 'Unknown error',
            server_id: serverInfo.serverId,
          },
          { status: 500 }
        );
      }

      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    if (!serverReady) {
      console.warn(`[DeployAPI] Server not ready after ${maxWaitTime / 1000} seconds, returning starting status`);
      // Server is still starting, but we'll return success
      // User can check status later
    }

    // ========================================================================
    // Step 5: Create or update model entry in llm_models table
    // ========================================================================
    console.log('[DeployAPI] Creating or updating model entry in database');

    // Note: modelName already calculated in Step 2.5 (line 175)
    // Compute served name for providers that require strict naming (e.g., Ollama)
    const servedName = server_type === STATUS.OLLAMA ? sanitizeOllamaModelName(modelName) : modelName;

    // Extract training metadata from job (if available)
    const trainingMethod = job?.config?.training_method || (job?.config?.use_lora ? 'lora' : 'full');
    const loraConfig = job?.config?.use_lora ? {
      r: job.config.lora_r,
      alpha: job.config.lora_alpha,
      dropout: job.config.lora_dropout,
      target_modules: job.config.lora_target_modules,
    } : null;

    const evaluationMetrics = job ? {
      final_loss: job.final_loss,
      final_eval_loss: job.final_eval_loss,
      best_eval_loss: job.best_eval_loss,
      best_epoch: job.best_epoch,
      best_step: job.best_step,
      total_epochs: job.total_epochs,
      total_steps: job.total_steps,
    } : null;

    // Check if this is a native LoRA deployment (no merged model created)
    const isNativeLoRA = trainingMethod === 'lora' && server_type === STATUS.VLLM;
    const storageInfo = isNativeLoRA ? {
      deployment_type: 'native_lora',
      storage_saved: true,
      // Typical savings: 50MB adapter vs 1-14GB merged model
      estimated_savings_gb: job?.config?.lora_r ? (job.config.lora_r <= 8 ? 1.0 : 14.0) : 1.0
    } : {
      deployment_type: 'standard',
      storage_saved: false
    };

    // ========================================================================
    // Helper: Determine readable model_id for analytics display
    // ========================================================================
    function getDisplayModelId(
      modelPath: string,
      job: any,
      config: any
    ): string {
      // Priority 1: Training job's base model (best for analytics)
      if (job?.model_name) {
        return job.model_name;  // e.g., "meta-llama/Llama-3.2-3B-Instruct"
      }

      // Priority 2: HuggingFace model ID from config (non-file-path)
      if (config?.model_path && !config.model_path.startsWith('/')) {
        return config.model_path;  // e.g., "Qwen/Qwen2.5-0.5B"
      }

      // Priority 3: Extract name from path (for local models)
      const pathParts = modelPath.split('/');
      const lastPart = pathParts[pathParts.length - 1];

      // Skip checkpoint folders, use parent instead
      if (lastPart && !lastPart.startsWith('checkpoint-') && !lastPart.startsWith('merged')) {
        return lastPart;
      }

      // If checkpoint or merged, try parent folder
      if (pathParts.length >= 2) {
        const parentPart = pathParts[pathParts.length - 2];
        if (parentPart && parentPart.startsWith('job_')) {
          // Job folder - extract base model from job or use folder name
          return job?.model_name || parentPart;
        }
        return parentPart;
      }

      // Last resort
      return 'local-model';
    }

    // Use UPDATE if model exists, INSERT if new
    let modelEntry: any;
    let modelError: any;

    if (shouldUpdateModel && existingModel) {
      // UPDATE existing model entry
      console.log('[DeployAPI] Updating existing model entry:', existingModel.id);
      const { data, error } = await supabase
        .from('llm_models')
        .update({
          provider: server_type,
          model_id: getDisplayModelId(modelPath, job, config),
          served_model_name: servedName,
          base_url: serverInfo.baseUrl,
          enabled: true,
          training_method: trainingMethod,
          base_model: job?.model_name || 'unknown',
          training_dataset: job?.dataset_path || null,
          training_date: job?.completed_at || new Date().toISOString(),
          lora_config: loraConfig,
          evaluation_metrics: evaluationMetrics,
          metadata: {
            training_job_id: job_id,
            server_id: serverInfo.serverId,
            deployed_at: new Date().toISOString(),
            model_path: modelPath,
            display_name: modelName,
            checkpoint_path: checkpoint_path,
            ...storageInfo,
          },
        })
        .eq('id', existingModel.id)
        .select()
        .single();

      modelEntry = data;
      modelError = error;
    } else {
      // INSERT new model entry
      console.log('[DeployAPI] Creating new model entry');
      const { data, error } = await supabase
        .from('llm_models')
        .insert({
          user_id: userId,
          provider: server_type,
          name: modelName,
          model_id: getDisplayModelId(modelPath, job, config),
          served_model_name: servedName,
          base_url: serverInfo.baseUrl,
          is_global: false,
          enabled: true,
          training_method: trainingMethod,
          base_model: job?.model_name || 'unknown',
          training_dataset: job?.dataset_path || null,
          training_date: job?.completed_at || new Date().toISOString(),
          lora_config: loraConfig,
          evaluation_metrics: evaluationMetrics,
          auth_type: 'none',
          metadata: {
            training_job_id: job_id,
            server_id: serverInfo.serverId,
            deployed_at: new Date().toISOString(),
            model_path: modelPath,
            display_name: modelName,
            checkpoint_path: checkpoint_path,
            ...storageInfo,
          },
        })
        .select()
        .single();

      modelEntry = data;
      modelError = error;
    }

    if (modelError) {
      console.error('[DeployAPI] Failed to save model entry:', modelError);
      // Server is already running, so we'll return partial success
      return NextResponse.json(
        {
          success: true,
          server_id: serverInfo.serverId,
          status: serverInfo.status,
          base_url: serverInfo.baseUrl,
          port: serverInfo.port,
          model_id: null,
          warning: 'Server started but failed to save model entry',
          error: modelError.message,
        },
        { status: 200 }
      );
    }

    console.log('[DeployAPI] Model entry saved:', modelEntry.id);

    // ========================================================================
    // Step 6: Return success
    // ========================================================================
    return NextResponse.json({
      success: true,
      server_id: serverInfo.serverId,
      status: serverReady ? STATUS.RUNNING : STATUS.STARTING,
      base_url: serverInfo.baseUrl,
      port: serverInfo.port,
      model_id: modelEntry.id,
      model_name: modelName,
      message: serverReady
        ? 'Model deployed successfully!'
        : 'Model deployment started. Server is still initializing.',
    });
  } catch (error) {
    console.error('[DeployAPI] Deployment error:', error);
    console.error('[DeployAPI] Error stack:', error instanceof Error ? error.stack : 'N/A');
    console.error('[DeployAPI] Error type:', error?.constructor?.name || typeof error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        error: 'Deployment failed',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/training/deploy?server_id=<id>
 *
 * Get deployment status
 */
export async function GET(req: NextRequest) {
  try {
    const serverId = req.nextUrl.searchParams.get('server_id');

    if (!serverId) {
      return NextResponse.json(
        { error: 'Missing required parameter: server_id' },
        { status: 400 }
      );
    }

    // Get Authorization header and create authenticated Supabase client
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[DeployAPI GET] No authorization header provided');
      return NextResponse.json(
        { error: 'Unauthorized - Authorization header required' },
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

    // Get authenticated user from Supabase session
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[DeployAPI GET] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - please login' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Check if it's a Fireworks.ai deployment
    const { data: deploymentRecord, error: deploymentError } = await supabase
      .from('inference_deployments')
      .select('provider, fireworks_deployment_id, fireworks_model_id')
      .eq('deployment_id', serverId)
      .single();

    if (deploymentError && deploymentError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('[DeployAPI GET] Error fetching deployment record:', deploymentError);
      return NextResponse.json(
        { error: 'Failed to retrieve deployment record', details: deploymentError.message },
        { status: 500 }
      );
    }

    if (deploymentRecord?.provider === 'fireworks') {
      console.log(`[DeployAPI GET] Checking Fireworks.ai deployment status for: ${serverId}`);
      try {
        const fireworksSecret = await secretsManager.getSecret(userId, 'fireworks', supabase);
        if (!fireworksSecret) {
          throw new Error('Fireworks.ai API key not configured.');
        }
        const fireworksApiKey = decrypt(fireworksSecret.api_key_encrypted);

        const fireworksStatus = await fireworksDeploymentService.getDeploymentStatus(
            deploymentRecord.fireworks_deployment_id,
            fireworksApiKey
        );

        let mappedStatus: STATUS.RUNNING | STATUS.STARTING | STATUS.ERROR;
        if (fireworksStatus.state === 'READY') {
          mappedStatus = STATUS.RUNNING; // Maps to active
        } else if (fireworksStatus.state === 'FAILED' || fireworksStatus.state === 'TERMINATED') {
          mappedStatus = STATUS.ERROR; // Maps to failed
        } else {
          mappedStatus = STATUS.STARTING; // Maps to deploying/pending
        }

        return NextResponse.json({
          success: true,
          server_id: serverId,
          status: mappedStatus,
          message: fireworksStatus.status.message || `Fireworks deployment is ${fireworksStatus.state.toLowerCase()}`,
          model_id: deploymentRecord.fireworks_model_id, // The full model ID
          endpoint_url: fireworksStatus.endpoint.url,
          // Add other relevant info like endpoint_url if needed for polling
        });

      } catch (error) {
        console.error('[DeployAPI GET] Error checking Fireworks.ai deployment status:', error);
        return NextResponse.json(
          {
            error: 'Failed to get Fireworks.ai deployment status',
            details: error instanceof Error ? error.message : String(error),
          },
          { status: 500 }
        );
      }
    } else {
      // Existing logic for local servers (vLLM, Ollama) or Runpod deployments (handled by inferenceServerManager)
      const status = await inferenceServerManager.getServerStatus(serverId, userId, supabase);

      if (!status) {
        return NextResponse.json(
          { error: 'Server not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(status);
    }
  } catch (error) {
    console.error('[DeployAPI] Status check error:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: 'Failed to get server status',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/training/deploy?server_id=<id>
 *
 * Stop a running server
 */
export async function DELETE(req: NextRequest) {
  try {
    const serverId = req.nextUrl.searchParams.get('server_id');

    if (!serverId) {
      return NextResponse.json(
        { error: 'Missing required parameter: server_id' },
        { status: 400 }
      );
    }

    // Get Authorization header and create authenticated Supabase client
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[DeployAPI DELETE] No authorization header provided');
      return NextResponse.json(
        { error: 'Unauthorized - Authorization header required' },
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[DeployAPI DELETE] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - please login' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Stop server
    await inferenceServerManager.stopServer(serverId, userId);

    return NextResponse.json({
      success: true,
      message: 'Server stopped successfully',
    });
  } catch (error) {
    console.error('[DeployAPI] Stop server error:', error);

    return NextResponse.json(
      {
        error: 'Failed to stop server',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
