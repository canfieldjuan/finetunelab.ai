import * as fs from 'fs';
import * as path from 'path';
import type { TrainingConfig, AdvancedTrainingConfig } from './training-config.types';

export class ScriptBuilder {
  /**
   * Generate config.json content for standalone_trainer.py
   * Converts TrainingConfig TypeScript interface to Python config format
   */
  static generateTrainingConfig(
    modelName: string,
    datasetPath: string,
    trainingConfig: TrainingConfig
  ): unknown {
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
    };
  }

  /**
   * Read and encode standalone_trainer.py for upload to RunPod
   * Returns base64-encoded content for safe shell transfer
   */
  static getStandaloneTrainerContent(): string {
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
      console.error('[ScriptBuilder] Failed to read standalone_trainer.py:', error);
      throw new Error('Failed to read standalone trainer script');
    }
  }

  /**
   * Generate the bash script for RunPod execution
   */
  static generateRunPodScript(
    config: unknown,
    huggingFaceToken: string,
    wandbKey: string | undefined,
    jobId: string
  ): string {
    const configJson = JSON.stringify(config, null, 2);
    const configBase64 = Buffer.from(configJson).toString('base64');
    const trainerScriptBase64 = this.getStandaloneTrainerContent();

    return `#!/bin/bash
# PHASE 2 FIX: Enhanced logging and error handling
# Removed -e flag to prevent immediate exit on error and allow debugging
set -uo pipefail

# Setup environment
export HF_TOKEN="${huggingFaceToken}"
${wandbKey ? `export WANDB_API_KEY="${wandbKey}"` : ''}
export JOB_ID="${jobId}"

# Prevent restart loops - check if script already ran
LOCK_FILE="/workspace/.training_started"
if [ -f "\$LOCK_FILE" ]; then
  echo "================================================"
  echo "[\$(date)] DETECTED CONTAINER RESTART"
  echo "================================================"
  echo "Training script already started at: \$(cat \$LOCK_FILE)"
  echo "This is likely a container restart. Keeping container alive..."
  echo "Check logs above for the actual error that caused restart."
  echo ""
  tail -f /dev/null
fi

# Mark that we've started (prevents restart loops)
echo "\$(date)" > "\$LOCK_FILE"

echo "================================================"
echo "[\$(date)] RunPod Training Script Started"
echo "================================================"

echo "=== System Information ==="
echo "Date: \$(date)"
echo "Hostname: \$(hostname)"
echo "Working Directory: \$(pwd)"
echo "GPU: \$(nvidia-smi --query-gpu=name --format=csv,noheader 2>&1 || echo 'No GPU detected')"
echo "CUDA Version: \$(nvcc --version 2>&1 | grep release || echo 'CUDA not found')"
echo "Python: \$(python --version 2>&1 || echo 'Python not found')"
echo "Disk Space: \$(df -h /workspace | tail -1)"
echo "=========================="
echo ""

# Create workspace directory
mkdir -p /workspace
cd /workspace

# Install dependencies
echo "[\$(date)] Installing dependencies..."

# Verify Python is available
if ! python --version >/dev/null 2>&1; then
  echo "[\$(date)] ✗ ERROR: Python not found in PATH"
  echo "[\$(date)] Waiting 60s before exit for log inspection..."
  sleep 60
  exit 1
fi

# Upgrade pip first to avoid version issues
echo "[\$(date)] Upgrading pip..."
if python -m pip install --root-user-action=ignore --upgrade pip >/dev/null 2>&1; then
  echo "[\$(date)] ✓ Pip upgraded: \$(python -m pip --version)"
else
  echo "[\$(date)] ✗ WARNING: Failed to upgrade pip, continuing with existing version"
fi

echo "[\$(date)] Current TRL version (before upgrade): \$(python -m pip show trl 2>/dev/null | grep Version || echo 'not installed')"

# Uninstall old trl first, then install fresh to avoid caching issues
python -m pip uninstall -y trl 2>/dev/null || true

# Remove torchvision and torchaudio if present (not needed for LLM text training)
# This prevents version conflicts when PyTorch gets upgraded
echo "[\$(date)] Removing torchvision/torchaudio (not needed for text LLM training)..."
python -m pip uninstall -y torchvision torchaudio 2>/dev/null || true

# Pin PyTorch to 2.1.0 to match base image CUDA 11.8 (prevents 1.5GB CUDA 12 download)
echo "[\$(date)] Pinning PyTorch to 2.1.0 (matches CUDA 11.8 base image)..."
python -m pip install --root-user-action=ignore --no-cache-dir "torch==2.1.0" 2>&1 | grep -v "Requirement already satisfied" || true

echo "[\$(date)] Installing training dependencies..."
if python -m pip install --root-user-action=ignore --no-cache-dir \\
   "trl==0.26.0" \\
   "transformers>=4.40.0" \\
   "datasets>=2.18.0" \\
   "accelerate>=0.27.0" \\
   "peft>=0.9.0" \\
   "bitsandbytes>=0.42.0" \\
   "tensorboard>=2.14.0" \\
   "pynvml>=11.5.0" \\
   "supabase>=2.0.0" \\
   "huggingface_hub>=0.20.0" \\
   "requests>=2.31.0" \\
   "scipy"; then
  echo "[\$(date)] ✓ Dependencies installed successfully"
  echo "[\$(date)] TRL version: \$(python -m pip show trl | grep Version)"
  echo "[\$(date)] Transformers version: \$(python -m pip show transformers | grep Version)"
  # Verify the import works
  python -c "from trl import SFTTrainer; print('[\$(date)] ✓ TRL imports verified')" || {
    echo "[\$(date)] ✗ ERROR: TRL imports failed after upgrade"
    python -m pip show trl
    echo "[\$(date)] Waiting 60s before exit for log inspection..."
    sleep 60
    exit 1
  }
else
  echo "[\$(date)] ✗ ERROR: Failed to install dependencies"
  echo "[\$(date)] Waiting 60s before exit for log inspection..."
  sleep 60
  exit 1
fi

# Download training data
echo "[\$(date)] Downloading dataset..."
if [ -z "\$DATASET_URL" ]; then
    echo "[\$(date)] ✗ ERROR: DATASET_URL environment variable is not set"
    sleep 60
    exit 1
fi

if wget -q -O dataset_download "\$DATASET_URL"; then
  echo "[\$(date)] ✓ Dataset downloaded (\$(du -h dataset_download | cut -f1))"

  # Check if file is gzipped by reading magic bytes (1f 8b)
  MAGIC_BYTES=\$(od -An -tx1 -N2 dataset_download | tr -d ' ')
  if [ "\$MAGIC_BYTES" = "1f8b" ]; then
    echo "[\$(date)] Dataset is gzipped (magic bytes: \$MAGIC_BYTES) - decompressing..."
    if gunzip -c dataset_download > dataset.jsonl; then
      echo "[\$(date)] ✓ Dataset decompressed (\$(wc -l < dataset.jsonl) lines)"
      rm dataset_download
    else
      echo "[\$(date)] ✗ ERROR: Failed to decompress gzipped dataset"
      echo "[\$(date)] Waiting 60s before exit for log inspection..."
      sleep 60
      exit 1
    fi
  else
    echo "[\$(date)] Dataset is not gzipped (magic bytes: \$MAGIC_BYTES) - using directly..."
    mv dataset_download dataset.jsonl
    echo "[\$(date)] ✓ Dataset ready (\$(wc -l < dataset.jsonl) lines)"
  fi
else
  echo "[\$(date)] ✗ ERROR: Failed to download dataset"
  echo "[\$(date)] URL was: \$DATASET_URL"
  echo "[\$(date)] This could mean the download token has expired (tokens expire after 2 hours)"
  echo "[\$(date)] Waiting 60s before exit for log inspection..."
  sleep 60
  exit 1
fi

# Write config file
echo "\${configBase64}" | base64 -d > /workspace/config.json
echo "[\$(date)] ✓ config.json created"

# Write trainer script
echo "\${trainerScriptBase64}" | base64 -d > /workspace/standalone_trainer.py
echo "[\$(date)] ✓ standalone_trainer.py created"

# Run training
echo "[\$(date)] =========================================="
echo "[\$(date)] Starting training with standalone_trainer.py..."
echo "[\$(date)] =========================================="

if python /workspace/standalone_trainer.py --config /workspace/config.json --execution-id \${jobId} 2>&1 | tee training_output.log; then
  EXIT_CODE=\${PIPESTATUS[0]}
  echo "[\$(date)] =========================================="
  echo "[\$(date)] ✓ Training completed successfully! (exit code: \$EXIT_CODE)"
  echo "[\$(date)] Model saved to /workspace/fine_tuned_model"
  echo "[\$(date)] =========================================="

  # Keep pod alive for 1 hour to allow model download
  echo "[\$(date)] Pod will remain active for 1 hour for model download"
  echo "[\$(date)] You can download the model from /workspace/fine_tuned_model"
  sleep 3600

  echo "[\$(date)] Shutting down pod"
  exit 0
else
  EXIT_CODE=\${PIPESTATUS[0]}
  echo "[\$(date)] =========================================="
  echo "[\$(date)] ✗ Training failed with exit code: \$EXIT_CODE"
  echo "[\$(date)] =========================================="
  echo "[\$(date)] Last 50 lines of training output:"
  tail -50 training_output.log || echo "Could not read training log"

  # Wait before terminating to allow log inspection
  echo "[\$(date)] Waiting 120s before terminating pod (allows log inspection in RunPod console)"
  sleep 120

  echo "[\$(date)] Terminating pod"
  exit \$EXIT_CODE
fi
`;
  }

  /**
   * Generate the Python script for local execution
   * @deprecated This method is currently unused. Local training uses the API directly.
   * For downloadable packages, see local-package-generator.ts
   */
  /*
  static generateLocalScript(
    config: unknown,
    outputPath: string
  ): string {
    return "";
  }
  */
}
