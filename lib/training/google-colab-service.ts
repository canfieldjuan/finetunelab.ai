/**
 * Google Colab API Service
 * Purpose: Interact with Google Drive and Colab APIs for notebook deployment
 * Date: 2025-11-12
 *
 * Authentication: Supports OAuth tokens (from login) and service account keys
 * API: Google Drive API v3 + Colab Runtime API
 */

import type {
  ColabDeploymentRequest,
  ColabDeploymentResponse,
  ColabDeploymentStatus,
  DeploymentStatus,
} from './deployment.types';

// ============================================================================
// TYPES
// ============================================================================

interface ColabCredentials {
  type: 'oauth' | 'service_account';
  token?: string;         // OAuth access token
  serviceAccount?: string; // Service account JSON
}

interface DriveFileResponse {
  id: string;
  name: string;
  webViewLink?: string;
  mimeType: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ColabRuntimeResponse {
  state: string; // 'IDLE' | 'BUSY' | 'STOPPED' | 'ERROR'
  message?: string;
}

// ============================================================================
// GOOGLE COLAB SERVICE
// ============================================================================

export class GoogleColabService {
  private driveApiUrl = 'https://www.googleapis.com/drive/v3';
  private uploadUrl = 'https://www.googleapis.com/upload/drive/v3';

  /**
   * Create authentication headers
   */
  private getAuthHeaders(credentials: ColabCredentials): HeadersInit {
    if (credentials.type === 'oauth' && credentials.token) {
      return {
        'Authorization': `Bearer ${credentials.token}`,
        'Content-Type': 'application/json',
      };
    } else if (credentials.type === 'service_account' && credentials.serviceAccount) {
      // For service account, we need to generate a JWT token
      // This is complex - for now, assume the serviceAccount string is a pre-generated token
      return {
        'Authorization': `Bearer ${credentials.serviceAccount}`,
        'Content-Type': 'application/json',
      };
    }

    throw new Error('Invalid credentials type');
  }

  /**
   * Create a new Google Colab notebook
   */
  async createNotebook(
    request: ColabDeploymentRequest,
    credentials: ColabCredentials,
    notebookContent: string
  ): Promise<ColabDeploymentResponse> {
    console.log('[GoogleColabService] Creating notebook:', request.notebook_name);

    try {
      // Prepare notebook metadata
      const metadata = {
        name: `${request.notebook_name}.ipynb`,
        mimeType: 'application/vnd.google.colaboratory',
        parents: ['root'], // Create in root directory
      };

      // Create multipart upload body
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/vnd.google.colaboratory+json\r\n\r\n' +
        notebookContent +
        closeDelimiter;

      // Upload notebook to Google Drive
      const response = await fetch(
        `${this.uploadUrl}/files?uploadType=multipart`,
        {
          method: 'POST',
          headers: {
            'Authorization': credentials.type === 'oauth'
              ? `Bearer ${credentials.token}`
              : `Bearer ${credentials.serviceAccount}`,
            'Content-Type': `multipart/related; boundary="${boundary}"`,
          },
          body: multipartRequestBody,
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Google Drive API error: ${response.status} - ${errorData}`);
      }

      const data: DriveFileResponse = await response.json();

      console.log('[GoogleColabService] Notebook created:', data.id);

      // Construct Colab URL
      const notebookUrl = `https://colab.research.google.com/drive/${data.id}`;

      return {
        deployment_id: data.id,
        notebook_id: data.id,
        notebook_url: notebookUrl,
        status: 'creating',
        gpu_tier: request.gpu_tier || 't4',
        runtime_type: request.runtime_type || 'standard',
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[GoogleColabService] Create notebook failed:', error);
      throw error;
    }
  }

  /**
   * Get notebook status
   * Note: Google Colab doesn't have a direct status API
   * We rely on the notebook metadata from Drive API
   */
  async getNotebookStatus(
    notebookId: string,
    credentials: ColabCredentials
  ): Promise<ColabDeploymentStatus> {
    console.log('[GoogleColabService] Getting notebook status:', notebookId);

    try {
      const response = await fetch(
        `${this.driveApiUrl}/files/${notebookId}?fields=id,name,webViewLink,modifiedTime`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(credentials),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Google Drive API error: ${response.status} - ${errorData}`);
      }

      const _data: DriveFileResponse = await response.json(); // eslint-disable-line @typescript-eslint/no-unused-vars

      // Since Colab doesn't expose runtime status via API,
      // we can't determine actual execution state
      // Return a generic status
      const deploymentStatus: ColabDeploymentStatus = {
        deployment_id: notebookId,
        notebook_id: notebookId,
        status: 'running', // Assume running if notebook exists
        notebook_url: `https://colab.research.google.com/drive/${notebookId}`,
      };

      console.log('[GoogleColabService] Status retrieved');

      return deploymentStatus;
    } catch (error) {
      console.error('[GoogleColabService] Get status failed:', error);
      throw error;
    }
  }

  /**
   * Get notebook logs
   * Note: Colab doesn't provide a direct API for logs
   * Users need to view logs in the notebook UI
   */
  async getNotebookLogs(
    _notebookId: string, // eslint-disable-line @typescript-eslint/no-unused-vars
    _credentials: ColabCredentials // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<string> {
    console.log('[GoogleColabService] Logs not available via API');

    return 'Logs are available in the Colab notebook UI. Open the notebook to view execution logs.';
  }

  /**
   * Stop/delete a notebook runtime
   * Note: Colab doesn't provide API to stop runtime
   * We can only delete the notebook file
   */
  async stopNotebook(
    notebookId: string,
    credentials: ColabCredentials
  ): Promise<void> {
    console.log('[GoogleColabService] Stopping notebook (deleting file):', notebookId);

    try {
      const response = await fetch(
        `${this.driveApiUrl}/files/${notebookId}`,
        {
          method: 'DELETE',
          headers: this.getAuthHeaders(credentials),
        }
      );

      if (!response.ok && response.status !== 204) {
        const errorData = await response.text();
        throw new Error(`Google Drive API error: ${response.status} - ${errorData}`);
      }

      console.log('[GoogleColabService] Notebook deleted');
    } catch (error) {
      console.error('[GoogleColabService] Stop failed:', error);
      throw error;
    }
  }

  /**
   * Generate training notebook content
   */
  generateNotebook(
    modelName: string,
    datasetPath: string,
    trainingConfig: Record<string, unknown>,
    gpuTier: string
  ): string {
    // Create a Jupyter notebook with training code
    const notebook = {
      metadata: {
        colab: {
          name: 'Model Training',
          provenance: [],
          gpuType: gpuTier === 'a100' ? 'A100' : gpuTier === 'v100' ? 'V100' : 'T4',
          private_outputs: true,
        },
        kernelspec: {
          display_name: 'Python 3',
          language: 'python',
          name: 'python3',
        },
        language_info: {
          name: 'python',
          version: '3.10.12',
        },
        accelerator: gpuTier !== 'none' ? 'GPU' : undefined,
      },
      nbformat: 4,
      nbformat_minor: 0,
      cells: [
        // GPU Check
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: [
            '# Check GPU availability\n',
            '!nvidia-smi\n',
          ],
        },
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
            'import json\n',
          ],
        },
        // Extract config
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: (() => {
            const loraConfig = trainingConfig.lora_config as Record<string, unknown> | undefined;
            const quantConfig = trainingConfig.quantization as Record<string, unknown> | undefined;

            // LoRA parameters
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
            '\n',
            '# Set pad token if not set\n',
            'if tokenizer.pad_token is None:\n',
            '    tokenizer.pad_token = tokenizer.eos_token\n',
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
            '# Note: Upload your dataset to Colab or use a public dataset\n',
            'print("Loading dataset...")\n',
            '# Example: dataset = load_dataset("json", data_files="training_data.jsonl")\n',
            'print("⚠️  Please upload your dataset and update this cell")\n',
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
            '    report_to="none",\n',
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
            '# Uncomment after loading dataset\n',
            '# \n',
            '# # Ensure use_cache is disabled when gradient checkpointing is enabled\n',
            '# if gradient_checkpointing:\n',
            '#     print("[Training] Enforcing use_cache=False (gradient checkpointing active)")\n',
            '#     model.config.use_cache = False\n',
            '# \n',
            '# trainer = Trainer(\n',
            '#     model=model,\n',
            '#     args=training_args,\n',
            '#     train_dataset=dataset["train"],\n',
            '# )\n',
            '# \n',
            '# trainer.train()\n',
            '# \n',
            '# # Save model\n',
            '# model.save_pretrained("./fine_tuned_model")\n',
            '# tokenizer.save_pretrained("./fine_tuned_model")\n',
            '# print("Training complete! Model saved to ./fine_tuned_model")\n',
            '\n',
            'print("⚠️  Uncomment training code after loading dataset")\n',
          ],
        },
        // Download model
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: [
            '# Download trained model\n',
            '# Uncomment to download the model after training\n',
            '# from google.colab import files\n',
            '# import shutil\n',
            '# \n',
            '# shutil.make_archive("fine_tuned_model", "zip", "./fine_tuned_model")\n',
            '# files.download("fine_tuned_model.zip")\n',
          ],
        },
      ],
    };

    return JSON.stringify(notebook, null, 2);
  }

  /**
   * Map Colab status to deployment status
   * Note: Limited by Colab API constraints
   */
  private mapColabStatus(colabStatus: string): DeploymentStatus {
    const statusMap: Record<string, DeploymentStatus> = {
      'IDLE': 'completed',
      'BUSY': 'training',
      'STOPPED': 'stopped',
      'ERROR': 'failed',
    };

    return statusMap[colabStatus] || 'running';
  }
}

// Export singleton instance
export const googleColabService = new GoogleColabService();
