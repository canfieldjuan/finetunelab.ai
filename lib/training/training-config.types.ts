// Training Config Types
// TypeScript definitions for FineTune Lab training configurations
// Date: 2025-10-16

import type { PredictionsConfig } from './types/predictions-types';

export interface ModelConfig {
  name: string;
  trust_remote_code: boolean;
  torch_dtype: 'float16' | 'float32' | 'bfloat16';
  device_map: 'auto' | 'cuda' | 'cpu';
}

export interface TokenizerConfig {
  name: string;
  trust_remote_code: boolean;
  padding_side?: 'left' | 'right';
  add_eos_token?: boolean;
}

/**
 * Quantization configuration for BitsAndBytes (QLoRA)
 * Used to load models in 4-bit or 8-bit precision to reduce VRAM usage
 */
export interface QuantizationConfig {
  /** Enable 4-bit quantization (recommended for QLoRA) */
  load_in_4bit?: boolean;
  /** Enable 8-bit quantization (mutually exclusive with load_in_4bit) */
  load_in_8bit?: boolean;
  /** Quantization type: 'nf4' (NormalFloat4 - recommended) or 'fp4' (Float4) */
  bnb_4bit_quant_type?: 'nf4' | 'fp4';
  /** Compute dtype for 4-bit base models: 'float16', 'bfloat16', or 'float32' */
  bnb_4bit_compute_dtype?: 'float16' | 'bfloat16' | 'float32';
  /** Enable double quantization (quantize the quantization constants) */
  bnb_4bit_use_double_quant?: boolean;
}

/**
 * LoRA (Low-Rank Adaptation) configuration
 * Defines how adapter layers are applied to the base model
 */
export interface LoRAConfig {
  /** Rank of the LoRA adapters (8-64, higher = more parameters) */
  r: number;
  /** Alpha scaling factor (typically 2x rank) */
  lora_alpha: number;
  /** Dropout probability for LoRA layers (0.05-0.1) */
  lora_dropout: number;
  /** List of module names to apply LoRA to (e.g., ["q_proj", "k_proj", "v_proj", "o_proj"]) */
  target_modules: string[];
  /** Bias training: 'none' (recommended), 'all', or 'lora_only' */
  bias?: 'none' | 'all' | 'lora_only';
  /** Task type for the model */
  task_type?: 'CAUSAL_LM' | 'SEQ_CLS' | 'SEQ_2_SEQ_LM';
  /** Additional modules to save (not LoRA adapted) */
  modules_to_save?: string[];
}

export type TrainingMethod = 'sft' | 'dpo' | 'rlhf' | 'orpo' | 'cpt';
export type DataStrategy = 'standard' | 'toolbench' | 'pc_building' | 'teacher_mode' | 'knowledge_dense' | 'manual_templates' | 'custom' | 'alpaca' | 'openorca' | 'unnatural_instructions';
export type GenerationType = 'real' | 'synthetic';

// Training Provider Types (Phase 2.3: Local Training Connection)
export type TrainingProvider = 'local' | 'huggingface' | 'remote';
export type ProviderStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LocalProviderConfig {
  type: 'local';
  base_url: string; // e.g., http://localhost:8000
  api_key?: string;
  timeout_ms?: number;
}

export interface HuggingFaceProviderConfig {
  type: 'huggingface';
  api_token: string;
  model_id?: string;
}

export interface RemoteProviderConfig {
  type: 'remote';
  base_url: string;
  api_key: string;
  timeout_ms?: number;
}

export type ProviderConfig = LocalProviderConfig | HuggingFaceProviderConfig | RemoteProviderConfig;

export interface ProviderConnection {
  provider: TrainingProvider;
  status: ProviderStatus;
  config: ProviderConfig;
  last_checked?: string;
  error_message?: string;
}

export interface BaseTrainingConfig {
  method: TrainingMethod;
  num_epochs: number;
  learning_rate: number;
  batch_size: number;
  gradient_accumulation_steps: number;
  warmup_steps: number;
  max_length: number;
  logging_steps?: number;
  
  // LoRA Configuration (legacy fields - maintained for backward compatibility)
  use_lora: boolean;
  /** @deprecated Use lora_config.r instead */
  lora_r?: number;
  /** @deprecated Use lora_config.lora_alpha instead */
  lora_alpha?: number;
  /** @deprecated Use lora_config.lora_dropout instead */
  lora_dropout?: number;
  
  // New structured configs (preferred)
  /** Full LoRA configuration (overrides legacy lora_r, lora_alpha, lora_dropout) */
  lora_config?: LoRAConfig;
  /** Quantization configuration for memory-efficient training */
  quantization?: QuantizationConfig;
  
  tokenizer_padding_side?: string;
}

export interface AdvancedTrainingConfig extends BaseTrainingConfig {
  max_grad_norm?: number;
  bf16?: boolean;
  fp16?: boolean;
  adam_beta1?: number;
  adam_beta2?: number;
  adam_epsilon?: number;
  weight_decay?: number;
  /** Optimizer: 'adamw_torch', 'paged_adamw_8bit', 'paged_adamw_32bit' (recommended for QLoRA) */
  optim?: string;
  /** Enable gradient checkpointing to save memory (recommended for large models) */
  gradient_checkpointing?: boolean;
  
  /** Learning rate scheduler type: 'linear', 'cosine', 'cosine_with_restarts', 'polynomial', 'constant', 'constant_with_warmup' */
  lr_scheduler_type?: string;
  /** Warmup ratio (alternative to warmup_steps): fraction of total training steps for warmup (0.0-0.1) */
  warmup_ratio?: number;
  /** Save strategy: 'no', 'steps', 'epoch' */
  save_strategy?: string;
  /** Save checkpoint every N steps (requires save_strategy='steps') */
  save_steps?: number;
  /** Maximum number of checkpoints to keep (oldest deleted first) */
  save_total_limit?: number;
  /** Pack multiple short sequences into one to maximize GPU utilization */
  packing?: boolean;
  /** Evaluation strategy: 'no', 'steps', 'epoch' */
  evaluation_strategy?: string;
  /** Evaluate every N steps (requires evaluation_strategy='steps') */
  eval_steps?: number;
  /** Metric to use for selecting best model: 'loss', 'eval_loss', etc. */
  metric_for_best_model?: string;
  
  // DPO/ORPO specific parameters
  /** Maximum prompt length for DPO/ORPO training */
  max_prompt_length?: number;
  /** Beta parameter for DPO/ORPO loss calculation (typically 0.1) */
  beta?: number;
  
  /** DataLoader: Number of worker processes for data loading (0 = main process only, 4-8 recommended for fast training) */
  dataloader_num_workers?: number;
  /** DataLoader: Number of batches to prefetch per worker (2-4 recommended, requires num_workers > 0) */
  dataloader_prefetch_factor?: number | null;
  /** DataLoader: Pin memory for faster CPU-to-GPU transfer (recommended: true) */
  dataloader_pin_memory?: boolean;
  /** Group samples by length to reduce padding waste (recommended for varied-length data) */
  group_by_length?: boolean;
  /** Batch size for evaluation (defaults to per_device_train_batch_size if not set) */
  eval_batch_size?: number;
  
  /**
   * Pre-tokenize datasets before training to eliminate CPU bottleneck.
   *
   * When enabled, datasets are tokenized once before training starts and cached to disk.
   * This eliminates on-the-fly tokenization overhead during training, significantly
   * improving training throughput (especially with dataloader_num_workers > 0).
   *
   * Response template masking (training only on responses, not prompts) is automatically
   * applied for both pretokenized and non-pretokenized training when a chat template is
   * detected. Pretokenization applies masking once during caching, while non-pretokenized
   * applies masking at runtime per batch.
   *
   * Benefits:
   * - 50-100x faster training throughput (eliminates CPU tokenization bottleneck)
   * - Tokenization happens once before training (not per-epoch or per-batch)
   * - Results cached to disk for reuse across training runs
   * - Reduces CPU usage during training
   * - Automatic response masking for SFT (prompt tokens masked with -100)
   *
   * Trade-offs:
   * - Initial tokenization takes time (one-time cost)
   * - Cached files use disk space (~1-2GB per dataset)
   * - Cache invalidated if model, max_length, dataset, or masking version changes
   *
   * Recommended: true for production training (better performance), false for quick experiments
   * Default: false (backward compatible)
   *
   * @default false
   */
  pretokenize?: boolean;

  /**
   * Enable streaming dataset loading for memory-efficient training.
   * 
   * When enabled, dataset is loaded batch-by-batch from disk instead of loading
   * the entire dataset into memory at once. This reduces RAM and VRAM usage
   * but requires on-the-fly tokenization.
   * 
   * Benefits:
   * - Lower RAM usage (only current batch in memory)
   * - Lower VRAM allocation peaks (incremental batch loading)
   * - Better for very large datasets (>100K examples)
   * 
   * Trade-offs:
   * - Automatically disables pretokenize (incompatible with caching)
   * - Slower training (on-the-fly tokenization overhead)
   * - Sequential access only (limited random access for evaluation)
   * 
   * Mutually exclusive with pretokenize (streaming will auto-disable pretokenization).
   * 
   * Recommended: false for most cases (datasets <100K examples)
   * Use only for very large datasets where memory is constrained.
   * Default: false
   * 
   * @default false
   */
  use_streaming?: boolean;

  /**
   * Distributed training configuration for multi-GPU setups
   * Phase 0: Advanced Training Features - 2025-11-02
   * @see {DistributedConfig} from './distributed-training.types'
   */
  distributed?: import('./distributed-training.types').DistributedConfig;

  /**
   * Checkpoint resume configuration
   * Phase 0: Advanced Training Features - 2025-11-02
   * @see {CheckpointResumeConfig} from './checkpoint-resume.types'
   */
  checkpoint_resume?: import('./checkpoint-resume.types').CheckpointResumeConfig;

  // RLHF-specific PPO parameters
  /** Number of PPO optimization steps per batch (RLHF only, typically 4) */
  ppo_epochs?: number;
  /** PPO clipping range for policy updates (RLHF only, typically 0.2) */
  clip_range?: number;
  /** Value function clipping range (RLHF only, typically 0.2) */
  clip_range_value?: number;
  /** Value function coefficient in PPO loss (RLHF only, typically 0.1) */
  vf_coef?: number;
  /** Entropy coefficient for exploration bonus (RLHF only, typically 0.01) */
  entropy_coef?: number;
}

export interface DataConfig {
  strategy: DataStrategy;
  generation_type: GenerationType;
  max_samples?: number; // Optional - if undefined, uses entire dataset
  train_split: number;
  eval_split?: number;
  dataset_format?: string; // Dataset format: 'sft', 'dpo', 'rlhf', etc.
}

export interface ToolParameter {
  type: string;
  description: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  type: 'function';
  function: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export interface EvaluationConfig {
  metrics: string[];
  eval_steps: number;
}

export interface TensorboardConfig {
  enabled: boolean;
  log_dir: string;
}

export interface TrainingConfig {
  model: ModelConfig;
  tokenizer: TokenizerConfig;
  training: BaseTrainingConfig | AdvancedTrainingConfig;
  data: DataConfig;
  provider?: ProviderConfig; // Phase 2.3: Training provider configuration
  tools?: ToolDefinition[];
  evaluation?: EvaluationConfig;
  tensorboard?: TensorboardConfig;
  predictions?: PredictionsConfig; // W&B-style prediction tracking
  seed?: number;
}

export interface TrainingConfigRecord {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  template_type: string;
  config_json: TrainingConfig;
  is_validated: boolean;
  validation_errors: Record<string, unknown> | null;
  times_used: number;
  last_used_at: string | null;
  public_id: string | null;
  gist_urls: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CreateConfigDTO {
  name: string;
  description?: string;
  template_type: string;
  config_json: TrainingConfig;
}

export interface UpdateConfigDTO {
  name?: string;
  description?: string;
  config_json?: TrainingConfig;
}

console.log('[TrainingConfigTypes] Types loaded');
