/**
 * RunPod API Service
 * Purpose: Interact with RunPod API for serverless GPU pod deployment
 * Date: 2025-10-31
 * 
 * RunPod API Documentation: https://docs.runpod.io/docs/graphql-api
 */

import type {
  RunPodDeploymentRequest,
  RunPodDeploymentResponse,
  RunPodDeploymentStatus,
  RunPodGPUType,
  DeploymentStatus,
} from './deployment.types';

import type { TrainingConfig, AdvancedTrainingConfig } from './training-config.types';
import { estimateTrainingTime } from './time-estimation';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface RunPodPodResponse {
  id: string;
  name: string;
  imageName: string;
  uptimeSeconds?: number;
  desiredStatus: string;
  machineId?: string;
  machine?: {
    podHostId: string;
    gpuTypeId?: string;
    costPerHr?: number;
  };
}

interface RunPodGraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    path?: string[];
  }>;
}

// ============================================================================
// RUNPOD API SERVICE
// ============================================================================

export class RunPodService {
  private graphqlUrl = 'https://api.runpod.io/graphql';
  
  /**
   * Create authentication headers for RunPod API
   */
  private getAuthHeaders(apiKey: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  /**
   * Execute GraphQL query
   */
  private async graphql<T>(
    query: string,
    variables: Record<string, unknown>,
    apiKey: string
  ): Promise<T> {
    const response = await fetch(this.graphqlUrl, {
      method: 'POST',
      headers: this.getAuthHeaders(apiKey),
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RunPod API error: ${response.status} - ${errorText}`);
    }

    const result: RunPodGraphQLResponse<T> = await response.json();

    if (result.errors && result.errors.length > 0) {
      // Log full error details for debugging
      console.error('[RunPodService] GraphQL errors:', JSON.stringify(result.errors, null, 2));
      const errorMessages = result.errors.map(e => {
        // Extract any additional error details
        const details = [];
        if (e.message) details.push(e.message);
        if ((e as Record<string, unknown>).extensions) details.push(`extensions: ${JSON.stringify((e as Record<string, unknown>).extensions)}`);
        if ((e as Record<string, unknown>).path) details.push(`path: ${JSON.stringify((e as Record<string, unknown>).path)}`);
        return details.join(' | ');
      });
      throw new Error(`RunPod GraphQL error: ${errorMessages.join(', ')}`);
    }

    if (!result.data) {
      throw new Error('RunPod API returned no data');
    }

    return result.data;
  }

  /**
   * Create a new serverless pod
   * @param request - Deployment request with GPU and budget settings
   * @param apiKey - RunPod API key
   * @param trainingScript - Training script to execute
   * @param trainingConfig - Optional training config for time estimation
   * @param datasetSize - Optional dataset size (number of examples) for time estimation
   */
  async createPod(
    request: RunPodDeploymentRequest,
    apiKey: string,
    trainingScript: string,
    trainingConfig?: TrainingConfig,
    datasetSize?: number
  ): Promise<RunPodDeploymentResponse> {
    console.log('[RunPodService] Creating pod...');

    try {
      // Map GPU type to RunPod GPU ID
      const gpuTypeId = this.mapGPUType(request.gpu_type);
      console.log('[RunPodService] Requesting GPU:', {
        requested: request.gpu_type,
        mapped_to: gpuTypeId,
        gpu_count: request.gpu_count || 1,
        cloudType: 'SECURE'
      });

      const mutation = `
        mutation CreatePod($input: PodFindAndDeployOnDemandInput!) {
          podFindAndDeployOnDemand(input: $input) {
            id
            name
            imageName
            desiredStatus
            machine {
              gpuTypeId
              costPerHr
            }
          }
        }
      `;

      const podName = `training-${request.training_config_id.substring(0, 8)}`;

      // Base64 encode the training script to pass via environment variable
      // This avoids shell escaping issues with the large script
      const scriptBase64 = Buffer.from(trainingScript).toString('base64');

      // Bootstrap decodes the script from environment variable and executes it
      // Must be wrapped in bash -c '...' for shell expansion of env vars
      const bootstrapScript = `bash -c 'echo "$TRAINING_SCRIPT_B64" | base64 -d > /workspace/run_training.sh && chmod +x /workspace/run_training.sh && /workspace/run_training.sh'`;

      console.log('[RunPodService] Script sizes:', {
        originalLength: trainingScript.length,
        base64Length: scriptBase64.length,
        bootstrapLength: bootstrapScript.length
      });

      const variables = {
        input: {
          cloudType: 'SECURE',
          gpuTypeId,
          gpuCount: request.gpu_count || 1,
          name: podName,
          imageName: request.docker_image || 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel', // PHASE 2 FIX: Use image with Python pre-installed
          volumeInGb: request.volume_size_gb || 100,
          containerDiskInGb: 100,
          env: [
            { key: 'TRAINING_CONFIG_ID', value: request.training_config_id },
            { key: 'TRAINING_SCRIPT_B64', value: scriptBase64 },
            ...(request.environment_variables
              ? Object.entries(request.environment_variables).map(([key, value]) => ({ key, value }))
              : []
            ),
          ],
          dockerArgs: bootstrapScript,
          ports: '8080/http',
          volumeMountPath: '/workspace',
        },
      };

      // Log request details for debugging
      const requestBody = JSON.stringify({ query: mutation, variables });
      const requestSizeKB = (requestBody.length / 1024).toFixed(2);
      console.log('[RunPodService] GraphQL request size:', requestSizeKB, 'KB');
      console.log('[RunPodService] Full input object:', JSON.stringify(variables.input, null, 2));
      console.log('[RunPodService] CloudType being sent:', variables.input.cloudType);
      console.log('[RunPodService] GPU Type ID being sent:', variables.input.gpuTypeId);
      console.log('[RunPodService] VolumeInGb:', variables.input.volumeInGb);
      console.log('[RunPodService] ContainerDiskInGb:', variables.input.containerDiskInGb);
      console.log('[RunPodService] Environment variables count:', variables.input.env.length);
      console.log('[RunPodService] DockerArgs length:', variables.input.dockerArgs.length, 'chars');

      const data = await this.graphql<{ podFindAndDeployOnDemand: RunPodPodResponse }>(
        mutation,
        variables,
        apiKey
      );

      const pod = data.podFindAndDeployOnDemand;

      console.log('[RunPodService] Pod created:', pod.id);

      // Calculate estimated time and cost using throughput-based estimation
      const costPerHr = pod.machine?.costPerHr || 0;
      let estimatedHours: number | undefined;
      let estimatedCost: number | undefined;

      // Map GPU type to time-estimation GPU key
      // Maps pricing-config IDs to time-estimation.ts benchmark keys
      const gpuTypeMapping: Record<string, string> = {
        'RTX_A4000': 'rtx_a4000',
        'RTX_A5000': 'rtx_a5000',
        'RTX_A6000': 'rtx_a6000',
        'A100_PCIE': 'a100_pcie',
        'A100_80GB': 'a100-80gb',  // Note: hyphen in benchmark key
        'A100_SXM': 'a100_sxm',
        'H100_PCIE': 'h100_pcie',
        // Fallback patterns
        'NVIDIA RTX A4000': 'rtx_a4000',
        'NVIDIA RTX A5000': 'rtx_a5000',
        'NVIDIA RTX A6000': 'rtx_a6000',
        'NVIDIA A100 40GB': 'a100-40gb',
        'NVIDIA A100 80GB': 'a100-80gb',
        'NVIDIA H100': 'h100_pcie',
      };
      const gpuKey = gpuTypeMapping[request.gpu_type || 'RTX_A4000'] || 'rtx_a4000';

      if (trainingConfig) {
        // Use proper throughput-based time estimation
        const timeEstimate = estimateTrainingTime(trainingConfig, gpuKey, datasetSize);
        const totalHours = timeEstimate.estimated_hours + (timeEstimate.estimated_minutes / 60);
        estimatedHours = totalHours;
        estimatedCost = costPerHr * totalHours;

        console.log('[RunPodService] Time estimation:', {
          estimated_hours: timeEstimate.estimated_hours,
          estimated_minutes: timeEstimate.estimated_minutes,
          total_hours: totalHours.toFixed(2),
          estimated_cost: estimatedCost?.toFixed(2),
          tokens_processed: timeEstimate.tokens_processed,
          total_steps: timeEstimate.total_steps,
          dataset_size: datasetSize,
          gpu_key: gpuKey
        });
      } else {
        // Fallback: If no training config, use budget-based estimate (old behavior)
        // but mark it clearly as budget-based, not time-based
        console.log('[RunPodService] No training config provided - using budget-based estimate');
        if (request.budget_limit && costPerHr > 0) {
          estimatedHours = request.budget_limit / costPerHr;
          estimatedCost = request.budget_limit;
        }
      }

      return {
        deployment_id: pod.id,
        pod_id: pod.id,
        pod_url: `https://www.runpod.io/console/pods/${pod.id}`,
        status: 'creating',
        gpu_type: request.gpu_type || 'NVIDIA RTX A4000',
        gpu_count: request.gpu_count || 1,
        cost: {
          estimated_cost: estimatedCost || 0,
          cost_per_hour: costPerHr,
          estimated_hours: estimatedHours,
          budget_limit: request.budget_limit, // Keep budget separate from estimate
          currency: 'USD',
        },
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[RunPodService] Create pod failed:', error);

      // Provide helpful error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes('no longer any instances available')) {
          const enhancedError = new Error(
            `No ${request.gpu_type || 'requested'} GPUs currently available on RunPod. ` +
            `Try: (1) Select a different GPU type, (2) Try again in a few minutes, or (3) Use cloudType: ALL instead of SECURE`
          );
          enhancedError.name = 'GPUUnavailableError';
          throw enhancedError;
        }
      }

      throw error;
    }
  }

  /**
   * Get pod status
   */
  async getPodStatus(
    podId: string,
    apiKey: string
  ): Promise<RunPodDeploymentStatus> {
    console.log('[RunPodService] Getting pod status:', podId);

    try {
      const query = `
        query GetPod($podId: String!) {
          pod(input: { podId: $podId }) {
            id
            name
            desiredStatus
            imageName
            uptimeSeconds
            machine {
              podHostId
              gpuTypeId
              costPerHr
            }
          }
        }
      `;

      const data = await this.graphql<{ pod: RunPodPodResponse }>(
        query,
        { podId },
        apiKey
      );

      const pod = data.pod;

      // Map RunPod status to our deployment status
      const status: DeploymentStatus = this.mapPodStatus(pod.desiredStatus);

      // Calculate actual cost
      const costPerHr = pod.machine?.costPerHr || 0;
      const actualCost = pod.uptimeSeconds
        ? (pod.uptimeSeconds / 3600) * costPerHr
        : undefined;

      const deploymentStatus: RunPodDeploymentStatus = {
        deployment_id: podId,
        pod_id: podId,
        status,
        pod_url: `https://www.runpod.io/console/pods/${podId}`,
        cost: {
          actual_cost: actualCost,
          cost_per_hour: costPerHr,
          currency: 'USD',
          estimated_cost: 0,
        },
      };

      console.log('[RunPodService] Status:', status);

      return deploymentStatus;
    } catch (error) {
      console.error('[RunPodService] Get status failed:', error);
      throw error;
    }
  }

  /**
   * Get pod logs
   * Note: RunPod doesn't have a direct logs API
   * Logs need to be accessed via SSH or the web console
   */
  async getPodLogs(podId: string): Promise<string> {
    console.log('[RunPodService] Getting pod logs:', podId);
    // Logs are available in RunPod console or via SSH
    return 'Pod logs available in RunPod console. SSH into pod for real-time logs.';
  }

  /**
   * Stop/terminate a pod
   */
  async stopPod(
    podId: string,
    apiKey: string
  ): Promise<void> {
    console.log('[RunPodService] Stopping pod:', podId);

    try {
      const mutation = `
        mutation TerminatePod($podId: String!) {
          podTerminate(input: { podId: $podId })
        }
      `;

      await this.graphql<{ podTerminate: void }>(
        mutation,
        { podId },
        apiKey
      );

      console.log('[RunPodService] Pod stopped');
    } catch (error) {
      console.error('[RunPodService] Stop pod failed:', error);
      throw error;
    }
  }

  /**
   * Read and encode standalone_trainer.py for upload to RunPod
   * Returns base64-encoded content for safe shell transfer
   */
  private getStandaloneTrainerContent(): string {
    try {
      const trainerPath = path.join(
        process.cwd(),
        'lib',
        'training',
        'standalone_trainer.py'
      );

      const content = fs.readFileSync(trainerPath, 'utf-8');
      const base64Content = Buffer.from(content, 'utf-8').toString('base64');

      return base64Content;
    } catch (error) {
      console.error('[RunPodService] Failed to read standalone_trainer.py:', error);
      throw new Error('Failed to read standalone trainer script');
    }
  }

  /**
   * Generate config.json content for standalone_trainer.py
   * Converts TrainingConfig TypeScript interface to Python config format
   */
  private generateTrainingConfig(
    modelName: string,
    datasetPath: string,
    trainingConfig: TrainingConfig
  ): any {
    const training = trainingConfig.training as AdvancedTrainingConfig;
    const data = trainingConfig.data;
    const model = trainingConfig.model;
    const loraConfig = training.lora_config;

    return {
      model: {
        name: modelName,
        trust_remote_code: model.trust_remote_code || false,
        torch_dtype: model.torch_dtype || 'float16',
        device_map: model.device_map || 'auto',
      },
      tokenizer: {
        name: trainingConfig.tokenizer?.name || modelName,
        trust_remote_code: trainingConfig.tokenizer?.trust_remote_code || model.trust_remote_code || false,
        padding_side: trainingConfig.tokenizer?.padding_side,
        add_eos_token: trainingConfig.tokenizer?.add_eos_token,
      },
      training: {
        method: training.method || 'sft',
        use_lora: training.use_lora !== false,
        num_epochs: training.num_epochs || 3,
        batch_size: training.batch_size || 4,
        learning_rate: training.learning_rate || 0.0002,
        lr_scheduler_type: training.lr_scheduler_type || 'cosine',
        warmup_ratio: training.warmup_ratio,
        warmup_steps: training.warmup_steps || 100,
        save_steps: training.save_steps || 500,
        save_total_limit: training.save_total_limit || 3,
        evaluation_strategy: training.evaluation_strategy || 'steps',
        eval_steps: training.eval_steps || 500,
        eval_batch_size: training.eval_batch_size || training.batch_size || 4,
        packing: training.packing || false,
        gradient_accumulation_steps: training.gradient_accumulation_steps || 1,
        logging_steps: training.logging_steps || 10,
        bf16: training.bf16 !== false,
        fp16: training.fp16 || false,
        optim: training.optim || 'paged_adamw_8bit',
        max_grad_norm: training.max_grad_norm || 1.0,
        weight_decay: training.weight_decay || 0.01,
        gradient_checkpointing: training.gradient_checkpointing !== false,
        dataloader_num_workers: training.dataloader_num_workers || 4,
        dataloader_prefetch_factor: training.dataloader_prefetch_factor || 2,
        dataloader_pin_memory: training.dataloader_pin_memory !== false,
        group_by_length: training.group_by_length || false,
        max_length: training.max_length || 512,
        quantization: training.quantization || {},
      },
      lora: {
        r: loraConfig?.r || 16,
        alpha: loraConfig?.lora_alpha || 32,
        dropout: loraConfig?.lora_dropout || 0.05,
        target_modules: loraConfig?.target_modules || null,
        bias: loraConfig?.bias || 'none',
        task_type: loraConfig?.task_type || 'CAUSAL_LM',
      },
      data: {
        strategy: data?.strategy || 'standard',
        generation_type: data?.generation_type || 'real',
        max_samples: data?.max_samples,
        train_split: data?.train_split || 0.8,
        eval_split: data?.eval_split || 0.2,
        dataset_format: data?.dataset_format,
      },
      dataset_path: datasetPath,
      output_dir: '/workspace/fine_tuned_model',
      ...(trainingConfig.evaluation && { evaluation: trainingConfig.evaluation }),
      ...(trainingConfig.tensorboard && { tensorboard: trainingConfig.tensorboard }),
      ...(trainingConfig.predictions && { predictions: trainingConfig.predictions }),
      ...(trainingConfig.tools && { tools: trainingConfig.tools }),
      ...(trainingConfig.seed !== undefined && { seed: trainingConfig.seed }),
    };
  }

  /**
   * Generate training script for RunPod
   */
  generateTrainingScript(
    modelName: string,
    datasetPath: string,
    trainingConfig: TrainingConfig
  ): string {
    // Create a bash script that downloads standalone_trainer.py and runs training
    return `
# PHASE 2 FIX: Enhanced logging and error handling
# Removed -e flag to prevent immediate exit on error and allow debugging
set -uo pipefail

# Prevent restart loops - check if script already ran
LOCK_FILE="/workspace/.training_started"
if [ -f "$LOCK_FILE" ]; then
  echo "================================================"
  echo "[$(date)] DETECTED CONTAINER RESTART"
  echo "================================================"
  echo "Training script already started at: $(cat $LOCK_FILE)"
  echo "This is likely a container restart. Keeping container alive..."
  echo "Check logs above for the actual error that caused restart."
  echo ""
  tail -f /dev/null
fi

# Mark that we've started (prevents restart loops)
echo "$(date)" > "$LOCK_FILE"

echo "================================================"
echo "[$(date)] RunPod Training Script Started"
echo "================================================"

echo "=== System Information ==="
echo "Date: $(date)"
echo "Hostname: $(hostname)"
echo "Working Directory: $(pwd)"
echo "GPU: $(nvidia-smi --query-gpu=name --format=csv,noheader 2>&1 || echo 'No GPU detected')"
echo "CUDA Version: $(nvcc --version 2>&1 | grep release || echo 'CUDA not found')"
echo "Python: $(python --version 2>&1 || echo 'Python not found')"
echo "Disk Space: $(df -h /workspace | tail -1)"
echo "=========================="
echo ""

# Install dependencies
echo "[$(date)] Installing dependencies..."

# Verify Python is available
if ! python --version >/dev/null 2>&1; then
  echo "[$(date)] ✗ ERROR: Python not found in PATH"
  echo "[$(date)] Waiting 60s before exit for log inspection..."
  sleep 60
  exit 1
fi

# Upgrade pip first to avoid version issues
echo "[$(date)] Upgrading pip..."
if python -m pip install --root-user-action=ignore --upgrade pip >/dev/null 2>&1; then
  echo "[$(date)] ✓ Pip upgraded: $(python -m pip --version)"
else
  echo "[$(date)] ✗ WARNING: Failed to upgrade pip, continuing with existing version"
fi

echo "[$(date)] Current TRL version (before upgrade): $(python -m pip show trl 2>/dev/null | grep Version || echo 'not installed')"

# Uninstall old trl first, then install fresh to avoid caching issues
python -m pip uninstall -y trl 2>/dev/null || true

# Remove torchvision and torchaudio if present (not needed for LLM text training)
# This prevents version conflicts when PyTorch gets upgraded
echo "[$(date)] Removing torchvision/torchaudio (not needed for text LLM training)..."
python -m pip uninstall -y torchvision torchaudio 2>/dev/null || true

# Pin PyTorch to 2.1.0 to match base image CUDA 11.8 (prevents 1.5GB CUDA 12 download)
echo "[$(date)] Pinning PyTorch to 2.1.0 (matches CUDA 11.8 base image)..."
python -m pip install --root-user-action=ignore --no-cache-dir "torch==2.1.0" 2>&1 | grep -v "Requirement already satisfied" || true

echo "[$(date)] Installing training dependencies..."
if python -m pip install --root-user-action=ignore --no-cache-dir \
   "trl==0.26.0" \
   "transformers>=4.40.0" \
   "datasets>=2.18.0" \
   "accelerate>=0.27.0" \
   "peft>=0.9.0" \
   "bitsandbytes>=0.42.0" \
   "tensorboard>=2.14.0" \
   "pynvml>=11.5.0" \
   "supabase>=2.0.0" \
   "huggingface_hub>=0.20.0" \
   "requests>=2.31.0"; then
  echo "[$(date)] ✓ Dependencies installed successfully"
  echo "[$(date)] TRL version: $(python -m pip show trl | grep Version)"
  echo "[$(date)] Transformers version: $(python -m pip show transformers | grep Version)"
  # Verify the import works
  python -c "from trl import SFTTrainer; print('[$(date)] ✓ TRL imports verified')" || {
    echo "[$(date)] ✗ ERROR: TRL imports failed after upgrade"
    python -m pip show trl
    echo "[$(date)] Waiting 60s before exit for log inspection..."
    sleep 60
    exit 1
  }
else
  echo "[$(date)] ✗ ERROR: Failed to install dependencies"
  echo "[$(date)] Waiting 60s before exit for log inspection..."
  sleep 60
  exit 1
fi

# Download training data
echo "[$(date)] Downloading dataset..."
cd /workspace || exit 1

if wget -q -O dataset_download "$DATASET_URL"; then
  echo "[$(date)] ✓ Dataset downloaded ($(du -h dataset_download | cut -f1))"

  # Check if file is gzipped by reading magic bytes (1f 8b)
  MAGIC_BYTES=$(od -An -tx1 -N2 dataset_download | tr -d ' ')
  if [ "$MAGIC_BYTES" = "1f8b" ]; then
    echo "[$(date)] Dataset is gzipped (magic bytes: $MAGIC_BYTES) - decompressing..."
    if gunzip -c dataset_download > dataset.jsonl; then
      echo "[$(date)] ✓ Dataset decompressed ($(wc -l < dataset.jsonl) lines)"
      rm dataset_download
    else
      echo "[$(date)] ✗ ERROR: Failed to decompress gzipped dataset"
      echo "[$(date)] Waiting 60s before exit for log inspection..."
      sleep 60
      exit 1
    fi
  else
    echo "[$(date)] Dataset is not gzipped (magic bytes: $MAGIC_BYTES) - using directly..."
    mv dataset_download dataset.jsonl
    echo "[$(date)] ✓ Dataset ready ($(wc -l < dataset.jsonl) lines)"
  fi
else
  echo "[$(date)] ✗ ERROR: Failed to download dataset"
  echo "[$(date)] URL was: $DATASET_URL"
  echo "[$(date)] This could mean the download token has expired (tokens expire after 2 hours)"
  echo "[$(date)] Waiting 60s before exit for log inspection..."
  sleep 60
  exit 1
fi

# Download standalone_trainer.py from GitHub
echo "[$(date)] Downloading standalone_trainer.py from GitHub..."
TRAINER_URL="https://raw.githubusercontent.com/canfieldjuan/finetunelab.ai/main/lib/training/standalone_trainer.py"
if curl -f -L -o /workspace/standalone_trainer.py "$TRAINER_URL"; then
  chmod +x /workspace/standalone_trainer.py
  echo "[$(date)] ✓ standalone_trainer.py downloaded ($(wc -l < /workspace/standalone_trainer.py) lines)"
else
  echo "[$(date)] ✗ ERROR: Failed to download standalone_trainer.py"
  echo "[$(date)] URL was: $TRAINER_URL"
  echo "[$(date)] Waiting 60s before exit for log inspection..."
  sleep 60
  exit 1
fi

# Create training configuration JSON
echo "[$(date)] Creating training configuration..."
cat > /workspace/config.json << 'CONFIGEOF'
${JSON.stringify(this.generateTrainingConfig(modelName, '/workspace/dataset.jsonl', trainingConfig), null, 2)}
CONFIGEOF
echo "[$(date)] ✓ config.json created"
echo "[$(date)] Config preview:"
head -20 /workspace/config.json

# DEPRECATED: Old embedded train.py approach replaced with standalone_trainer.py download from GitHub
# All training logic is now in standalone_trainer.py (downloaded at runtime)

# Set environment variables for cloud training mode
echo "[$(date)] Setting environment variables for cloud training..."
export JOB_ID="${'${JOB_ID}'}"
export JOB_TOKEN="${'${JOB_TOKEN}'}"
export USER_ID="${'${USER_ID}'}"
export METRICS_API_URL="${'${METRICS_API_URL}'}"
export NEXT_PUBLIC_SUPABASE_URL="${'${SUPABASE_URL}'}"
export SUPABASE_SERVICE_ROLE_KEY="${'${SUPABASE_SERVICE_KEY}'}"
export ALERT_API_URL="${'${ALERT_API_URL}'}"
export INTERNAL_API_KEY="${'${INTERNAL_API_KEY}'}"
echo "[$(date)] ✓ Environment variables set"
echo "[$(date)] JOB_ID: ${'${JOB_ID}'}"
echo "[$(date)] METRICS_API_URL: ${'${METRICS_API_URL}'}"

# PHASE 2 FIX: Run training with error handling and early termination
echo "[$(date)] =========================================="
echo "[$(date)] Starting training with standalone_trainer.py..."
echo "[$(date)] =========================================="

if python /workspace/standalone_trainer.py --config /workspace/config.json --execution-id ${'${JOB_ID}'} 2>&1 | tee training_output.log; then
  EXIT_CODE=\${PIPESTATUS[0]}
  echo "[$(date)] =========================================="
  echo "[$(date)] ✓ Training completed successfully! (exit code: \$EXIT_CODE)"
  echo "[$(date)] Model saved to /workspace/fine_tuned_model"
  echo "[$(date)] =========================================="

  # Keep pod alive for 1 hour to allow model download
  echo "[$(date)] Pod will remain active for 1 hour for model download"
  echo "[$(date)] You can download the model from /workspace/fine_tuned_model"
  sleep 3600

  echo "[$(date)] Shutting down pod"
  exit 0
else
  EXIT_CODE=\${PIPESTATUS[0]}
  echo "[$(date)] =========================================="
  echo "[$(date)] ✗ Training failed with exit code: \$EXIT_CODE"
  echo "[$(date)] =========================================="
  echo "[$(date)] Last 50 lines of training output:"
  tail -50 training_output.log || echo "Could not read training log"

  # Wait before terminating to allow log inspection
  echo "[$(date)] Waiting 120s before terminating pod (allows log inspection in RunPod console)"
  sleep 120

  echo "[$(date)] Terminating pod"
  exit \$EXIT_CODE
fi
`.trim();
  }

  /**
   * Map GPU type to RunPod GPU Type ID
   * Handles both new UI ID format (RTX_A4000) and old full name format (NVIDIA RTX A4000)
   * Returns RunPod GPU Type IDs (e.g., AMPERE_16, AMPERE_80) as required by podFindAndDeployOnDemand API
   */
  private mapGPUType(gpuType?: RunPodGPUType | string): string {
    // Handle new UI ID format from pricing-config.ts
    // Maps to RunPod's actual GPU names (not shorthand codes)
    const idToRunPodMap: Record<string, string> = {
      'RTX_A4000': 'NVIDIA RTX A4000',
      'RTX_A5000': 'NVIDIA RTX A5000',
      'RTX_A6000': 'NVIDIA RTX A6000',
      'A100_PCIE': 'NVIDIA A100 80GB PCIe',  // Note: RunPod uses "80GB PCIe" for both 40GB and 80GB variants
      'A100_80GB': 'NVIDIA A100-SXM4-80GB',  // A100 80GB SXM variant
      'A100_SXM': 'NVIDIA A100-SXM4-80GB',
      'H100_PCIE': 'NVIDIA H100 PCIe',
    };

    // Handle old full name format (backward compatibility)
    // If already in correct format, return as-is
    const nameToRunPodMap: Record<RunPodGPUType, string> = {
      'NVIDIA RTX A4000': 'NVIDIA RTX A4000',
      'NVIDIA RTX A5000': 'NVIDIA RTX A5000',
      'NVIDIA RTX A6000': 'NVIDIA RTX A6000',
      'NVIDIA A40': 'NVIDIA A40',
      'NVIDIA A100 40GB': 'NVIDIA A100 80GB PCIe',
      'NVIDIA A100 80GB': 'NVIDIA A100-SXM4-80GB',
      'NVIDIA H100': 'NVIDIA H100 PCIe',
    };

    if (!gpuType) return 'NVIDIA RTX A4000'; // Default fallback

    // Try new ID format first
    if (idToRunPodMap[gpuType]) {
      return idToRunPodMap[gpuType];
    }

    // Fall back to old name format
    return nameToRunPodMap[gpuType as RunPodGPUType] || 'NVIDIA RTX A4000';
  }

  /**
   * Map RunPod status to deployment status
   */
  private mapPodStatus(podStatus: string): DeploymentStatus {
    const statusMap: Record<string, DeploymentStatus> = {
      'RUNNING': 'running',
      'CREATED': 'starting',
      'EXITED': 'stopped',
      'FAILED': 'failed',
      'TERMINATED': 'stopped',
    };

    return statusMap[podStatus] || 'creating';
  }
}

// Export singleton instance
export const runPodService = new RunPodService();
