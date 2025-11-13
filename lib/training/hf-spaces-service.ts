/**
 * HuggingFace Spaces Deployment Service
 * Purpose: Deploy training to HuggingFace Spaces with cost tracking
 * Date: 2025-10-31
 * 
 * HuggingFace Spaces API: https://huggingface.co/docs/hub/api
 */

import type {
  HFSpacesDeploymentRequest,
  HFSpacesDeploymentResponse,
  HFSpacesDeploymentStatus,
  HFSpaceGPUTier,
  DeploymentStatus,
} from './deployment.types';

// ============================================================================
// TYPES
// ============================================================================

interface HFSpaceInfo {
  id: string;
  name: string;
  author: string;
  private: boolean;
  sdk: string;
  hardware?: {
    current: string;
    requested?: string;
  };
  runtime?: {
    stage: string;
    hardware?: string;
  };
}

interface HFSpaceLogs {
  logs: string[];
  cursor?: string;
}

// GPU tier pricing per hour (USD)
const GPU_PRICING: Record<HFSpaceGPUTier, number> = {
  'cpu-basic': 0,
  't4-small': 0.60,
  't4-medium': 1.20,
  'a10g-small': 3.15,
  'a10g-large': 4.13,
  'a100-large': 4.13,
};

// ============================================================================
// HUGGINGFACE SPACES SERVICE
// ============================================================================

export class HFSpacesService {
  private apiUrl = 'https://huggingface.co/api';
  
  /**
   * Create authentication headers for HF API
   */
  private getAuthHeaders(hfToken: string): HeadersInit {
    return {
      'Authorization': `Bearer ${hfToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a new Space for training
   */
  async createSpace(
    request: HFSpacesDeploymentRequest,
    hfToken: string,
    trainingFiles: {
      dockerfile: string;
      trainScript: string;
      requirements: string;
    }
  ): Promise<HFSpacesDeploymentResponse> {
    console.log('[HFSpacesService] Creating Space...');

    try {
      const spaceName = request.space_name || `training-${request.training_config_id.substring(0, 8)}`;
      
      // Step 1: Create Space
      const createResponse = await fetch(`${this.apiUrl}/spaces`, {
        method: 'POST',
        headers: this.getAuthHeaders(hfToken),
        body: JSON.stringify({
          name: spaceName,
          sdk: 'docker',
          private: request.visibility === 'private',
          hardware: request.gpu_tier || 't4-small',
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create Space: ${createResponse.status} - ${errorText}`);
      }

      const space: HFSpaceInfo = await createResponse.json();
      console.log('[HFSpacesService] Space created:', space.id);

      // Step 2: Upload training files
      await this.uploadFiles(space.id, trainingFiles, hfToken);

      // Step 3: Calculate costs
      const costPerHour = GPU_PRICING[request.gpu_tier || 't4-small'];
      const estimatedHours = this.estimateTrainingHours(request);
      const estimatedCost = costPerHour * estimatedHours;

      console.log('[HFSpacesService] Estimated cost:', estimatedCost, 'USD');

      return {
        deployment_id: space.id,
        space_id: space.id,
        space_url: `https://huggingface.co/spaces/${space.id}`,
        status: 'creating',
        gpu_tier: request.gpu_tier || 't4-small',
        cost: {
          estimated_cost: estimatedCost,
          cost_per_hour: costPerHour,
          budget_limit: request.budget_limit,
          currency: 'USD',
        },
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[HFSpacesService] Create Space failed:', error);
      throw error;
    }
  }

  /**
   * Get Space status and runtime info
   */
  async getSpaceStatus(
    spaceId: string,
    hfToken: string
  ): Promise<HFSpacesDeploymentStatus> {
    console.log('[HFSpacesService] Getting Space status:', spaceId);

    try {
      const response = await fetch(`${this.apiUrl}/spaces/${spaceId}`, {
        headers: this.getAuthHeaders(hfToken),
      });

      if (!response.ok) {
        throw new Error(`Failed to get Space status: ${response.status}`);
      }

      const space: HFSpaceInfo = await response.json();

      // Map HF Space status to our deployment status
      const status: DeploymentStatus = this.mapSpaceStatus(space.runtime?.stage || 'unknown');

      // Get GPU tier from runtime or hardware
      const gpuTier = (space.runtime?.hardware || space.hardware?.current || 't4-small') as HFSpaceGPUTier;
      const costPerHour = GPU_PRICING[gpuTier];

      const deploymentStatus: HFSpacesDeploymentStatus = {
        deployment_id: spaceId,
        space_id: spaceId,
        status,
        space_url: `https://huggingface.co/spaces/${spaceId}`,
        cost: {
          cost_per_hour: costPerHour,
          currency: 'USD',
          estimated_cost: 0,
        },
      };

      console.log('[HFSpacesService] Status:', status);

      return deploymentStatus;
    } catch (error) {
      console.error('[HFSpacesService] Get status failed:', error);
      throw error;
    }
  }

  /**
   * Get Space logs
   */
  async getSpaceLogs(
    spaceId: string,
    hfToken: string,
    cursor?: string
  ): Promise<{ logs: string; cursor?: string }> {
    console.log('[HFSpacesService] Getting Space logs:', spaceId);

    try {
      const url = cursor 
        ? `${this.apiUrl}/spaces/${spaceId}/logs?cursor=${cursor}`
        : `${this.apiUrl}/spaces/${spaceId}/logs`;

      const response = await fetch(url, {
        headers: this.getAuthHeaders(hfToken),
      });

      if (!response.ok) {
        throw new Error(`Failed to get logs: ${response.status}`);
      }

      const logData: HFSpaceLogs = await response.json();
      
      return {
        logs: logData.logs.join('\n'),
        cursor: logData.cursor,
      };
    } catch (error) {
      console.error('[HFSpacesService] Get logs failed:', error);
      throw error;
    }
  }

  /**
   * Stop/delete a Space
   */
  async deleteSpace(
    spaceId: string,
    hfToken: string
  ): Promise<void> {
    console.log('[HFSpacesService] Deleting Space:', spaceId);

    try {
      const response = await fetch(`${this.apiUrl}/spaces/${spaceId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(hfToken),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete Space: ${response.status}`);
      }

      console.log('[HFSpacesService] Space deleted');
    } catch (error) {
      console.error('[HFSpacesService] Delete Space failed:', error);
      throw error;
    }
  }

  /**
   * Upload training files to Space repository
   */
  private async uploadFiles(
    spaceId: string,
    files: {
      dockerfile: string;
      trainScript: string;
      requirements: string;
    },
    hfToken: string
  ): Promise<void> {
    console.log('[HFSpacesService] Uploading files to Space...');

    try {
      // Upload Dockerfile
      await this.uploadFile(spaceId, 'Dockerfile', files.dockerfile, hfToken);
      
      // Upload training script
      await this.uploadFile(spaceId, 'train.py', files.trainScript, hfToken);
      
      // Upload requirements
      await this.uploadFile(spaceId, 'requirements.txt', files.requirements, hfToken);

      console.log('[HFSpacesService] All files uploaded');
    } catch (error) {
      console.error('[HFSpacesService] Upload files failed:', error);
      throw error;
    }
  }

  /**
   * Upload a single file to Space repository
   */
  private async uploadFile(
    spaceId: string,
    filename: string,
    content: string,
    hfToken: string
  ): Promise<void> {
    const response = await fetch(`${this.apiUrl}/spaces/${spaceId}/upload/${filename}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'text/plain',
      },
      body: content,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload ${filename}: ${response.status}`);
    }
  }

  /**
   * Generate Dockerfile for training
   */
  generateDockerfile(
    modelName: string,
    pythonVersion: string = '3.10'
  ): string {
    return `
FROM python:${pythonVersion}-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    git \\
    wget \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy training script
COPY train.py .

# Run training
CMD ["python", "train.py"]
`.trim();
  }

  /**
   * Generate training script
   */
  generateTrainingScript(
    modelName: string,
    datasetPath: string,
    trainingConfig: Record<string, unknown>
  ): string {
    // Extract config with backward compatibility
    const loraConfig = trainingConfig.lora_config as Record<string, unknown> | undefined;
    const quantConfig = trainingConfig.quantization as Record<string, unknown> | undefined;
    
    // LoRA parameters (new config takes precedence over legacy)
    const loraR = loraConfig?.r || trainingConfig.lora_r || 16;
    const loraAlpha = loraConfig?.lora_alpha || trainingConfig.lora_alpha || 32;
    const loraDropout = loraConfig?.lora_dropout || trainingConfig.lora_dropout || 0.1;
    const targetModules = (loraConfig?.target_modules as string[]) || ["q_proj", "k_proj", "v_proj", "o_proj"];
    const loraBias = loraConfig?.bias || "none";
    const taskType = loraConfig?.task_type || "CAUSAL_LM";
    
    // Quantization parameters
    const loadIn4bit = quantConfig?.load_in_4bit ?? true;
    const loadIn8bit = quantConfig?.load_in_8bit ?? false;
    const quantType = quantConfig?.bnb_4bit_quant_type || "nf4";
    const computeDtype = quantConfig?.bnb_4bit_compute_dtype || "bfloat16";
    const useDoubleQuant = quantConfig?.bnb_4bit_use_double_quant ?? true;
    
    // Training arguments
    const optimizer = trainingConfig.optim || "paged_adamw_32bit";
    const gradientCheckpointing = trainingConfig.gradient_checkpointing ?? true;
    const bf16 = trainingConfig.bf16 ?? true;
    const fp16 = trainingConfig.fp16 ?? false;
    
    return `
import os
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, TrainingArguments, Trainer, BitsAndBytesConfig
from datasets import load_dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

print("Starting QLoRA training on HuggingFace Spaces...")

# Configuration
MODEL_NAME = "${modelName}"
DATASET_PATH = "${datasetPath}"

# Quantization configuration (BitsAndBytes)
print("Configuring quantization...")
bnb_config = BitsAndBytesConfig(
    load_in_4bit=${loadIn4bit ? 'True' : 'False'},
    load_in_8bit=${loadIn8bit ? 'True' : 'False'},
    bnb_4bit_quant_type="${quantType}",
    bnb_4bit_compute_dtype=torch.${computeDtype},
    bnb_4bit_use_double_quant=${useDoubleQuant ? 'True' : 'False'}
)

# Load model and tokenizer
print(f"Loading model: {MODEL_NAME}")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True
)

# Load dataset
print(f"Loading dataset: {DATASET_PATH}")
dataset = load_dataset("json", data_files=DATASET_PATH)
print(f"Dataset size: {len(dataset['train'])}")

# Configure LoRA
print("Configuring LoRA...")
lora_config = LoraConfig(
    r=${loraR},
    lora_alpha=${loraAlpha},
    lora_dropout=${loraDropout},
    target_modules=${JSON.stringify(targetModules)},
    bias="${loraBias}",
    task_type="${taskType}"
)

model = prepare_model_for_kbit_training(model)
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# Training configuration
print("Configuring training...")
training_args = TrainingArguments(
    output_dir="/app/results",
    num_train_epochs=${trainingConfig.num_epochs || 3},
    per_device_train_batch_size=${trainingConfig.batch_size || 4},
    gradient_accumulation_steps=${trainingConfig.gradient_accumulation_steps || 1},
    learning_rate=${trainingConfig.learning_rate || 2e-4},
    logging_steps=10,
    save_strategy="epoch",
    bf16=${bf16 ? 'True' : 'False'},
    fp16=${fp16 ? 'True' : 'False'},
    optim="${optimizer}",
    gradient_checkpointing=${gradientCheckpointing ? 'True' : 'False'},
    report_to="none",
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
print("Saving fine-tuned model...")
model.save_pretrained("/app/fine_tuned_model")
tokenizer.save_pretrained("/app/fine_tuned_model")

print("Training complete!")
`.trim();
  }

  /**
   * Generate requirements.txt
   */
  generateRequirements(): string {
    return `
transformers>=4.35.0
datasets>=2.14.0
accelerate>=0.24.0
peft>=0.7.0
bitsandbytes>=0.41.0
torch>=2.1.0
`.trim();
  }

  /**
   * Estimate training hours based on config
   */
  private estimateTrainingHours(request: HFSpacesDeploymentRequest): number {
    // Simple estimation: 1-3 hours for typical LoRA fine-tuning
    // This should be replaced with more sophisticated estimation
    const baseHours = 1.5;
    
    // Adjust based on GPU tier
    const gpuMultiplier: Record<HFSpaceGPUTier, number> = {
      'cpu-basic': 10,
      't4-small': 1.5,
      't4-medium': 1.0,
      'a10g-small': 0.7,
      'a10g-large': 0.5,
      'a100-large': 0.4,
    };

    return baseHours * gpuMultiplier[request.gpu_tier || 't4-small'];
  }

  /**
   * Calculate actual cost based on runtime
   */
  calculateActualCost(
    gpuTier: HFSpaceGPUTier,
    startTime: Date,
    endTime?: Date
  ): number {
    const end = endTime || new Date();
    const hours = (end.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const costPerHour = GPU_PRICING[gpuTier];
    
    return hours * costPerHour;
  }

  /**
   * Check if budget threshold reached
   */
  checkBudgetThreshold(
    actualCost: number,
    budgetLimit?: number,
    alertThreshold: number = 80
  ): {
    isOverBudget: boolean;
    isNearBudget: boolean;
    percentUsed: number;
  } {
    if (!budgetLimit) {
      return {
        isOverBudget: false,
        isNearBudget: false,
        percentUsed: 0,
      };
    }

    const percentUsed = (actualCost / budgetLimit) * 100;

    return {
      isOverBudget: percentUsed >= 100,
      isNearBudget: percentUsed >= alertThreshold,
      percentUsed,
    };
  }

  /**
   * Map HF Space status to deployment status
   */
  private mapSpaceStatus(spaceStage: string): DeploymentStatus {
    const statusMap: Record<string, DeploymentStatus> = {
      'NO_APP_FILE': 'failed',
      'CONFIG_ERROR': 'failed',
      'BUILD_ERROR': 'failed',
      'RUNTIME_ERROR': 'failed',
      'STOPPED': 'stopped',
      'PAUSED': 'stopped',
      'BUILDING': 'building',
      'RUNNING': 'running',
      'RUNNING_BUILDING': 'running',
    };

    return statusMap[spaceStage] || 'creating';
  }
}

// Export singleton instance
export const hfSpacesService = new HFSpacesService();
