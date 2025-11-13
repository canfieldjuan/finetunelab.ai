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

// ============================================================================
// TYPES
// ============================================================================

interface RunPodPodResponse {
  id: string;
  name: string;
  imageName: string;
  gpuTypeId: string;
  costPerHr: number;
  uptimeSeconds?: number;
  desiredStatus: string;
  machineId?: string;
  machine?: {
    podHostId: string;
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
   */
  async createPod(
    request: RunPodDeploymentRequest,
    apiKey: string,
    trainingScript: string
  ): Promise<RunPodDeploymentResponse> {
    console.log('[RunPodService] Creating pod...');

    try {
      // Map GPU type to RunPod GPU ID
      const gpuTypeId = this.mapGPUType(request.gpu_type);
      
      const mutation = `
        mutation CreatePod($input: PodInput!) {
          podFindAndDeployOnDemand(input: $input) {
            id
            name
            imageName
            gpuTypeId
            costPerHr
            desiredStatus
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
          imageName: request.docker_image || 'nvidia/cuda:12.1.0-devel-ubuntu22.04',
          volumeInGb: request.volume_size_gb || 20,
          containerDiskInGb: 20,
          env: [
            { key: 'TRAINING_CONFIG_ID', value: request.training_config_id },
            ...(request.environment_variables 
              ? Object.entries(request.environment_variables).map(([key, value]) => ({ key, value }))
              : []
            ),
          ],
          dockerArgs: `bash -c "${trainingScript}"`,
          ports: '8080/http',
          volumeMountPath: '/workspace',
        },
      };

      const data = await this.graphql<{ podFindAndDeployOnDemand: RunPodPodResponse }>(
        mutation,
        variables,
        apiKey
      );

      const pod = data.podFindAndDeployOnDemand;

      console.log('[RunPodService] Pod created:', pod.id);

      // Calculate estimated cost
      const estimatedHours = request.budget_limit 
        ? request.budget_limit / pod.costPerHr 
        : undefined;

      return {
        deployment_id: pod.id,
        pod_id: pod.id,
        pod_url: `https://www.runpod.io/console/pods/${pod.id}`,
        status: 'creating',
        gpu_type: request.gpu_type || 'NVIDIA RTX A4000',
        gpu_count: request.gpu_count || 1,
        cost: {
          estimated_cost: request.budget_limit || 0,
          cost_per_hour: pod.costPerHr,
          estimated_hours: estimatedHours,
          currency: 'USD',
        },
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[RunPodService] Create pod failed:', error);
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
            gpuTypeId
            costPerHr
            uptimeSeconds
            machine {
              podHostId
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
      const actualCost = pod.uptimeSeconds 
        ? (pod.uptimeSeconds / 3600) * pod.costPerHr 
        : undefined;

      const deploymentStatus: RunPodDeploymentStatus = {
        deployment_id: podId,
        pod_id: podId,
        status,
        pod_url: `https://www.runpod.io/console/pods/${podId}`,
        cost: {
          actual_cost: actualCost,
          cost_per_hour: pod.costPerHr,
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
    trainingConfig: Record<string, unknown>
  ): string {
    // Create a bash script that sets up and runs training
    return `
# Install dependencies
pip install -q transformers datasets accelerate peft bitsandbytes

# Download training data
cd /workspace
mkdir -p data
wget -O data/training_data.json "${datasetPath}" || echo "Download dataset to /workspace/data/training_data.json"

# Create training script
cat > train.py << 'EOF'
import os
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, TrainingArguments, Trainer, BitsAndBytesConfig
from datasets import load_dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

# Extract config with backward compatibility
lora_config_dict = ${JSON.stringify(trainingConfig.lora_config || {})}
quant_config_dict = ${JSON.stringify(trainingConfig.quantization || {})}

# LoRA parameters (new config takes precedence)
lora_r = lora_config_dict.get('r') or ${trainingConfig.lora_r || 16}
lora_alpha = lora_config_dict.get('lora_alpha') or ${trainingConfig.lora_alpha || 32}
lora_dropout = lora_config_dict.get('lora_dropout') or ${trainingConfig.lora_dropout || 0.1}
target_modules = lora_config_dict.get('target_modules') or ${JSON.stringify(["q_proj", "k_proj", "v_proj", "o_proj"])}
lora_bias = lora_config_dict.get('bias') or "none"
task_type = lora_config_dict.get('task_type') or "CAUSAL_LM"

# Quantization parameters
load_in_4bit = quant_config_dict.get('load_in_4bit', True)
load_in_8bit = quant_config_dict.get('load_in_8bit', False)
quant_type = quant_config_dict.get('bnb_4bit_quant_type', 'nf4')
compute_dtype = quant_config_dict.get('bnb_4bit_compute_dtype', 'bfloat16')
use_double_quant = quant_config_dict.get('bnb_4bit_use_double_quant', True)

# Training arguments
optimizer = "${trainingConfig.optim || 'paged_adamw_32bit'}"
gradient_checkpointing = ${trainingConfig.gradient_checkpointing ?? true}
bf16 = ${trainingConfig.bf16 ?? true}
fp16 = ${trainingConfig.fp16 ?? false}

# Quantization configuration
print("Configuring quantization...")
bnb_config = BitsAndBytesConfig(
    load_in_4bit=load_in_4bit,
    load_in_8bit=load_in_8bit,
    bnb_4bit_quant_type=quant_type,
    bnb_4bit_compute_dtype=getattr(torch, compute_dtype),
    bnb_4bit_use_double_quant=use_double_quant
)

# Load model and tokenizer
model_name = "${modelName}"
print(f"Loading model: {model_name}")
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=bnb_config,
    device_map="auto"
)

# Load dataset
dataset = load_dataset("json", data_files="/workspace/data/training_data.json")
print(f"Dataset size: {len(dataset['train'])}")

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

# Training configuration
print("Configuring training...")
training_args = TrainingArguments(
    output_dir="/workspace/results",
    num_train_epochs=${trainingConfig.num_epochs || 3},
    per_device_train_batch_size=${trainingConfig.batch_size || 4},
    gradient_accumulation_steps=${trainingConfig.gradient_accumulation_steps || 1},
    learning_rate=${trainingConfig.learning_rate || 2e-4},
    logging_steps=10,
    save_strategy="epoch",
    bf16=bf16,
    fp16=fp16,
    optim=optimizer,
    gradient_checkpointing=gradient_checkpointing,
)

# Train
print("Starting training...")
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
)

trainer.train()

# Save model
model.save_pretrained("/workspace/fine_tuned_model")
tokenizer.save_pretrained("/workspace/fine_tuned_model")
print("Training complete! Model saved to /workspace/fine_tuned_model")
EOF

# Run training
python train.py

# Keep pod alive for result download
echo "Training complete. Download results from /workspace/fine_tuned_model"
sleep 3600
`.trim();
  }

  /**
   * Map GPU type to RunPod GPU ID
   */
  private mapGPUType(gpuType?: RunPodGPUType): string {
    const gpuMap: Record<RunPodGPUType, string> = {
      'NVIDIA RTX A4000': 'AMPERE_16',
      'NVIDIA RTX A5000': 'AMPERE_24',
      'NVIDIA RTX A6000': 'AMPERE_48',
      'NVIDIA A40': 'AMPERE_48',
      'NVIDIA A100 40GB': 'AMPERE_40',
      'NVIDIA A100 80GB': 'AMPERE_80',
      'NVIDIA H100': 'ADA_48',
    };

    return gpuMap[gpuType || 'NVIDIA RTX A4000'] || 'AMPERE_16';
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
