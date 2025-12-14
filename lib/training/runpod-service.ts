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
      throw new Error(`RunPod GraphQL error: ${result.errors.map(e => e.message).join(', ')}`);
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
            ...(request.environment_variables
              ? Object.entries(request.environment_variables).map(([key, value]) => ({ key, value }))
              : []
            ),
          ],
          dockerArgs: `bash -c '${trainingScript.replace(/'/g, "'\\''")}'`,
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
   * Generate training script for RunPod
   */
  generateTrainingScript(
    modelName: string,
    datasetPath: string,
    trainingConfig: TrainingConfig
  ): string {
    // Extract training settings with proper typing for AdvancedTrainingConfig properties
    const training = trainingConfig.training as AdvancedTrainingConfig;
    const data = trainingConfig.data;
    
    // Create a bash script that sets up and runs training
    return `
# PHASE 2 FIX: Enhanced logging and error handling
# Removed -e flag to prevent immediate exit on error and allow debugging
set -uo pipefail

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
if pip install -q --upgrade transformers datasets accelerate peft bitsandbytes "trl>=0.9.0" supabase huggingface_hub; then
  echo "[$(date)] ✓ Dependencies installed successfully"
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

  # Check if file is gzipped or plain JSONL
  if file dataset_download | grep -q "gzip compressed"; then
    echo "[$(date)] Dataset is gzipped - decompressing..."
    if zcat dataset_download > dataset.jsonl; then
      echo "[$(date)] ✓ Dataset decompressed ($(wc -l < dataset.jsonl) lines)"
      rm dataset_download
    else
      echo "[$(date)] ✗ ERROR: Failed to decompress gzipped dataset"
      echo "[$(date)] Waiting 60s before exit for log inspection..."
      sleep 60
      exit 1
    fi
  else
    echo "[$(date)] Dataset is already uncompressed - using directly..."
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

# Create training script
cat > train.py << 'EOF'
import os
import time
import torch
import logging
from typing import Dict, Any, Optional
from transformers import AutoTokenizer, AutoModelForCausalLM, AutoConfig, TrainingArguments, Trainer, BitsAndBytesConfig, TrainerCallback
from datasets import load_dataset, Dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer, DPOTrainer, ORPOTrainer, SFTConfig, DPOConfig, ORPOConfig, DataCollatorForCompletionOnlyLM

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============================================================================
# EMBEDDED PREDICTIONS MODULES
# ============================================================================

# Predictions configuration module
class PredictionsConfig:
    """Predictions configuration handler"""
    def __init__(self, config_dict):
        self.enabled = config_dict.get('enabled', False)
        self.sample_count = config_dict.get('sample_count', 5)
        self.sample_frequency = config_dict.get('sample_frequency', 'epoch')
        self.step_interval = config_dict.get('step_interval', 10)

# Predictions sampler module
class PredictionsSampler:
    """Load and sample prompts for prediction generation"""
    def __init__(self, random_seed=42):
        import random
        random.seed(random_seed)

    def load_samples(self, dataset_path, sample_count):
        """Load sample prompts from the training dataset (supports JSONL and JSON array)"""
        try:
            import json
            import random
            import gzip

            samples = []

            # Handle gzip compressed files
            if dataset_path.endswith('.gz'):
                f = gzip.open(dataset_path, 'rt', encoding='utf-8')
            else:
                f = open(dataset_path, 'r', encoding='utf-8')

            try:
                # Read content and detect format
                content = f.read()
                content = content.strip()

                data_items = []

                # Check if it's a JSON array or JSONL
                if content.startswith('['):
                    # JSON array format
                    try:
                        data_items = json.loads(content)
                        logger.info(f"[PredictionsSampler] Detected JSON array format with {len(data_items)} items")
                    except json.JSONDecodeError as e:
                        logger.warning(f"[PredictionsSampler] Failed to parse JSON array: {e}")
                        return []
                else:
                    # JSONL format - parse line by line
                    lines = content.split('\\n')
                    for line in lines:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            data_items.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
                    logger.info(f"[PredictionsSampler] Detected JSONL format with {len(data_items)} items")

            finally:
                f.close()

            if not data_items:
                logger.warning("[PredictionsSampler] No data items found in dataset")
                return []

            # Randomly sample from the dataset
            selected_items = random.sample(data_items, min(sample_count, len(data_items)))

            for data in selected_items:
                # Extract prompt from different possible formats
                prompt = None
                if 'messages' in data and len(data['messages']) > 0:
                    # Chat format - get the user message
                    for msg in data['messages']:
                        if msg.get('role') == 'user':
                            prompt = msg.get('content', '')
                            break
                    # Fallback to first message if no user role found
                    if not prompt:
                        prompt = data['messages'][0].get('content', '')
                elif 'instruction' in data:
                    prompt = data['instruction']
                elif 'prompt' in data:
                    prompt = data['prompt']
                elif 'input' in data:
                    prompt = data['input']
                elif 'text' in data:
                    # Take first part of text as prompt
                    text_parts = data['text'].split('\\n')
                    prompt = text_parts[0] if text_parts else data['text'][:100]

                if prompt:
                    samples.append({'prompt': prompt, 'expected': data})

            logger.info(f"[PredictionsSampler] Loaded {len(samples)} samples from {len(data_items)} total items")
            return samples

        except Exception as e:
            logger.warning(f"[PredictionsSampler] Failed to load samples: {e}")
            import traceback
            logger.warning(f"[PredictionsSampler] Traceback: {traceback.format_exc()}")
            return []

# Predictions generator module  
class PredictionsGenerator:
    """Generate predictions using the current model"""
    
    def generate_predictions(self, model, tokenizer, samples, max_length=256):
        """Generate predictions for the given samples"""
        try:
            predictions = []
            
            for i, sample in enumerate(samples):
                prompt = sample['prompt']
                
                # Tokenize the prompt
                inputs = tokenizer(prompt, return_tensors='pt', truncation=True, max_length=max_length)
                
                # Move to model device
                if hasattr(model, 'device'):
                    inputs = {k: v.to(model.device) for k, v in inputs.items()}
                
                # Generate prediction
                with torch.no_grad():
                    outputs = model.generate(
                        **inputs,
                        max_new_tokens=100,
                        do_sample=True,
                        temperature=0.7,
                        pad_token_id=tokenizer.eos_token_id,
                        use_cache=True
                    )
                
                # Decode the generated text
                generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
                
                # Remove the original prompt from the generated text
                if generated_text.startswith(prompt):
                    generated_text = generated_text[len(prompt):].strip()
                
                predictions.append({
                    'sample_id': i,
                    'prompt': prompt,
                    'generated': generated_text,
                    'expected': sample.get('expected', {}),
                })
                
            logger.info(f"[PredictionsGenerator] Generated {len(predictions)} predictions")
            return predictions
            
        except Exception as e:
            logger.warning(f"[PredictionsGenerator] Failed to generate predictions: {e}")
            return []

# Predictions writer module
class PredictionsWriter:
    """Write predictions to database and storage"""

    def save_predictions(self, predictions, job_id, user_id, epoch, step):
        """Save predictions to Supabase training_predictions table"""
        try:
            logger.info(f"[PredictionsWriter] Saving {len(predictions)} predictions for job {job_id}")

            # Log predictions for debugging
            for pred in predictions:
                prompt_preview = pred['prompt'][:50] if len(pred['prompt']) > 50 else pred['prompt']
                gen_preview = pred['generated'][:50] if len(pred['generated']) > 50 else pred['generated']
                logger.info(f"[Prediction] Sample {pred['sample_id']}: {prompt_preview}... -> {gen_preview}...")

            # Check if we're in cloud mode with Supabase available
            if not IS_CLOUD:
                logger.warning("[PredictionsWriter] Not in cloud mode, skipping database persistence")
                return True

            # Prepare records for batch insert
            records = []
            for pred in predictions:
                # Extract ground_truth from expected data
                expected = pred.get('expected', {})
                ground_truth = None
                if isinstance(expected, dict):
                    # Try different possible keys for ground truth
                    if 'messages' in expected and len(expected['messages']) > 1:
                        ground_truth = expected['messages'][-1].get('content', '')
                    elif 'completion' in expected:
                        ground_truth = expected['completion']
                    elif 'output' in expected:
                        ground_truth = expected['output']
                    elif 'response' in expected:
                        ground_truth = expected['response']

                records.append({
                    'job_id': job_id,
                    'user_id': user_id,
                    'epoch': epoch,
                    'step': step,
                    'sample_index': pred['sample_id'],
                    'prompt': pred['prompt'],
                    'prediction': pred['generated'],
                    'ground_truth': ground_truth
                })

            # Insert into Supabase
            result = supabase.table('training_predictions').insert(records).execute()

            if hasattr(result, 'data') and result.data:
                logger.info(f"[PredictionsWriter] Successfully persisted {len(result.data)} predictions to database")
                return True
            else:
                logger.warning(f"[PredictionsWriter] Insert returned no data: {result}")
                return False

        except Exception as e:
            logger.error(f"[PredictionsWriter] Failed to save predictions: {e}")
            import traceback
            logger.error(f"[PredictionsWriter] Traceback: {traceback.format_exc()}")
            return False


# Predictions callback
class TrainingPredictionsCallback(TrainerCallback):
    """Callback to generate and save predictions during training"""

    def __init__(self, dataset_path, job_id, user_id, config):
        """Initialize predictions callback"""
        self.dataset_path = dataset_path
        self.job_id = job_id
        self.user_id = user_id
        self.config = config

        self.enabled = config.get('enabled', False)
        if not self.enabled:
            logger.info('[PredictionsCallback] Disabled - skipping')
            return

        self.sample_count = config.get('sample_count', 5)
        self.frequency = config.get('sample_frequency', 'epoch')
        self.step_interval = config.get('step_interval', 10)

        self.samples = None
        self.sampler = None
        self.generator = None
        self.writer = None
        self.model = None
        self.tokenizer = None

        logger.info(f'[PredictionsCallback] Initialized: {self.sample_count} samples, frequency={self.frequency}')

    def on_train_begin(self, args, state, control, **kwargs):
        """Load samples when training begins"""
        if not self.enabled:
            return

        try:
            # Store model and tokenizer references
            self.model = kwargs.get('model')
            self.tokenizer = kwargs.get('processing_class') or kwargs.get('tokenizer')

            logger.info(f'[PredictionsCallback] on_train_begin - model: {bool(self.model)}, tokenizer: {bool(self.tokenizer)}')

            # Initialize prediction modules
            self.sampler = PredictionsSampler(random_seed=42)
            samples = self.sampler.load_samples(self.dataset_path, self.sample_count)

            if not samples:
                logger.warning('[PredictionsCallback] No samples loaded')
                self.enabled = False
                return

            self.samples = samples
            self.generator = PredictionsGenerator()
            self.writer = PredictionsWriter()

            logger.info(f'[PredictionsCallback] Loaded {len(samples)} samples')

        except Exception as e:
            logger.error(f'[PredictionsCallback] Init failed: {e}')
            self.enabled = False

    def on_epoch_end(self, args, state, control, **kwargs):
        """Generate predictions at end of each epoch"""
        if not self.enabled or self.frequency != 'epoch':
            return
        self._generate_predictions(state, **kwargs)

    def on_evaluate(self, args, state, control, **kwargs):
        """Generate predictions during evaluation steps"""
        if not self.enabled or self.frequency != 'eval':
            return
        self._generate_predictions(state, **kwargs)

    def on_step_end(self, args, state, control, **kwargs):
        """Generate predictions at step intervals"""
        if not self.enabled or self.frequency != 'steps':
            return

        current_step = state.global_step
        if current_step % self.step_interval == 0:
            self._generate_predictions(state, **kwargs)

    def _generate_predictions(self, state, **kwargs):
        """Generate and save predictions"""
        if not self.samples or not self.generator or not self.writer:
            return

        try:
            # Get model/tokenizer from kwargs or stored references
            model = kwargs.get('model') or self.model
            tokenizer = kwargs.get('processing_class') or kwargs.get('tokenizer') or self.tokenizer

            if not model or not tokenizer:
                logger.warning('[PredictionsCallback] Model/tokenizer missing')
                return

            current_epoch = int(state.epoch) if state.epoch else 0
            current_step = state.global_step

            logger.info(f'[PredictionsCallback] Generating {len(self.samples)} predictions at epoch {current_epoch}, step {current_step}')

            # Generate predictions
            predictions = self.generator.generate_predictions(model, tokenizer, self.samples)

            if predictions:
                # Save predictions
                self.writer.save_predictions(predictions, self.job_id, self.user_id, current_epoch, current_step)
                logger.info(f'[PredictionsCallback] Successfully generated and saved {len(predictions)} predictions')
            else:
                logger.warning('[PredictionsCallback] No predictions generated')

        except Exception as e:
            logger.error(f'[PredictionsCallback] Failed to generate predictions: {e}')
            import traceback
            logger.error(f'[PredictionsCallback] Traceback: {traceback.format_exc()}')


def detect_architecture_params(model_name):
    """Auto-detect model architecture and return appropriate LoRA target modules."""
    try:
        config = AutoConfig.from_pretrained(model_name, trust_remote_code=True)
        model_type = getattr(config, 'model_type', '').lower()
        architectures = getattr(config, 'architectures', [])
        arch_name = architectures[0].lower() if architectures else ''

        logger.info(f"[Architecture] Detected: {model_type} / {architectures}")

        if 'llama' in model_type or 'llama' in arch_name:
            return ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']
        elif 'qwen' in model_type or 'qwen' in arch_name:
            return ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']
        elif 'mistral' in model_type or 'mistral' in arch_name:
            return ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']
        elif 'gpt2' in model_type or 'gpt' in arch_name:
            return ['c_attn', 'c_proj']
        elif 'bert' in model_type or 'bert' in arch_name:
            return ['query', 'key', 'value']
        elif 't5' in model_type or 't5' in arch_name:
            return ['q', 'k', 'v', 'o', 'wi', 'wo']
        elif 'phi' in model_type or 'phi' in arch_name:
            return ['q_proj', 'k_proj', 'v_proj', 'dense', 'fc1', 'fc2']
        elif 'gemma' in model_type or 'gemma' in arch_name:
            return ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']
        else:
            logger.warning(f"[Architecture] Unknown: {model_type}, using LLaMA-style defaults")
            return ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']
    except Exception as e:
        logger.warning(f"[Architecture] Detection failed: {e}, using defaults")
        return ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']


def create_preference_dataset(dataset, split_name="train"):
    """Convert dataset to preference format for DPO/ORPO (prompt, chosen, rejected)."""
    logger.info(f"[{split_name.upper()}] Creating preference dataset")

    preference_examples = []
    for example in dataset:
        # Dataset should already have prompt, chosen, rejected fields
        if 'prompt' in example and 'chosen' in example and 'rejected' in example:
            preference_examples.append({
                'prompt': example['prompt'],
                'chosen': example['chosen'],
                'rejected': example['rejected']
            })
        else:
            logger.warning(f"[{split_name.upper()}] Example missing required fields: {list(example.keys())}")

    logger.info(f"[{split_name.upper()}] Created {len(preference_examples)} preference examples")
    return Dataset.from_list(preference_examples)


# Cloud training configuration from environment
JOB_ID = os.getenv('JOB_ID')
JOB_TOKEN = os.getenv('JOB_TOKEN')
USER_ID = os.getenv('USER_ID')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
ALERT_API_URL = os.getenv('ALERT_API_URL')
INTERNAL_API_KEY = os.getenv('INTERNAL_API_KEY', '')
IS_CLOUD = bool(JOB_ID and JOB_TOKEN and SUPABASE_URL and (SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY))

# Alert trigger function for job status notifications
def trigger_alert(alert_type, model_name=None, error_message=None, loss=None, current_step=None, total_steps=None):
    """Send alert to the API when job status changes."""
    if not ALERT_API_URL or not JOB_ID or not USER_ID:
        logger.debug(f"[Alert] Skipping alert - missing config: API={bool(ALERT_API_URL)}, JOB={bool(JOB_ID)}, USER={bool(USER_ID)}")
        return

    try:
        import requests

        payload = {
            'type': alert_type,
            'job_id': JOB_ID,
            'user_id': USER_ID,
            'model_name': model_name or os.getenv('MODEL_NAME'),
            'status': alert_type.replace('job_', ''),
            'error_message': error_message,
            'loss': loss,
            'current_step': current_step,
            'total_steps': total_steps,
            'progress': (current_step / total_steps * 100) if current_step and total_steps else None,
        }

        headers = {'Content-Type': 'application/json'}
        if INTERNAL_API_KEY:
            headers['X-API-Key'] = INTERNAL_API_KEY

        response = requests.post(ALERT_API_URL, json=payload, headers=headers, timeout=10)

        if response.status_code == 200:
            logger.info(f"[Alert] Sent {alert_type} alert successfully")
        else:
            logger.warning(f"[Alert] Alert failed: {response.status_code} - {response.text[:200]}")
    except Exception as e:
        logger.warning(f"[Alert] Failed to send alert: {e}")

if IS_CLOUD:
    logger.info(f"[Cloud Mode] Job ID: {JOB_ID}")
    logger.info(f"[Cloud Mode] User ID: {USER_ID}")
    logger.info(f"[Cloud Mode] Supabase URL: {SUPABASE_URL}")
    logger.info(f"[Cloud Mode] Alert API: {ALERT_API_URL or 'Not configured'}")

    # Initialize Supabase client for direct metrics updates
    try:
        from supabase import create_client, Client
        # Use service role key to bypass RLS if available, otherwise use anon key
        supabase_key = SUPABASE_SERVICE_KEY if SUPABASE_SERVICE_KEY else SUPABASE_ANON_KEY
        supabase: Client = create_client(SUPABASE_URL, supabase_key)
        auth_type = "service role (bypasses RLS)" if SUPABASE_SERVICE_KEY else "anon key (subject to RLS)"
        logger.info(f"[Cloud Mode] Supabase client initialized with {auth_type}")
    except ImportError:
        logger.error("[Cloud Mode] supabase-py not installed, metrics disabled")
        IS_CLOUD = False
else:
    logger.warning("[Local Mode] No cloud credentials detected")

# ============================================================================
# EMBEDDED CHECKPOINT SCORER MODULE
# ============================================================================
# Multi-metric checkpoint scoring for best model selection
# Based on: lib/training/checkpoint_scorer.py
# Algorithm: 50% eval_loss + 30% gap_penalty + 10% perplexity + 10% improvement
import math

def calculate_checkpoint_score(checkpoint_data: Dict) -> float:
    """
    Calculate multi-metric score for checkpoint selection.
    Returns score where LOWER is better (consistent with loss metrics).

    Algorithm Components:
    1. Eval Loss (50% weight) - Primary performance metric
    2. Overfitting Penalty (30% weight) - Train/eval gap (relative)
    3. Perplexity Penalty (10% weight) - Model confidence signal
    4. Improvement Bonus (10% weight) - Trajectory indicator

    Args:
        checkpoint_data: Dict containing:
            - eval_loss (float, required): Validation loss
            - train_loss (float, optional): Training loss
            - epochs_without_improvement (int, optional): Binary improvement indicator

    Returns:
        float: Checkpoint score (lower = better), or inf if invalid
    """
    eval_loss = checkpoint_data.get('eval_loss')
    train_loss = checkpoint_data.get('train_loss')

    # Cannot score without eval_loss (primary metric)
    if eval_loss is None:
        logger.warning("[CheckpointScorer] Cannot score checkpoint without eval_loss")
        return float('inf')

    # 1. BASE SCORE: Eval Loss (50% weight)
    eval_loss_score = eval_loss * 0.5

    # 2. OVERFITTING PENALTY: Loss Gap (30% weight)
    if train_loss is not None:
        loss_gap = abs(train_loss - eval_loss)
        # Normalize gap by eval_loss to make it relative (scale-independent)
        relative_gap = loss_gap / max(eval_loss, 0.001)  # Avoid division by zero
        gap_penalty = relative_gap * 0.3
        logger.debug(
            f"[CheckpointScorer] Gap penalty: "
            f"train_loss={train_loss:.6f}, eval_loss={eval_loss:.6f}, "
            f"gap={loss_gap:.6f}, relative_gap={relative_gap:.6f}, "
            f"penalty={gap_penalty:.6f}"
        )
    else:
        gap_penalty = 0.0
        logger.debug("[CheckpointScorer] No train_loss available, gap_penalty=0.0")

    # 3. PERPLEXITY PENALTY: Model Confidence (10% weight)
    perplexity = math.exp(eval_loss)
    # Normalize to typical LLM range (1-20), cap at 1.0
    perplexity_normalized = min(perplexity / 20.0, 1.0)
    perplexity_penalty = perplexity_normalized * 0.1
    logger.debug(
        f"[CheckpointScorer] Perplexity penalty: "
        f"perplexity={perplexity:.6f}, normalized={perplexity_normalized:.6f}, "
        f"penalty={perplexity_penalty:.6f}"
    )

    # 4. IMPROVEMENT BONUS: Recent Trajectory (10% weight)
    epochs_without_improvement = checkpoint_data.get('epochs_without_improvement', 1)
    if epochs_without_improvement == 0:
        improvement_bonus = -0.1  # Bonus (negative = lower score)
        logger.debug("[CheckpointScorer] Recent improvement detected, bonus=-0.1")
    else:
        improvement_bonus = 0.0
        logger.debug("[CheckpointScorer] No recent improvement, bonus=0.0")

    # TOTAL SCORE (lower = better)
    total_score = eval_loss_score + gap_penalty + perplexity_penalty + improvement_bonus
    logger.info(
        f"[CheckpointScorer] Checkpoint score: {total_score:.6f} "
        f"(eval={eval_loss_score:.6f} + gap={gap_penalty:.6f} + "
        f"perp={perplexity_penalty:.6f} + bonus={improvement_bonus:.6f})"
    )

    return total_score

# End of embedded checkpoint scorer module

class TrainingMetricsCallback(TrainerCallback):
    """Callback to POST training metrics to API during training."""

    def __init__(self, total_samples=None):
        self.start_time = time.time()
        self.last_log_time = time.time()
        self.total_steps = 0
        self.total_epochs = 0
        self.current_epoch = 0
        self.total_samples = total_samples or 0

        # Multi-metric checkpoint tracking
        self.best_eval_loss = float('inf')
        self.best_epoch = 0
        self.best_step = 0
        self.previous_eval_loss = None
        self.epochs_without_improvement = 1

        # Loss trend tracking (deque for last 10 losses)
        from collections import deque
        self.recent_losses = deque(maxlen=10)

        logger.info("[MetricsCallback] Initialized with multi-metric checkpoint scoring")

    def on_train_begin(self, args, state, control, **kwargs):
        """Calculate total steps and epochs at training start."""
        self.total_steps = state.max_steps
        self.total_epochs = args.num_train_epochs
        logger.info(f"[Metrics] Training started - {self.total_steps} total steps, {self.total_epochs} total epochs")

        # Update job status to 'running'
        if IS_CLOUD:
            try:
                supabase.table('local_training_jobs').update({
                    'status': 'running',
                    'total_steps': self.total_steps,
                    'total_epochs': self.total_epochs,
                    'total_samples': self.total_samples,
                    'started_at': time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime()),
                }).eq('id', JOB_ID).eq('job_token', JOB_TOKEN).execute()
                logger.info("[Metrics] Job status updated to 'running'")
                # Send job_started alert
                trigger_alert('job_started', total_steps=self.total_steps)
            except Exception as e:
                logger.warning(f"[Metrics] Failed to update status: {e}")

    def on_log(self, args, state, control, logs=None, **kwargs):
        """Called when trainer logs metrics."""
        if not IS_CLOUD or not logs:
            return

        # Track recent losses for trend analysis and gap penalty
        train_loss = logs.get('loss') or logs.get('train_loss')
        if train_loss is not None:
            self.recent_losses.append(train_loss)
            logger.debug(f"[MetricsCallback] Tracked loss: {train_loss:.6f} (recent: {len(self.recent_losses)})")

        try:
            current_step = state.global_step
            elapsed = time.time() - self.start_time

            # Calculate progress
            progress = (current_step / self.total_steps * 100) if self.total_steps > 0 else 0

            # Estimate remaining time
            steps_remaining = self.total_steps - current_step
            time_per_step = elapsed / current_step if current_step > 0 else 0
            remaining = steps_remaining * time_per_step

            # Extract metrics from logs
            metrics_payload = {
                "step": current_step,
                "epoch": int(logs.get("epoch", self.current_epoch) or 0),  # Convert float epoch to int
                "loss": logs.get("loss"),
                "eval_loss": logs.get("eval_loss"),
                "learning_rate": logs.get("learning_rate"),
                "grad_norm": logs.get("grad_norm"),
                "samples_per_second": logs.get("samples_per_second"),
                "elapsed_seconds": int(elapsed),
                "remaining_seconds": int(remaining),
                "progress": round(progress, 2),
            }

            # Add GPU metrics if available
            if torch.cuda.is_available():
                metrics_payload["gpu_memory_allocated_gb"] = round(torch.cuda.memory_allocated() / 1e9, 2)
                metrics_payload["gpu_memory_reserved_gb"] = round(torch.cuda.memory_reserved() / 1e9, 2)

            # POST to API
            self._post_metrics(metrics_payload)

        except Exception as e:
            logger.warning(f"[Metrics] Failed to post metrics: {e}")

    def on_epoch_end(self, args, state, control, **kwargs):
        """Track epoch completion."""
        self.current_epoch = state.epoch

    def _post_metrics(self, payload: Dict[str, Any]):
        """Update metrics directly in Supabase."""
        try:
            # Update job in Supabase
            response = supabase.table('local_training_jobs').update({
                'current_step': payload.get('step'),
                'current_epoch': payload.get('epoch'),
                'loss': payload.get('loss'),
                'eval_loss': payload.get('eval_loss'),
                'learning_rate': payload.get('learning_rate'),
                'grad_norm': payload.get('grad_norm'),
                'samples_per_second': payload.get('samples_per_second'),
                'gpu_memory_allocated_gb': payload.get('gpu_memory_allocated_gb'),
                'gpu_memory_reserved_gb': payload.get('gpu_memory_reserved_gb'),
                'elapsed_seconds': payload.get('elapsed_seconds'),
                'remaining_seconds': payload.get('remaining_seconds'),
                'progress': payload.get('progress'),
                'updated_at': time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime()),
            }).eq('id', JOB_ID).eq('job_token', JOB_TOKEN).execute()

            if response.data:
                logger.info(f"[Metrics] Updated step {payload['step']} - Loss: {payload.get('loss', 'N/A')}")
                
                # Also insert into local_training_metrics for real-time chart updates
                try:
                    train_loss = payload.get('loss')
                    eval_loss = payload.get('eval_loss')
                    
                    # Calculate perplexity from loss (perplexity = exp(loss))
                    train_perplexity = None
                    perplexity = None
                    if train_loss is not None:
                        import math
                        train_perplexity = math.exp(train_loss) if train_loss < 100 else None  # Avoid overflow
                    if eval_loss is not None:
                        import math
                        perplexity = math.exp(eval_loss) if eval_loss < 100 else None
                    
                    metrics_insert = {
                        'job_id': JOB_ID,
                        'step': payload.get('step'),
                        'epoch': payload.get('epoch', 0),  # Default to 0 if None (required NOT NULL field)
                        'train_loss': train_loss,
                        'eval_loss': eval_loss,
                        'perplexity': perplexity,
                        'train_perplexity': train_perplexity,
                        'learning_rate': payload.get('learning_rate'),
                        'grad_norm': payload.get('grad_norm'),
                        'samples_per_second': payload.get('samples_per_second'),
                        'gpu_memory_allocated_gb': payload.get('gpu_memory_allocated_gb'),
                        'gpu_memory_reserved_gb': payload.get('gpu_memory_reserved_gb'),
                        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime()),
                    }
                    
                    # Remove None values to let database use defaults
                    metrics_insert = {k: v for k, v in metrics_insert.items() if v is not None}
                    
                    metrics_response = supabase.table('local_training_metrics').insert(metrics_insert).execute()
                    
                    if metrics_response.data:
                        logger.debug(f"[Metrics] Inserted metrics for step {payload['step']}")
                    else:
                        logger.warning(f"[Metrics] Insert to local_training_metrics returned no data")
                        
                except Exception as metrics_err:
                    logger.warning(f"[Metrics] Failed to insert metrics: {metrics_err}")
            else:
                logger.warning(f"[Metrics] Update returned no data")

        except Exception as e:
            logger.warning(f"[Metrics] Update failed: {e}")

    def on_evaluate(self, args, state, control, metrics=None, **kwargs):
        """Called after evaluation - capture eval metrics separately."""
        if not IS_CLOUD or not metrics:
            return
            
        try:
            current_step = state.global_step
            current_epoch = int(state.epoch) if state.epoch is not None else 0
            
            logger.info(f"[Evaluation] Step {current_step}, Epoch {current_epoch} - Eval metrics: {metrics}")
            
            # Extract evaluation metrics
            eval_metrics = {}
            if 'eval_loss' in metrics:
                eval_metrics['eval_loss'] = metrics['eval_loss']
                logger.info(f"[Evaluation] Eval loss: {metrics['eval_loss']}")
            
            # Calculate eval perplexity if eval_loss is available
            if 'eval_loss' in metrics and metrics['eval_loss'] is not None:
                import math
                eval_perplexity = math.exp(metrics['eval_loss']) if metrics['eval_loss'] < 100 else None
                if eval_perplexity:
                    eval_metrics['perplexity'] = eval_perplexity
                    logger.info(f"[Evaluation] Eval perplexity: {eval_perplexity}")
            
            # Insert evaluation metrics into database if we have them
            if eval_metrics and IS_CLOUD:
                try:
                    metrics_insert = {
                        'job_id': JOB_ID,
                        'step': current_step,
                        'epoch': current_epoch,
                        'eval_loss': eval_metrics.get('eval_loss'),
                        'perplexity': eval_metrics.get('perplexity'),
                        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime()),
                    }
                    
                    # Remove None values
                    metrics_insert = {k: v for k, v in metrics_insert.items() if v is not None}
                    
                    if len(metrics_insert) > 3:  # More than just job_id, step, epoch
                        metrics_response = supabase.table('local_training_metrics').insert(metrics_insert).execute()
                        if metrics_response.data:
                            logger.info(f"[Evaluation] Inserted eval metrics for step {current_step}")
                        else:
                            logger.warning(f"[Evaluation] Failed to insert eval metrics")
                            
                except Exception as eval_err:
                    logger.warning(f"[Evaluation] Failed to insert eval metrics: {eval_err}")

            # Multi-metric checkpoint scoring
            eval_loss = metrics.get('eval_loss')
            if eval_loss is not None:
                # Get train_loss from recent losses for gap penalty
                train_loss_for_scoring = None
                if len(self.recent_losses) > 0:
                    train_loss_for_scoring = self.recent_losses[-1]
                    logger.debug(
                        f"[CheckpointScorer] Using recent train_loss={train_loss_for_scoring:.6f} "
                        f"from deque (size={len(self.recent_losses)})"
                    )

                # Calculate multi-metric score
                checkpoint_data = {
                    'eval_loss': eval_loss,
                    'train_loss': train_loss_for_scoring,
                    'epochs_without_improvement': self.epochs_without_improvement
                }
                current_score = calculate_checkpoint_score(checkpoint_data)

                # Calculate score for previous best (for comparison)
                if self.best_eval_loss != float('inf'):
                    previous_best_data = {
                        'eval_loss': self.best_eval_loss,
                        'train_loss': None,
                        'epochs_without_improvement': 1
                    }
                    previous_best_score = calculate_checkpoint_score(previous_best_data)
                else:
                    previous_best_score = float('inf')

                # Update best model if current score is better (lower)
                if current_score < previous_best_score:
                    logger.info(
                        f"[CheckpointScorer] NEW BEST CHECKPOINT! "
                        f"Score: {current_score:.6f} (previous: {previous_best_score:.6f}) "
                        f"Eval Loss: {eval_loss:.6f} at Epoch {current_epoch}, Step {current_step}"
                    )
                    self.best_eval_loss = eval_loss
                    self.best_epoch = current_epoch
                    self.best_step = current_step

                    # Update job with best checkpoint info
                    if IS_CLOUD:
                        try:
                            supabase.table('local_training_jobs').update({
                                'best_checkpoint_score': current_score,
                                'best_checkpoint_step': current_step,
                                'best_checkpoint_epoch': current_epoch,
                                'best_eval_loss': eval_loss,
                            }).eq('id', JOB_ID).eq('job_token', JOB_TOKEN).execute()
                            logger.info(f"[CheckpointScorer] Updated job with best checkpoint info")
                        except Exception as e:
                            logger.warning(f"[CheckpointScorer] Failed to update job: {e}")
                else:
                    logger.debug(
                        f"[CheckpointScorer] Current score ({current_score:.6f}) "
                        f"not better than best ({previous_best_score:.6f})"
                    )

                # Track if current eval improved vs previous eval (not all-time best)
                if self.previous_eval_loss is not None:
                    if eval_loss < self.previous_eval_loss:
                        self.epochs_without_improvement = 0
                        logger.debug("[CheckpointScorer] Eval improved vs previous")
                    else:
                        self.epochs_without_improvement += 1
                        logger.debug(
                            f"[CheckpointScorer] No improvement "
                            f"({self.epochs_without_improvement} epochs)"
                        )
                self.previous_eval_loss = eval_loss

        except Exception as e:
            logger.warning(f"[Evaluation] Failed to process eval metrics: {e}")

# Extract config with backward compatibility
training_method = "${training?.method || 'sft'}"  # sft, dpo, orpo, rlhf
logger.info(f"[Training] Method: {training_method}")

lora_config_dict = ${JSON.stringify(training?.lora_config || {}).replace(/true/g, 'True').replace(/false/g, 'False')}
quant_config_dict = ${JSON.stringify(training?.quantization || {}).replace(/true/g, 'True').replace(/false/g, 'False')}

# Auto-detect architecture-specific target modules
detected_modules = detect_architecture_params("${modelName}")

# LoRA parameters (new config takes precedence)
lora_r = lora_config_dict.get('r') or ${training?.lora_r || 16}
lora_alpha = lora_config_dict.get('lora_alpha') or ${training?.lora_alpha || 32}
lora_dropout = lora_config_dict.get('lora_dropout') or ${training?.lora_dropout || 0.1}
target_modules = lora_config_dict.get('target_modules') or detected_modules
lora_bias = lora_config_dict.get('bias') or "none"
task_type = lora_config_dict.get('task_type') or "CAUSAL_LM"

# Quantization parameters
load_in_4bit = quant_config_dict.get('load_in_4bit', True)
load_in_8bit = quant_config_dict.get('load_in_8bit', False)
quant_type = quant_config_dict.get('bnb_4bit_quant_type', 'nf4')
compute_dtype = quant_config_dict.get('bnb_4bit_compute_dtype', 'bfloat16')
use_double_quant = quant_config_dict.get('bnb_4bit_use_double_quant', True)

# Model dtype configuration
model_config_dict = ${JSON.stringify(trainingConfig?.model || {}).replace(/true/g, 'True').replace(/false/g, 'False')}
torch_dtype = model_config_dict.get('torch_dtype', 'bfloat16')
trust_remote_code = model_config_dict.get('trust_remote_code', True)

# Training arguments
optimizer = "${training?.optim || 'paged_adamw_32bit'}"
gradient_checkpointing = ${(training?.gradient_checkpointing ?? true) ? 'True' : 'False'}
bf16 = ${(training?.bf16 ?? true) ? 'True' : 'False'}
fp16 = ${(training?.fp16 ?? false) ? 'True' : 'False'}

# Quantization configuration
print("Configuring quantization...")
bnb_config = BitsAndBytesConfig(
    load_in_4bit=load_in_4bit,
    load_in_8bit=load_in_8bit,
    bnb_4bit_quant_type=quant_type,
    bnb_4bit_compute_dtype=getattr(torch, compute_dtype),
    bnb_4bit_use_double_quant=use_double_quant
)

# Authenticate with HuggingFace (for gated models like Llama)
HF_TOKEN = os.getenv('HF_TOKEN')
if HF_TOKEN:
    from huggingface_hub import login
    print("[Auth] Logging in to HuggingFace...")
    login(token=HF_TOKEN)
    print("[Auth] ✓ Authenticated with HuggingFace")
else:
    print("[Auth] No HF_TOKEN provided - gated models will not be accessible")

# Load model and tokenizer
model_name = "${modelName}"
print(f"Loading model: {model_name}")
print(f"Model dtype: {torch_dtype}")
print(f"Trust remote code: {trust_remote_code}")

tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=trust_remote_code)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=bnb_config,
    torch_dtype=getattr(torch, torch_dtype),
    device_map="auto",
    trust_remote_code=trust_remote_code
)

# Load dataset
dataset = load_dataset("json", data_files="/workspace/dataset.jsonl")
full_dataset = dataset['train']
print(f"Total dataset size: {len(full_dataset)} examples")

# Auto-split dataset for evaluation (matching standalone_trainer.py behavior)
eval_split_ratio = ${data?.eval_split || 0.2}
split_point = int(len(full_dataset) * (1 - eval_split_ratio))

train_dataset = full_dataset.select(range(split_point))
eval_dataset = full_dataset.select(range(split_point, len(full_dataset)))

print(f"Train dataset: {len(train_dataset)} examples ({(1-eval_split_ratio)*100:.0f}%)")
print(f"Eval dataset: {len(eval_dataset)} examples ({eval_split_ratio*100:.0f}%)")

# Set eval_strategy based on configuration
eval_strategy = "${training?.evaluation_strategy || 'steps'}"

# Configure LoRA
print("Configuring LoRA...")
lora_config = LoraConfig(
    r=lora_r,
    lora_alpha=lora_alpha,
    lora_dropout=lora_dropout,
    target_modules=target_modules,
    bias=lora_bias,
    task_type=task_type
)

model = prepare_model_for_kbit_training(model)
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# Create metrics callback with dataset size
total_samples = len(full_dataset)
metrics_callback = TrainingMetricsCallback(total_samples=total_samples)

# Extract predictions configuration
predictions_config = ${JSON.stringify(trainingConfig?.predictions || {}).replace(/true/g, 'True').replace(/false/g, 'False')}
predictions_enabled = predictions_config.get('enabled', False)

# Create predictions callback if enabled
callbacks = [metrics_callback] if IS_CLOUD else []
if predictions_enabled and IS_CLOUD:
    try:
        # Import predictions modules from the correct path
        import sys
        import os
        
        # TrainingPredictionsCallback is now embedded above
        
        # Ensure required predictions parameters
        job_id = JOB_ID
        user_id = os.getenv('USER_ID', 'default')  # TODO: Pass user_id from deployment
        
        logger.info(f"[Predictions] Enabled with config: {predictions_config}")
        logger.info(f"[Predictions] Job ID: {job_id}, User ID: {user_id}")
        
        predictions_callback = TrainingPredictionsCallback(
            dataset_path="/workspace/dataset.jsonl",
            job_id=job_id,
            user_id=user_id,
            config=predictions_config
        )
        callbacks.append(predictions_callback)
        logger.info("[Predictions] Callback successfully added to training")
    except ImportError as e:
        logger.warning(f"[Predictions] Failed to import predictions callback: {e}")
        logger.warning(f"[Predictions] Current working directory: {os.getcwd()}")
        logger.warning(f"[Predictions] Python path: {sys.path}")
    except Exception as e:
        logger.warning(f"[Predictions] Failed to initialize predictions callback: {e}")
        import traceback
        logger.warning(f"[Predictions] Traceback: {traceback.format_exc()}")
else:
    if not IS_CLOUD:
        logger.info("[Predictions] Disabled in local mode")
    else:
        logger.info("[Predictions] Disabled in config")

# Training configuration based on method
print(f"Configuring training for method: {training_method}")

# Response template detection for masking
response_template = None
if hasattr(tokenizer, 'chat_template') and tokenizer.chat_template:
    template_str = str(tokenizer.chat_template)
    if "<|start_header_id|>assistant<|end_header_id|>" in template_str:
        response_template = "<|start_header_id|>assistant<|end_header_id|>\\n\\n"
    elif "<|im_start|>assistant" in template_str:
        response_template = "<|im_start|>assistant\\n"
    elif "[/INST]" in template_str:
        response_template = " [/INST] "
    elif "<start_of_turn>model" in template_str:
        response_template = "<start_of_turn>model\\n"
    elif "<|assistant|>" in template_str:
        response_template = "<|assistant|>\\n"
    elif "<|CHATBOT_TOKEN|>" in template_str:
        response_template = "<|CHATBOT_TOKEN|>"

if response_template:
    print(f"[Masking] Detected response template: {repr(response_template)}")
else:
    print("[Masking] No response template detected - training will be on FULL SEQUENCES")

if training_method == "sft":
    # SFT Training with SFTTrainer
    logger.info("[SFT] Using SFTTrainer")
    
    training_args = SFTConfig(
        output_dir="/workspace/results",
        num_train_epochs=${training?.num_epochs || 3},
        per_device_train_batch_size=${training?.batch_size || 4},
        gradient_accumulation_steps=${training?.gradient_accumulation_steps || 1},
        learning_rate=${training?.learning_rate || 2e-4},
        logging_steps=${training?.logging_steps || 10},
        warmup_ratio=${training?.warmup_ratio || 0.03},
        weight_decay=${training?.weight_decay || 0.001},
        lr_scheduler_type="${training?.lr_scheduler_type || 'constant'}",
        save_strategy=eval_strategy,
        save_steps=${training?.save_steps || 500},
        save_total_limit=${training?.save_total_limit || 3},
        eval_strategy=eval_strategy,
        eval_steps=${training?.eval_steps || 500},
        load_best_model_at_end=True if eval_strategy != 'no' else False,
        metric_for_best_model="${training?.metric_for_best_model || 'loss'}",
        bf16=bf16,
        fp16=fp16,
        optim=optimizer,
        gradient_checkpointing=gradient_checkpointing,
        max_length=${training?.max_length || 512},
        packing=${(training?.packing ?? false) ? 'True' : 'False'},
    )

    data_collator = None
    if response_template:
        print("[SFT] Using DataCollatorForCompletionOnlyLM for response masking")
        data_collator = DataCollatorForCompletionOnlyLM(
            response_template=response_template,
            tokenizer=tokenizer
        )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        processing_class=tokenizer,
        callbacks=callbacks,
        data_collator=data_collator,
    )

elif training_method in ["dpo", "orpo"]:
    # DPO/ORPO Training - requires preference dataset
    logger.info(f"[{training_method.upper()}] Using {training_method.upper()}Trainer")

    # Create preference datasets for train and eval
    train_preference_dataset = create_preference_dataset(train_dataset, "train")
    eval_preference_dataset = create_preference_dataset(eval_dataset, "eval")

    if training_method == "dpo":
        training_args = DPOConfig(
            output_dir="/workspace/results",
            num_train_epochs=${training?.num_epochs || 3},
            per_device_train_batch_size=${training?.batch_size || 4},
            gradient_accumulation_steps=${training?.gradient_accumulation_steps || 1},
            learning_rate=${training?.learning_rate || 5e-5},
            logging_steps=${training?.logging_steps || 10},
            warmup_ratio=${training?.warmup_ratio || 0.0},
            weight_decay=${training?.weight_decay || 0.0},
            lr_scheduler_type="${training?.lr_scheduler_type || 'linear'}",
            save_strategy=eval_strategy,  # Match save_strategy to eval_strategy so best checkpoints are saved
            save_steps=${training?.save_steps || 500},
            save_total_limit=${training?.save_total_limit || 3},
            eval_strategy=eval_strategy,  # Use the corrected eval_strategy
            eval_steps=${training?.eval_steps || 500},
            load_best_model_at_end=True if eval_strategy != 'no' else False,
            metric_for_best_model="${training?.metric_for_best_model || 'loss'}",
            bf16=bf16,
            fp16=fp16,
            optim=optimizer,
            gradient_checkpointing=gradient_checkpointing,
            max_length=${training?.max_length || 512},
            max_prompt_length=${training?.max_prompt_length || 256},
            beta=${training?.beta || 0.1},
        )

        trainer = DPOTrainer(
            model=model,
            args=training_args,
            train_dataset=train_preference_dataset,
            eval_dataset=eval_preference_dataset,
            processing_class=tokenizer,
            callbacks=callbacks,
        )
    else:  # orpo
        training_args = ORPOConfig(
            output_dir="/workspace/results",
            num_train_epochs=${training?.num_epochs || 3},
            per_device_train_batch_size=${training?.batch_size || 4},
            gradient_accumulation_steps=${training?.gradient_accumulation_steps || 1},
            learning_rate=${training?.learning_rate || 8e-6},
            logging_steps=${training?.logging_steps || 10},
            warmup_ratio=${training?.warmup_ratio || 0.0},
            weight_decay=${training?.weight_decay || 0.0},
            lr_scheduler_type="${training?.lr_scheduler_type || 'linear'}",
            save_strategy=eval_strategy,  # Match save_strategy to eval_strategy so best checkpoints are saved
            save_steps=${training?.save_steps || 500},
            save_total_limit=${training?.save_total_limit || 3},
            eval_strategy=eval_strategy,  # Use the corrected eval_strategy
            eval_steps=${training?.eval_steps || 500},
            load_best_model_at_end=True if eval_strategy != 'no' else False,
            metric_for_best_model="${training?.metric_for_best_model || 'loss'}",
            bf16=bf16,
            fp16=fp16,
            optim=optimizer,
            gradient_checkpointing=gradient_checkpointing,
            max_length=${training?.max_length || 512},
            max_prompt_length=${training?.max_prompt_length || 256},
            beta=${training?.beta || 0.1},
        )

        trainer = ORPOTrainer(
            model=model,
            args=training_args,
            train_dataset=train_preference_dataset,
            eval_dataset=eval_preference_dataset,
            processing_class=tokenizer,
            callbacks=callbacks,
        )

else:
    raise ValueError(f"Unsupported training method: {training_method}. Supported: sft, dpo, orpo")

# Train
logger.info(f"[{training_method.upper()}] Starting training...")
try:
    trainer.train()

    # Save model - merge LoRA adapters into base model
    save_path = "/workspace/fine_tuned_model"
    has_peft = hasattr(trainer.model, 'merge_and_unload')
    is_merged = False

    if has_peft:
        logger.info("[Training] Merging LoRA adapters with base model...")
        try:
            # Free GPU memory before merge
            import gc
            import torch
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            # Move model to CPU to avoid VRAM OOM during merge (which expands weights)
            logger.info("[Training] Moving model to CPU for merging...")
            trainer.model.to('cpu')

            # Merge LoRA adapters into base model (removes quantization)
            # CRITICAL: Use trainer.model (trained weights) not model (pre-training weights)
            merged_model = trainer.model.merge_and_unload()
            logger.info("[Training] ✅ LoRA adapters merged successfully")
            
            # Save merged full-precision model
            logger.info("[Training] Saving merged model (without quantization)...")
            merged_model.save_pretrained(save_path, safe_serialization=True)
            tokenizer.save_pretrained(save_path)
            
            is_merged = True
            
            # Clean up
            del merged_model
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                
        except Exception as merge_error:
            logger.warning(f"[Training] ⚠️  Merge failed: {merge_error}")
            logger.info("[Training] Falling back to saving PEFT model directly...")
            trainer.model.save_pretrained(save_path)
            tokenizer.save_pretrained(save_path)
            is_merged = False
    else:
        # Not a PEFT model, save directly
        logger.info("[Training] Saving model (no PEFT adapters to merge)...")
        trainer.model.save_pretrained(save_path, safe_serialization=True)
        tokenizer.save_pretrained(save_path)
        is_merged = True
    
    # Remove quantization_config from config.json if it exists
    import json
    config_path = os.path.join(save_path, "config.json")
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config = json.load(f)
        if 'quantization_config' in config:
            logger.info("[Training] Removing quantization_config from config.json")
            del config['quantization_config']
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)
    
    if is_merged:
        logger.info("[Training] ✅ Model saved successfully (merged & quantization-free)")
    else:
        logger.warning("[Training] ⚠️  Model saved as ADAPTERS ONLY (merge failed or skipped)")

    # Validate model files before upload
    logger.info("[Validation] Checking saved model files...")
    model_files = os.listdir(save_path)
    logger.info(f"[Validation] Files in save directory: {model_files}")

    # Check for model weights file
    has_safetensors = 'model.safetensors' in model_files
    has_pytorch = any(f.startswith('pytorch_model') for f in model_files)

    if has_safetensors:
        model_file = os.path.join(save_path, 'model.safetensors')
        model_size_gb = os.path.getsize(model_file) / (1024**3)
        logger.info(f"[Validation] model.safetensors size: {model_size_gb:.2f} GB")

        # Warn if model seems too small (likely LoRA adapters only, not merged)
        if model_size_gb < 2.0:
            logger.warning(f"[Validation] ⚠️  Model file is only {model_size_gb:.2f} GB - may be LoRA adapters, not full merged model!")
            logger.warning("[Validation] ⚠️  This will likely fail to load in vLLM for inference!")
    elif has_pytorch:
        logger.info("[Validation] Found pytorch_model files (bin format)")
    else:
        logger.error("[Validation] ❌ No model weights file found! Upload will fail!")

    # Upload to Hugging Face Hub (if HF_TOKEN is provided)
    HF_TOKEN = os.getenv('HF_TOKEN')
    HF_REPO_NAME = os.getenv('HF_REPO_NAME')

    if HF_TOKEN and HF_REPO_NAME:
        try:
            logger.info(f"[Training] Uploading model to Hugging Face: {HF_REPO_NAME}")
            from huggingface_hub import HfApi
            api = HfApi()
            
            # Create README.md with pipeline_tag
            readme_path = os.path.join(save_path, "README.md")
            model_name_parts = HF_REPO_NAME.split('/')
            repo_model_name = model_name_parts[-1] if len(model_name_parts) > 1 else HF_REPO_NAME
            
            # Determine model loading code based on merge status
            if is_merged:
                usage_code = f"""from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("{HF_REPO_NAME}")
tokenizer = AutoTokenizer.from_pretrained("{HF_REPO_NAME}")"""
                merge_status_note = "- LoRA merged and quantization removed for inference compatibility"
            else:
                usage_code = f"""from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

base_model = AutoModelForCausalLM.from_pretrained("{model_name}")
model = PeftModel.from_pretrained(base_model, "{HF_REPO_NAME}")
tokenizer = AutoTokenizer.from_pretrained("{HF_REPO_NAME}")"""
                merge_status_note = "- LoRA adapters ONLY (merge failed or skipped) - requires loading with base model"

            readme_content = f"""---
pipeline_tag: text-generation
language:
- en
license: apache-2.0
base_model: {model_name}
tags:
- instruction-following
- chat
- fine-tuned
library_name: transformers
---

# {repo_model_name}

Fine-tuned version of {model_name} using {training_method.upper()}.

## Usage

\`\`\`python
{usage_code}

# Generate text
messages = [
    {{"role": "user", "content": "Hello, how are you?"}}
]
inputs = tokenizer.apply_chat_template(messages, return_tensors="pt")
outputs = model.generate(inputs, max_new_tokens=100)
print(tokenizer.decode(outputs[0]))
\`\`\`

## Training Details

- Method: {training_method.upper()}
- Base Model: {model_name}
{merge_status_note}
"""
            
            logger.info("[HF Upload] Creating README.md with pipeline_tag: text-generation")
            with open(readme_path, 'w', encoding='utf-8') as f:
                f.write(readme_content)

            # Create repo if it doesn't exist (auto-create on upload)
            try:
                api.create_repo(repo_id=HF_REPO_NAME, token=HF_TOKEN, repo_type="model", exist_ok=True)
                logger.info(f"[Training] Repository created/verified: {HF_REPO_NAME}")
            except Exception as repo_err:
                logger.info(f"[Training] Repo create note: {repo_err}")

            api.upload_folder(
                folder_path=save_path,
                repo_id=HF_REPO_NAME,
                token=HF_TOKEN,
                repo_type="model"
            )
            logger.info("[Training] ✅ Model uploaded to Hugging Face Hub!")
            upload_success = True
        except Exception as e:
            logger.error(f"[Training] ❌ Failed to upload to HF Hub: {e}")
            upload_success = False
            # Still continue to mark training as complete even if upload fails
            # User can manually upload later from /workspace/fine_tuned_model
    else:
        logger.info("[Training] Skipping HF Hub upload (no HF_TOKEN or HF_REPO_NAME)")
        upload_success = None  # N/A

    # Update job status to 'completed'
    if IS_CLOUD:
        try:
            update_data = {
                'status': 'completed',
                'progress': 100.0,
                'completed_at': time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime()),
            }
            
            # Add upload status to metadata
            if upload_success is not None:
                update_data['metadata'] = {
                    'upload_success': upload_success,
                    'hf_repo': HF_REPO_NAME if upload_success else None
                }
            
            supabase.table('local_training_jobs').update(update_data).eq('id', JOB_ID).eq('job_token', JOB_TOKEN).execute()
            logger.info("[Metrics] Job status updated to 'completed'")
            # Send job_completed alert
            trigger_alert('job_completed', loss=best_eval_loss)
        except Exception as e:
            logger.warning(f"[Metrics] Failed to update completion status: {e}")

    print("Training complete! Model saved to /workspace/fine_tuned_model")

except Exception as e:
    logger.error(f"[Training] Training failed: {e}")

    # Update job status to 'failed'
    if IS_CLOUD:
        try:
            supabase.table('local_training_jobs').update({
                'status': 'failed',
                'error_message': str(e),
                'completed_at': time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime()),
            }).eq('id', JOB_ID).eq('job_token', JOB_TOKEN).execute()
            logger.info("[Metrics] Job status updated to 'failed'")
            # Send job_failed alert
            trigger_alert('job_failed', error_message=str(e))
        except Exception as status_error:
            logger.warning(f"[Metrics] Failed to update error status: {status_error}")

    raise  # Re-raise to propagate the error
EOF

# PHASE 2 FIX: Run training with error handling and early termination
echo "[$(date)] =========================================="
echo "[$(date)] Starting training with train.py..."
echo "[$(date)] =========================================="

if python train.py 2>&1 | tee training_output.log; then
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
