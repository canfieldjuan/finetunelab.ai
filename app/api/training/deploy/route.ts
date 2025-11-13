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
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import path from 'path';

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
    if (!job_id) {
      return NextResponse.json(
        { error: 'Missing required field: job_id' },
        { status: 400 }
      );
    }

    if (!server_type || !['vllm', 'ollama'].includes(server_type)) {
      return NextResponse.json(
        { error: 'Invalid server_type. Must be "vllm" or "ollama"' },
        { status: 400 }
      );
    }

    // ========================================================================
    // Step 0: Check if vLLM is available (if deploying to vLLM)
    // ========================================================================
    if (server_type === 'vllm') {
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
    console.log('[DeployAPI] Fetching training job:', job_id);

    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    // If job exists in DB, verify it's completed
    if (job) {
      if (job.status !== 'completed') {
        return NextResponse.json(
          {
            error: 'Training job not completed',
            details: `Job status is "${job.status}". Only completed jobs can be deployed.`,
          },
          { status: 400 }
        );
      }
      console.log('[DeployAPI] Training job found in DB:', job.model_name);
    } else {
      console.warn('[DeployAPI] Training job not in DB, proceeding with filesystem-only deployment:', jobError?.message);
    }

    // ========================================================================
    // Step 2: Determine model path
    // ========================================================================
    // Training saves to: lib/training/logs/job_{job_id}/
    // If checkpoint_path is provided, append it to the path
    const outputDir = process.env.TRAINING_OUTPUT_DIR || 'lib/training/logs';
    const basePath = path.join(process.cwd(), outputDir, `job_${job_id}`);
    const modelPath = checkpoint_path
      ? path.join(basePath, checkpoint_path)
      : basePath; // Default to base path if no checkpoint specified

    console.log('[DeployAPI] Model path:', modelPath);
    console.log('[DeployAPI] Checkpoint:', checkpoint_path || 'default (latest)');

    // ========================================================================
    // Step 3: Spawn inference server
    // ========================================================================
    console.log('[DeployAPI] Starting', server_type, 'server');

    let serverInfo;

    if (server_type === 'vllm') {
      // Start vLLM server
      serverInfo = await inferenceServerManager.startVLLM(
        {
          modelPath,
          modelName: name || `${job.model_name}-trained-${Date.now()}`,
          gpuMemoryUtilization: config?.gpu_memory_utilization || 0.8,
          maxModelLen: config?.max_model_len,
          tensorParallelSize: config?.tensor_parallel_size || 1,
          dtype: config?.dtype || 'auto',
          trustRemoteCode: config?.trust_remote_code || false,
        },
        userId,
        job_id,
        supabase
      );
    } else if (server_type === 'ollama') {
      // Start Ollama server
      console.log('[DeployAPI] Starting Ollama deployment...');

      const ollamaConfig: OllamaConfig = {
        modelPath: modelPath,
        modelName: name || `${job.model_name}-trained-${Date.now()}`,
        contextLength: config?.context_length || 4096,
      };

      serverInfo = await inferenceServerManager.startOllama(
        ollamaConfig,
        userId,
        job_id,
        supabase
      );

      console.log('[DeployAPI] Ollama deployment successful:', serverInfo.serverId);
    } else {
      return NextResponse.json(
        { error: 'Unsupported server type' },
        { status: 400 }
      );
    }

    console.log('[DeployAPI] Server spawned:', serverInfo.serverId);

    // ========================================================================
    // Step 4: Wait for server to be running (poll for up to 30 seconds)
    // ========================================================================
    console.log('[DeployAPI] Waiting for server to be ready...');

    let serverReady = false;
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    const pollInterval = 2000; // Check every 2 seconds

    while (Date.now() - startTime < maxWaitTime && !serverReady) {
      const status = await inferenceServerManager.getServerStatus(serverInfo.serverId, userId, supabase);

      if (status?.status === 'running') {
        serverReady = true;
        console.log('[DeployAPI] Server is running!');
        break;
      } else if (status?.status === 'error') {
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
      console.warn('[DeployAPI] Server not ready after 30 seconds, returning starting status');
      // Server is still starting, but we'll return success
      // User can check status later
    }

    // ========================================================================
    // Step 5: Create model entry in llm_models table
    // ========================================================================
    console.log('[DeployAPI] Creating model entry in database');

    const modelName = name || (job ? `${job.model_name}-trained-${Date.now()}` : `trained-model-${Date.now()}`);
    // Compute served name for providers that require strict naming (e.g., Ollama)
    const servedName = server_type === 'ollama' ? sanitizeOllamaModelName(modelName) : modelName;

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
    const isNativeLoRA = trainingMethod === 'lora' && server_type === 'vllm';
    const storageInfo = isNativeLoRA ? {
      deployment_type: 'native_lora',
      storage_saved: true,
      // Typical savings: 50MB adapter vs 1-14GB merged model
      estimated_savings_gb: job?.config?.lora_r ? (job.config.lora_r <= 8 ? 1.0 : 14.0) : 1.0
    } : {
      deployment_type: 'standard',
      storage_saved: false
    };

    const { data: modelEntry, error: modelError } = await supabase
      .from('llm_models')
      .insert({
        user_id: userId,
        provider: server_type,
        name: modelName,
        model_id: modelPath, // Filesystem path - used for metadata/display only
        served_model_name: servedName, // Name vLLM/Ollama uses in API
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
          display_name: modelName, // Keep display name in metadata
          checkpoint_path: checkpoint_path,
          ...storageInfo, // Include native LoRA deployment tracking
        },
      })
      .select()
      .single();

    if (modelError) {
      console.error('[DeployAPI] Failed to create model entry:', modelError);
      // Server is already running, so we'll return partial success
      return NextResponse.json(
        {
          success: true,
          server_id: serverInfo.serverId,
          status: serverInfo.status,
          base_url: serverInfo.baseUrl,
          port: serverInfo.port,
          model_id: null,
          warning: 'Server started but failed to create model entry',
          error: modelError.message,
        },
        { status: 200 }
      );
    }

    console.log('[DeployAPI] Model entry created:', modelEntry.id);

    // ========================================================================
    // Step 6: Return success
    // ========================================================================
    return NextResponse.json({
      success: true,
      server_id: serverInfo.serverId,
      status: serverReady ? 'running' : 'starting',
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

    // Get server status
    const status = await inferenceServerManager.getServerStatus(serverId, userId, supabase);

    if (!status) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('[DeployAPI] Status check error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get server status',
        details: error instanceof Error ? error.message : String(error),
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
