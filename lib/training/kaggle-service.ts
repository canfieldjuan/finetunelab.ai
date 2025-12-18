/**
 * Kaggle API Service
 * Purpose: Interact with Kaggle API for notebook deployment and management
 * Date: 2025-10-31
 * 
 * Kaggle API Documentation: https://github.com/Kaggle/kaggle-api
 */

import type {
  KaggleDeploymentRequest,
  KaggleDeploymentResponse,
  KaggleDeploymentStatus,
  DeploymentStatus,
} from './deployment.types';

// ============================================================================
// TYPES
// ============================================================================

interface KaggleCredentials {
  username: string;
  key: string;
}

interface KaggleKernelPushResponse {
  ref: string; // e.g., "username/notebook-slug"
  url: string;
  versionNumber: number;
  totalBytes?: number;
}

interface KaggleKernelStatusResponse {
  ref: string;
  status: string; // 'queued' | 'running' | 'complete' | 'error' | 'cancelled'
  failureMessage?: string;
}

// ============================================================================
// KAGGLE API SERVICE
// ============================================================================

export class KaggleService {
  private baseUrl = 'https://www.kaggle.com/api/v1';
  
  /**
   * Create authentication headers for Kaggle API
   */
  private getAuthHeaders(credentials: KaggleCredentials): HeadersInit {
    const basicAuth = Buffer.from(`${credentials.username}:${credentials.key}`).toString('base64');
    
    return {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a new Kaggle notebook kernel
   */
  async createNotebook(
    request: KaggleDeploymentRequest,
    credentials: KaggleCredentials,
    notebookContent: string
  ): Promise<KaggleDeploymentResponse> {
    console.log('[KaggleService] Creating notebook:', request.notebook_title);

    try {
      // Generate slug from title if not provided
      const slug = request.notebook_slug || 
        request.notebook_title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

      // Prepare kernel metadata
      const kernelMetadata = {
        id: `${credentials.username}/${slug}`,
        title: request.notebook_title,
        code_file: 'notebook.ipynb',
        language: 'python',
        kernel_type: 'notebook',
        is_private: request.is_private ?? true,
        enable_gpu: request.enable_gpu ?? true,
        enable_internet: request.enable_internet ?? true,
        dataset_sources: request.dataset_sources || [],
        competition_sources: [],
        kernel_sources: [],
      };

      // Push kernel to Kaggle
      const response = await fetch(`${this.baseUrl}/kernels/push`, {
        method: 'POST',
        headers: this.getAuthHeaders(credentials),
        body: JSON.stringify({
          ...kernelMetadata,
          code: notebookContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Kaggle API error: ${response.status} - ${errorData}`);
      }

      const data: KaggleKernelPushResponse = await response.json();

      console.log('[KaggleService] Notebook created:', data.ref);

      return {
        deployment_id: data.ref,
        notebook_url: data.url || `https://www.kaggle.com/code/${data.ref}`,
        notebook_slug: slug,
        kernel_slug: data.ref,
        version: data.versionNumber,
        status: 'queued',
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[KaggleService] Create notebook failed:', error);
      throw error;
    }
  }

  /**
   * Get notebook execution status
   */
  async getNotebookStatus(
    kernelSlug: string,
    credentials: KaggleCredentials
  ): Promise<KaggleDeploymentStatus> {
    console.log('[KaggleService] Getting notebook status:', kernelSlug);

    try {
      const response = await fetch(`${this.baseUrl}/kernels/status?kernel=${kernelSlug}`, {
        method: 'GET',
        headers: this.getAuthHeaders(credentials),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Kaggle API error: ${response.status} - ${errorData}`);
      }

      const data: KaggleKernelStatusResponse = await response.json();

      // Map Kaggle status to our deployment status
      const status: DeploymentStatus = this.mapKaggleStatus(data.status);

      const deploymentStatus: KaggleDeploymentStatus = {
        deployment_id: kernelSlug,
        status,
        notebook_url: `https://www.kaggle.com/code/${kernelSlug}`,
        error_message: data.failureMessage,
      };

      console.log('[KaggleService] Status:', status);

      return deploymentStatus;
    } catch (error) {
      console.error('[KaggleService] Get status failed:', error);
      throw error;
    }
  }

  /**
   * Get notebook output (logs)
   */
  async getNotebookOutput(
    kernelSlug: string,
    credentials: KaggleCredentials
  ): Promise<string> {
    console.log('[KaggleService] Getting notebook output:', kernelSlug);

    try {
      const response = await fetch(`${this.baseUrl}/kernels/output?kernel=${kernelSlug}`, {
        method: 'GET',
        headers: this.getAuthHeaders(credentials),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Kaggle API error: ${response.status} - ${errorData}`);
      }

      // Kaggle returns a zip file with outputs
      // For now, return a message about downloading
      return 'Notebook output available. Download from Kaggle notebook page.';
    } catch (error) {
      console.error('[KaggleService] Get output failed:', error);
      throw error;
    }
  }

  /**
   * Stop/cancel a running notebook
   */
  async cancelNotebook(
    kernelSlug: string,
    credentials: KaggleCredentials
  ): Promise<void> {
    console.log('[KaggleService] Cancelling notebook:', kernelSlug);

    try {
      const response = await fetch(`${this.baseUrl}/kernels/cancel`, {
        method: 'POST',
        headers: this.getAuthHeaders(credentials),
        body: JSON.stringify({
          kernel: kernelSlug,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Kaggle API error: ${response.status} - ${errorData}`);
      }

      console.log('[KaggleService] Notebook cancelled');
    } catch (error) {
      console.error('[KaggleService] Cancel failed:', error);
      throw error;
    }
  }

  /**
   * Generate training notebook content
   */
  generateNotebook(
    modelName: string,
    datasetPath: string,
    trainingConfig: Record<string, unknown>
  ): string {
    // Create a Jupyter notebook with training code
    const notebook = {
      metadata: {
        kernelspec: {
          display_name: 'Python 3',
          language: 'python',
          name: 'python3',
        },
        language_info: {
          name: 'python',
          version: '3.10.12',
        },
      },
      nbformat: 4,
      nbformat_minor: 5,
      cells: [
        // Install dependencies
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: [
            '# Install required packages\n',
            '!pip install -q transformers datasets accelerate peft bitsandbytes\n',
          ],
        },
        // Import libraries
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: [
            '# Import libraries\n',
            'import os\n',
            'import torch\n',
            'from transformers import AutoTokenizer, AutoModelForCausalLM, TrainingArguments, Trainer, BitsAndBytesConfig\n',
            'from datasets import load_dataset\n',
            'from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training\n',
          ],
        },
        // Extract config with backward compatibility
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: (() => {
            const loraConfig = trainingConfig.lora_config as Record<string, unknown> | undefined;
            const quantConfig = trainingConfig.quantization as Record<string, unknown> | undefined;
            
            // LoRA parameters (new config takes precedence)
            const loraR = loraConfig?.r || trainingConfig.lora_r || 16;
            const loraAlpha = loraConfig?.lora_alpha || trainingConfig.lora_alpha || 32;
            const loraDropout = loraConfig?.lora_dropout || trainingConfig.lora_dropout || 0.1;
            const targetModules = (loraConfig?.target_modules as string[]) || ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"];
            const loraBias = loraConfig?.bias || "none";
            const taskType = loraConfig?.task_type || "CAUSAL_LM";
            
            // Quantization parameters
            const loadIn4bit = quantConfig?.load_in_4bit ?? true;
            const loadIn8bit = quantConfig?.load_in_8bit ?? false;
            const quantType = quantConfig?.bnb_4bit_quant_type || "nf4";
            const computeDtype = quantConfig?.bnb_4bit_compute_dtype || "bfloat16";
            const useDoubleQuant = quantConfig?.bnb_4bit_use_double_quant ?? true;
            
            return [
              '# Configuration parameters\n',
              `lora_r = ${loraR}\n`,
              `lora_alpha = ${loraAlpha}\n`,
              `lora_dropout = ${loraDropout}\n`,
              `target_modules = ${JSON.stringify(targetModules)}\n`,
              `lora_bias = "${loraBias}"\n`,
              `task_type = "${taskType}"\n`,
              '\n',
              `load_in_4bit = ${loadIn4bit}\n`,
              `load_in_8bit = ${loadIn8bit}\n`,
              `quant_type = "${quantType}"\n`,
              `compute_dtype = "${computeDtype}"\n`,
              `use_double_quant = ${useDoubleQuant}\n`,
              '\n',
              `optimizer = "${trainingConfig.optim || 'paged_adamw_32bit'}"\n`,
              `gradient_checkpointing = ${trainingConfig.gradient_checkpointing ?? true}\n`,
              `bf16 = ${trainingConfig.bf16 ?? true}\n`,
              `fp16 = ${trainingConfig.fp16 ?? false}\n`,
            ];
          })(),
        },
        // Load model with quantization
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: [
            '# Quantization configuration\n',
            'print("Configuring quantization...")\n',
            'bnb_config = BitsAndBytesConfig(\n',
            '    load_in_4bit=load_in_4bit,\n',
            '    load_in_8bit=load_in_8bit,\n',
            '    bnb_4bit_quant_type=quant_type,\n',
            '    bnb_4bit_compute_dtype=getattr(torch, compute_dtype),\n',
            '    bnb_4bit_use_double_quant=use_double_quant\n',
            ')\n',
            '\n',
            '# Load model and tokenizer\n',
            `model_name = "${modelName}"\n`,
            'print(f"Loading model: {model_name}")\n',
            'tokenizer = AutoTokenizer.from_pretrained(model_name)\n',
            'model = AutoModelForCausalLM.from_pretrained(\n',
            '    model_name,\n',
            '    quantization_config=bnb_config,\n',
            '    device_map="auto"\n',
            ')\n',
          ],
        },
        // Load dataset
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: [
            '# Load dataset\n',
            `dataset_path = "${datasetPath}"\n`,
            'dataset = load_dataset("json", data_files=dataset_path)\n',
            'print(f"Dataset size: {len(dataset[\'train\'])}")\n',
          ],
        },
        // Configure LoRA
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: [
            '# Configure LoRA\n',
            'print("Configuring LoRA...")\n',
            'lora_config = LoraConfig(\n',
            '    r=lora_r,\n',
            '    lora_alpha=lora_alpha,\n',
            '    lora_dropout=lora_dropout,\n',
            '    target_modules=target_modules,\n',
            '    bias=lora_bias,\n',
            '    task_type=task_type\n',
            ')\n',
            '\n',
            'model = prepare_model_for_kbit_training(model)\n',
            'model = get_peft_model(model, lora_config)\n',
            'model.print_trainable_parameters()\n',
            '\n',
            '# Disable use_cache when gradient checkpointing is enabled\n',
            'if gradient_checkpointing:\n',
            '    print("[Training] Disabling use_cache (required for gradient checkpointing)")\n',
            '    model.config.use_cache = False\n',
            '    if hasattr(model, "base_model"):\n',
            '        model.base_model.model.config.use_cache = False\n',
          ],
        },
        // Training configuration
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: [
            '# Training configuration\n',
            'print("Configuring training...")\n',
            'training_args = TrainingArguments(\n',
            '    output_dir="./results",\n',
            `    num_train_epochs=${trainingConfig.num_epochs || 3},\n`,
            `    per_device_train_batch_size=${trainingConfig.batch_size || 4},\n`,
            `    gradient_accumulation_steps=${trainingConfig.gradient_accumulation_steps || 1},\n`,
            `    learning_rate=${trainingConfig.learning_rate || 2e-4},\n`,
            '    logging_steps=10,\n',
            '    save_strategy="epoch",\n',
            '    bf16=bf16,\n',
            '    fp16=fp16,\n',
            '    optim=optimizer,\n',
            '    gradient_checkpointing=gradient_checkpointing,\n',
            ')\n',
          ],
        },
        // Train
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: [
            '# Train model\n',
            '# Ensure use_cache is disabled when gradient checkpointing is enabled\n',
            'if gradient_checkpointing:\n',
            '    print("[Training] Enforcing use_cache=False (gradient checkpointing active)")\n',
            '    model.config.use_cache = False\n',
            '    if hasattr(model, "base_model"):\n',
            '        model.base_model.model.config.use_cache = False\n',
            '\n',
            'trainer = Trainer(\n',
            '    model=model,\n',
            '    args=training_args,\n',
            '    train_dataset=dataset["train"],\n',
            ')\n',
            '\n',
            'trainer.train()\n',
            '\n',
            '# Save model\n',
            'model.save_pretrained("./fine_tuned_model")\n',
            'tokenizer.save_pretrained("./fine_tuned_model")\n',
            'print("Training complete! Model saved to ./fine_tuned_model")\n',
          ],
        },
      ],
    };

    return JSON.stringify(notebook, null, 2);
  }

  /**
   * Map Kaggle status to deployment status
   */
  private mapKaggleStatus(kaggleStatus: string): DeploymentStatus {
    const statusMap: Record<string, DeploymentStatus> = {
      'queued': 'queued',
      'running': 'training',
      'complete': 'completed',
      'error': 'failed',
      'cancelled': 'cancelled',
    };

    return statusMap[kaggleStatus] || 'queued';
  }
}

// Export singleton instance
export const kaggleService = new KaggleService();
