// Training Config Templates
// Pre-configured templates for FineTune Lab training
// Date: 2025-10-16

import type { TrainingConfig } from './training-config.types';

export const SFT_TOOLBENCH_TEMPLATE: TrainingConfig = {
  model: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true,
    torch_dtype: 'bfloat16', // Changed to bfloat16 for better QLoRA performance
    device_map: 'auto'
  },
  tokenizer: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true
  },
  training: {
    method: 'sft',
    num_epochs: 1,
    learning_rate: 2e-4, // Higher learning rate for QLoRA (was 5e-5)
    batch_size: 4,
    gradient_accumulation_steps: 8,
    tokenizer_padding_side: 'left',
    warmup_steps: 100,
    max_length: 2048,
    use_lora: true,
    
    // Legacy LoRA fields (for backward compatibility)
    lora_r: 16, // Increased from 8 for better performance
    lora_alpha: 32,
    lora_dropout: 0.1, // Increased from 0.05
    
    // New structured LoRA configuration (preferred)
    lora_config: {
      r: 16,
      lora_alpha: 32,
      lora_dropout: 0.1,
      target_modules: ["q_proj", "k_proj", "v_proj", "o_proj"], // All attention projections
      bias: "none",
      task_type: "CAUSAL_LM"
    },
    
    // QLoRA quantization configuration
    quantization: {
      load_in_4bit: true,
      bnb_4bit_quant_type: "nf4", // NormalFloat4 - optimized for neural networks
      bnb_4bit_compute_dtype: "bfloat16",
      bnb_4bit_use_double_quant: true // Double quantization for extra memory savings
    },
    
    // Advanced training args for QLoRA
    optim: "paged_adamw_32bit", // Paged optimizer for memory efficiency
    gradient_checkpointing: false, // Disabled for speed (enable if OOM)
    fp16: false, // Disabled because we're using bfloat16
    bf16: true,

    // Data loading configuration
    dataloader_num_workers: 8, // Parallel data loading for performance (was 0)
    dataloader_prefetch_factor: 2, // Prefetch batches for smoother training
    dataloader_pin_memory: true,
    group_by_length: false, // Not needed when packing is enabled
    eval_batch_size: 4, // Same as training batch_size

    // Logging configuration
    logging_steps: 25,
    eval_steps: 500,
    save_steps: 500,
    save_total_limit: 2,
    evaluation_strategy: 'steps',
    packing: false // Set to true for faster training on varied-length data
  },
  data: {
    strategy: 'toolbench',
    generation_type: 'real',
    max_samples: undefined, // User configurable - uses entire dataset if not specified
    train_split: 0.99
  }
};

export const SFT_PC_BUILDING_TEMPLATE: TrainingConfig = {
  model: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true,
    torch_dtype: 'bfloat16', // Changed to bfloat16 for better QLoRA performance
    device_map: 'auto'
  },
  tokenizer: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true
  },
  training: {
    method: 'sft',
    num_epochs: 1,
    learning_rate: 2e-4, // Higher learning rate for QLoRA
    batch_size: 4,
    gradient_accumulation_steps: 8,
    warmup_steps: 100,
    max_length: 2048,
    use_lora: true,
    
    // Legacy LoRA fields (for backward compatibility)
    lora_r: 16,
    lora_alpha: 32,
    lora_dropout: 0.1,
    
    // New structured LoRA configuration
    lora_config: {
      r: 16,
      lora_alpha: 32,
      lora_dropout: 0.1,
      target_modules: ["q_proj", "k_proj", "v_proj", "o_proj"],
      bias: "none",
      task_type: "CAUSAL_LM"
    },
    
    // QLoRA quantization configuration
    quantization: {
      load_in_4bit: true,
      bnb_4bit_quant_type: "nf4",
      bnb_4bit_compute_dtype: "bfloat16",
      bnb_4bit_use_double_quant: true
    },
    
    // Advanced training args for QLoRA
    optim: "paged_adamw_32bit",
    gradient_checkpointing: true,
    fp16: false,
    bf16: true,

    // Data loading configuration
    dataloader_num_workers: 8,
    dataloader_prefetch_factor: 2,
    dataloader_pin_memory: true,
    group_by_length: false,
    eval_batch_size: 4,

    // Logging configuration
    logging_steps: 25,
    eval_steps: 500,
    save_steps: 500,
    save_total_limit: 2,
    evaluation_strategy: 'steps',
    packing: false
  },
  data: {
    strategy: 'pc_building',
    generation_type: 'real',
    max_samples: undefined, // User configurable - uses entire dataset if not specified
    train_split: 0.99
  }
};

export const DPO_TEMPLATE: TrainingConfig = {
  model: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true,
    torch_dtype: 'bfloat16', // Changed to bfloat16
    device_map: 'auto'
  },
  tokenizer: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true,
    padding_side: 'left'
  },
  training: {
    method: 'dpo',
    num_epochs: 100,
    learning_rate: 1e-6,
    batch_size: 2,
    gradient_accumulation_steps: 16,
    warmup_steps: 100,
    max_length: 512,
    use_lora: true,
    
    // Legacy LoRA fields
    lora_r: 16,
    lora_alpha: 32,
    lora_dropout: 0.1,
    
    // New structured LoRA configuration
    lora_config: {
      r: 16,
      lora_alpha: 32,
      lora_dropout: 0.1,
      target_modules: ["q_proj", "k_proj", "v_proj", "o_proj"],
      bias: "none",
      task_type: "CAUSAL_LM"
    },
    
    // QLoRA quantization for DPO
    quantization: {
      load_in_4bit: true,
      bnb_4bit_quant_type: "nf4",
      bnb_4bit_compute_dtype: "bfloat16",
      bnb_4bit_use_double_quant: true
    },
    
    max_grad_norm: 0.3,
    bf16: true,
    fp16: false,
    adam_beta1: 0.9,
    adam_beta2: 0.999,
    adam_epsilon: 1e-8,
    weight_decay: 0.01,
    optim: 'paged_adamw_32bit', // Changed from paged_adamw_8bit for stability
    gradient_checkpointing: true,

    // Data loading configuration
    dataloader_num_workers: 8,
    dataloader_prefetch_factor: 2,
    dataloader_pin_memory: true,
    group_by_length: false,
    eval_batch_size: 2,

    // Logging configuration
    logging_steps: 25,
    eval_steps: 100,
    save_steps: 100,
    save_total_limit: 2,
    evaluation_strategy: 'steps',
    packing: false
  },
  data: {
    strategy: 'manual_templates',
    generation_type: 'synthetic',
    max_samples: undefined, // User configurable - uses entire dataset if not specified
    train_split: 0.8
  },
  evaluation: {
    metrics: ['tool_accuracy', 'response_quality', 'tool_format_correctness'],
    eval_steps: 100
  },
  tensorboard: {
    enabled: true,
    log_dir: 'outputs/runs'
  },
  seed: 42
};

export const TEACHER_MODE_TEMPLATE: TrainingConfig = {
  model: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true,
    torch_dtype: 'bfloat16',
    device_map: 'auto'
  },
  tokenizer: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true
  },
  training: {
    method: 'sft',
    num_epochs: 2,
    learning_rate: 2e-4, // Updated for QLoRA
    batch_size: 4,
    gradient_accumulation_steps: 8,
    warmup_steps: 100,
    max_length: 2048,
    use_lora: true,
    
    // Legacy LoRA fields
    lora_r: 16,
    lora_alpha: 32,
    lora_dropout: 0.1,
    
    // New structured LoRA configuration
    lora_config: {
      r: 16,
      lora_alpha: 32,
      lora_dropout: 0.1,
      target_modules: ["q_proj", "k_proj", "v_proj", "o_proj"],
      bias: "none",
      task_type: "CAUSAL_LM"
    },
    
    // QLoRA quantization
    quantization: {
      load_in_4bit: true,
      bnb_4bit_quant_type: "nf4",
      bnb_4bit_compute_dtype: "bfloat16",
      bnb_4bit_use_double_quant: true
    },
    
    optim: "paged_adamw_32bit",
    gradient_checkpointing: true,
    fp16: false,
    bf16: true,

    // Data loading configuration
    dataloader_num_workers: 8,
    dataloader_prefetch_factor: 2,
    dataloader_pin_memory: true,
    group_by_length: false,
    eval_batch_size: 4,

    // Logging configuration
    logging_steps: 25,
    eval_steps: 500,
    save_steps: 500,
    save_total_limit: 2,
    evaluation_strategy: 'steps',
    packing: false
  },
  data: {
    strategy: 'teacher_mode',
    generation_type: 'real',
    max_samples: undefined, // User configurable - uses entire dataset if not specified
    train_split: 0.95
  }
};

export const KNOWLEDGE_DENSE_TEMPLATE: TrainingConfig = {
  model: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true,
    torch_dtype: 'float16',
    device_map: 'auto'
  },
  tokenizer: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true
  },
  training: {
    method: 'sft',
    num_epochs: 3,
    learning_rate: 2e-5,
    batch_size: 2,
    gradient_accumulation_steps: 16,
    warmup_steps: 150,
    max_length: 2048,
    use_lora: true,
    lora_r: 8,
    lora_alpha: 32,
    lora_dropout: 0.05,

    // Data loading configuration
    dataloader_num_workers: 8,
    dataloader_prefetch_factor: 2,
    dataloader_pin_memory: true,
    group_by_length: false,
    eval_batch_size: 2,

    // Logging configuration
    logging_steps: 25,
    eval_steps: 500,
    save_steps: 500,
    save_total_limit: 2,
    evaluation_strategy: 'steps',
    packing: false
  },
  data: {
    strategy: 'knowledge_dense',
    generation_type: 'real',
    max_samples: undefined, // User configurable - uses entire dataset if not specified
    train_split: 0.98
  }
};

export const ALPACA_SFT_TEMPLATE: TrainingConfig = {
  model: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true,
    torch_dtype: 'float16',
    device_map: 'auto'
  },
  tokenizer: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true
  },
  training: {
    method: 'sft',
    num_epochs: 2,
    learning_rate: 3e-5,
    batch_size: 4,
    gradient_accumulation_steps: 8,
    warmup_steps: 100,
    max_length: 2048,
    use_lora: true,
    lora_r: 8,
    lora_alpha: 32,
    lora_dropout: 0.05,

    // Data loading configuration
    dataloader_num_workers: 8,
    dataloader_prefetch_factor: 2,
    dataloader_pin_memory: true,
    group_by_length: false,
    eval_batch_size: 4,

    // Logging configuration
    logging_steps: 25,
    eval_steps: 500,
    save_steps: 500,
    save_total_limit: 2,
    evaluation_strategy: 'steps',
    packing: false
  },
  data: {
    strategy: 'alpaca',
    generation_type: 'real',
    max_samples: undefined, // User configurable - uses entire dataset if not specified
    train_split: 0.95
  }
};

export const OPENORCA_SFT_TEMPLATE: TrainingConfig = {
  model: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true,
    torch_dtype: 'float16',
    device_map: 'auto'
  },
  tokenizer: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true
  },
  training: {
    method: 'sft',
    num_epochs: 2,
    learning_rate: 3e-5,
    batch_size: 4,
    gradient_accumulation_steps: 8,
    warmup_steps: 100,
    max_length: 2048,
    use_lora: true,
    lora_r: 8,
    lora_alpha: 32,
    lora_dropout: 0.05,

    // Data loading configuration
    dataloader_num_workers: 8,
    dataloader_prefetch_factor: 2,
    dataloader_pin_memory: true,
    group_by_length: false,
    eval_batch_size: 4,

    // Logging configuration
    logging_steps: 25,
    eval_steps: 500,
    save_steps: 500,
    save_total_limit: 2,
    evaluation_strategy: 'steps',
    packing: false
  },
  data: {
    strategy: 'openorca',
    generation_type: 'real',
    max_samples: undefined, // User configurable - uses entire dataset if not specified
    train_split: 0.95
  }
};

export const UNNATURAL_INSTRUCTIONS_TEMPLATE: TrainingConfig = {
  model: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true,
    torch_dtype: 'float16',
    device_map: 'auto'
  },
  tokenizer: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true
  },
  training: {
    method: 'sft',
    num_epochs: 2,
    learning_rate: 3e-5,
    batch_size: 4,
    gradient_accumulation_steps: 8,
    warmup_steps: 100,
    max_length: 2048,
    use_lora: true,
    lora_r: 8,
    lora_alpha: 32,
    lora_dropout: 0.05,

    // Data loading configuration
    dataloader_num_workers: 8,
    dataloader_prefetch_factor: 2,
    dataloader_pin_memory: true,
    group_by_length: false,
    eval_batch_size: 4,

    // Logging configuration
    logging_steps: 25,
    eval_steps: 500,
    save_steps: 500,
    save_total_limit: 2,
    evaluation_strategy: 'steps',
    packing: false
  },
  data: {
    strategy: 'unnatural_instructions',
    generation_type: 'real',
    max_samples: undefined, // User configurable - uses entire dataset if not specified
    train_split: 0.95
  }
};

// Standard SFT Template
export const SFT_STANDARD_TEMPLATE: TrainingConfig = {
  model: {
    name: 'meta-llama/Llama-3.2-1B-Instruct', // Default - change in UI to your model
    trust_remote_code: true,
    torch_dtype: 'bfloat16',
    device_map: 'auto'
  },
  tokenizer: {
    name: 'meta-llama/Llama-3.2-1B-Instruct',
    trust_remote_code: true
  },
  training: {
    method: 'sft',
    num_epochs: 3,
    learning_rate: 2e-4,
    batch_size: 4,
    gradient_accumulation_steps: 8,
    warmup_ratio: 0.03,
    warmup_steps: 100,
    max_length: 2048,
    use_lora: true,
    
    lora_r: 16,
    lora_alpha: 32,
    lora_dropout: 0.1,
    
    lora_config: {
      r: 16,
      lora_alpha: 32,
      lora_dropout: 0.1,
      target_modules: ["q_proj", "k_proj", "v_proj", "o_proj"],
      bias: "none",
      task_type: "CAUSAL_LM"
    },
    
    quantization: {
      load_in_4bit: true,
      bnb_4bit_quant_type: "nf4",
      bnb_4bit_compute_dtype: "bfloat16",
      bnb_4bit_use_double_quant: true
    },
    
    optim: "paged_adamw_8bit",
    gradient_checkpointing: false,
    fp16: false,
    bf16: true,
    max_grad_norm: 1.0,
    weight_decay: 0.01,
    lr_scheduler_type: 'cosine',

    dataloader_num_workers: 4,
    dataloader_prefetch_factor: 2,
    dataloader_pin_memory: true,
    group_by_length: true,
    eval_batch_size: 4,

    logging_steps: 10,
    eval_steps: 500,
    save_steps: 500,
    save_total_limit: 3,
    evaluation_strategy: 'steps',
    packing: true
  },
  data: {
    strategy: 'standard',
    generation_type: 'real',
    max_samples: undefined,
    train_split: 0.95,
    eval_split: 0.05
  }
};

// Standard DPO Template
export const DPO_STANDARD_TEMPLATE: TrainingConfig = {
  model: {
    name: 'meta-llama/Llama-2-7b-hf',
    trust_remote_code: true,
    torch_dtype: 'bfloat16',
    device_map: 'auto'
  },
  tokenizer: {
    name: 'meta-llama/Llama-2-7b-hf',
    trust_remote_code: true,
    padding_side: 'left'
  },
  training: {
    method: 'dpo',
    num_epochs: 3,
    learning_rate: 1e-6,
    batch_size: 2,
    gradient_accumulation_steps: 16,
    warmup_steps: 100,
    max_length: 512,
    use_lora: true,
    
    lora_r: 16,
    lora_alpha: 32,
    lora_dropout: 0.1,
    
    lora_config: {
      r: 16,
      lora_alpha: 32,
      lora_dropout: 0.1,
      target_modules: ["q_proj", "k_proj", "v_proj", "o_proj"],
      bias: "none",
      task_type: "CAUSAL_LM"
    },
    
    quantization: {
      load_in_4bit: true,
      bnb_4bit_quant_type: "nf4",
      bnb_4bit_compute_dtype: "bfloat16",
      bnb_4bit_use_double_quant: true
    },
    
    max_grad_norm: 0.3,
    bf16: true,
    fp16: false,
    adam_beta1: 0.9,
    adam_beta2: 0.999,
    adam_epsilon: 1e-8,
    weight_decay: 0.01,
    optim: 'paged_adamw_32bit',
    gradient_checkpointing: true,

    dataloader_num_workers: 4,
    dataloader_prefetch_factor: 2,
    dataloader_pin_memory: true,
    group_by_length: false,
    eval_batch_size: 2,

    logging_steps: 25,
    eval_steps: 100,
    save_steps: 100,
    save_total_limit: 2,
    evaluation_strategy: 'steps',
    packing: false
  },
  data: {
    strategy: 'manual_templates',
    generation_type: 'synthetic',
    max_samples: undefined,
    train_split: 0.8
  },
  evaluation: {
    metrics: ['tool_accuracy', 'response_quality', 'tool_format_correctness'],
    eval_steps: 100
  },
  tensorboard: {
    enabled: true,
    log_dir: 'outputs/runs'
  },
  seed: 42
};

/**
 * RLHF (Reinforcement Learning from Human Feedback) Standard Template
 *
 * Uses PPO (Proximal Policy Optimization) to train models with reward signals.
 * Requires a reward model or reward function to score responses.
 *
 * Key Parameters:
 * - Lower learning rate (1e-5) for stable PPO updates
 * - Smaller batch size (4) due to memory overhead (policy + reward model)
 * - ppo_epochs: Number of PPO optimization steps per batch
 * - clip_range: PPO clipping parameter (typically 0.2)
 *
 * Memory Requirements: ~2x base model size (policy + reward model)
 * Recommended: Use LoRA to reduce memory footprint by 75%
 */
export const RLHF_STANDARD_TEMPLATE: TrainingConfig = {
  model: {
    name: 'meta-llama/Llama-2-7b-hf',
    trust_remote_code: true,
    torch_dtype: 'bfloat16',
    device_map: 'auto'
  },
  tokenizer: {
    name: 'meta-llama/Llama-2-7b-hf',
    trust_remote_code: true,
    padding_side: 'left',  // Important for generation in RLHF
    add_eos_token: true
  },
  training: {
    method: 'rlhf',
    num_epochs: 3,
    learning_rate: 1e-5,  // Lower LR for PPO stability
    batch_size: 4,  // Smaller batch due to memory (policy + reward model)
    gradient_accumulation_steps: 4,
    warmup_steps: 100,
    max_length: 512,
    use_lora: true,  // Strongly recommended for RLHF to save memory

    lora_r: 16,
    lora_alpha: 32,
    lora_dropout: 0.1,

    lora_config: {
      r: 16,
      lora_alpha: 32,
      lora_dropout: 0.1,
      target_modules: ["q_proj", "k_proj", "v_proj", "o_proj"],
      bias: "none",
      task_type: "CAUSAL_LM"
    },

    quantization: {
      load_in_4bit: true,
      bnb_4bit_quant_type: "nf4",
      bnb_4bit_compute_dtype: "bfloat16",
      bnb_4bit_use_double_quant: true
    },

    // RLHF-specific PPO parameters
    ppo_epochs: 4,  // PPO optimization steps per batch
    clip_range: 0.2,  // PPO clipping parameter
    clip_range_value: 0.2,  // Value function clipping
    vf_coef: 0.1,  // Value function coefficient
    entropy_coef: 0.01,  // Exploration bonus

    max_grad_norm: 1.0,
    bf16: true,
    fp16: false,
    adam_beta1: 0.9,
    adam_beta2: 0.999,
    adam_epsilon: 1e-8,
    weight_decay: 0.01,
    optim: 'paged_adamw_8bit',
    gradient_checkpointing: true,

    dataloader_num_workers: 4,
    dataloader_prefetch_factor: 2,
    dataloader_pin_memory: true,
    group_by_length: false,
    eval_batch_size: 4,

    logging_steps: 10,  // More frequent logging for PPO
    eval_steps: 500,
    save_steps: 500,
    save_total_limit: 2,
    evaluation_strategy: 'steps',
    packing: false  // Packing not supported in RLHF
  },
  data: {
    strategy: 'custom',
    generation_type: 'real',
    max_samples: undefined,
    train_split: 0.9,
    dataset_format: 'rlhf'  // RLHF format required
  },
  evaluation: {
    metrics: ['reward_score', 'policy_loss', 'value_loss'],
    eval_steps: 500
  },
  tensorboard: {
    enabled: true,
    log_dir: 'outputs/runs'
  },
  seed: 42
};

/**
 * ORPO (Odds Ratio Preference Optimization) Standard Template
 *
 * Reference-model-free preference optimization that combines SFT + alignment in one step.
 * More efficient than DPO as it doesn't require a reference model.
 *
 * Key Parameters:
 * - Lower learning rate (8e-6) for stable preference learning
 * - beta: Controls relative ratio loss weight (default 0.1)
 * - disable_dropout: Typically true for ORPO
 * - Same data format as DPO (chosen/rejected pairs)
 *
 * Memory Requirements: ~1x base model size (no reference model)
 * Recommended: Use LoRA for memory efficiency
 */
export const ORPO_STANDARD_TEMPLATE: TrainingConfig = {
  model: {
    name: 'meta-llama/Llama-2-7b-hf',
    trust_remote_code: true,
    torch_dtype: 'bfloat16',
    device_map: 'auto'
  },
  tokenizer: {
    name: 'meta-llama/Llama-2-7b-hf',
    trust_remote_code: true,
    padding_side: 'left'
  },
  training: {
    method: 'orpo',
    num_epochs: 3,
    learning_rate: 8e-6,  // Slightly lower than DPO for stability
    batch_size: 4,
    gradient_accumulation_steps: 4,
    warmup_steps: 100,
    max_length: 1024,
    use_lora: true,

    lora_r: 16,
    lora_alpha: 32,
    lora_dropout: 0.1,

    lora_config: {
      r: 16,
      lora_alpha: 32,
      lora_dropout: 0.1,
      target_modules: ["q_proj", "k_proj", "v_proj", "o_proj"],
      bias: "none",
      task_type: "CAUSAL_LM"
    },

    quantization: {
      load_in_4bit: true,
      bnb_4bit_quant_type: "nf4",
      bnb_4bit_compute_dtype: "bfloat16",
      bnb_4bit_use_double_quant: true
    },

    max_grad_norm: 1.0,
    bf16: true,
    fp16: false,
    adam_beta1: 0.9,
    adam_beta2: 0.999,
    adam_epsilon: 1e-8,
    weight_decay: 0.01,
    optim: 'paged_adamw_8bit',
    gradient_checkpointing: true,

    dataloader_num_workers: 4,
    dataloader_prefetch_factor: 2,
    dataloader_pin_memory: true,
    group_by_length: false,
    eval_batch_size: 4,

    logging_steps: 25,
    eval_steps: 100,
    save_steps: 100,
    save_total_limit: 2,
    evaluation_strategy: 'no',  // ORPO typically doesn't use eval
    packing: false
  },
  data: {
    strategy: 'manual_templates',
    generation_type: 'synthetic',
    max_samples: undefined,
    train_split: 0.8,
    dataset_format: 'dpo'  // Uses same format as DPO (chosen/rejected)
  },
  evaluation: {
    metrics: ['preference_accuracy', 'response_quality'],
    eval_steps: 100
  },
  tensorboard: {
    enabled: true,
    log_dir: 'outputs/runs'
  },
  seed: 42
};

/**
 * CPT (Continued Pre-Training) Standard Template
 *
 * Domain adaptation training on raw text using causal language modeling.
 * Used to adapt base models to specific domains before instruction fine-tuning.
 *
 * Key Parameters:
 * - Lower learning rate (2e-5) for stable adaptation
 * - Longer sequences (4096) to capture domain context
 * - Packing enabled for efficiency with raw text
 * - Raw text format (simple text strings, no conversations)
 *
 * Use Cases: Medical, legal, finance, research papers, enterprise knowledge bases
 * Workflow: Base Model -> CPT -> SFT -> DPO -> Production
 */
export const CPT_STANDARD_TEMPLATE: TrainingConfig = {
  model: {
    name: 'meta-llama/Llama-3.2-1B',
    trust_remote_code: true,
    torch_dtype: 'bfloat16',
    device_map: 'auto'
  },
  tokenizer: {
    name: 'meta-llama/Llama-3.2-1B',
    trust_remote_code: true
  },
  training: {
    method: 'cpt',
    num_epochs: 1,
    learning_rate: 2e-5,
    batch_size: 4,
    gradient_accumulation_steps: 8,
    warmup_ratio: 0.03,
    warmup_steps: 100,
    max_length: 4096,
    use_lora: true,

    lora_r: 16,
    lora_alpha: 32,
    lora_dropout: 0.1,

    lora_config: {
      r: 16,
      lora_alpha: 32,
      lora_dropout: 0.1,
      target_modules: ["q_proj", "k_proj", "v_proj", "o_proj"],
      bias: "none",
      task_type: "CAUSAL_LM"
    },

    quantization: {
      load_in_4bit: true,
      bnb_4bit_quant_type: "nf4",
      bnb_4bit_compute_dtype: "bfloat16",
      bnb_4bit_use_double_quant: true
    },

    optim: "paged_adamw_8bit",
    gradient_checkpointing: true,
    fp16: false,
    bf16: true,
    max_grad_norm: 1.0,
    weight_decay: 0.01,
    lr_scheduler_type: 'cosine',

    dataloader_num_workers: 4,
    dataloader_prefetch_factor: 2,
    dataloader_pin_memory: true,
    group_by_length: false,
    eval_batch_size: 4,

    logging_steps: 10,
    eval_steps: 500,
    save_steps: 500,
    save_total_limit: 3,
    evaluation_strategy: 'steps',
    packing: true
  },
  data: {
    strategy: 'standard',
    generation_type: 'real',
    max_samples: undefined,
    train_split: 0.95,
    eval_split: 0.05,
    dataset_format: 'raw_text'
  }
};

// DEPRECATED - Old templates with non-performant settings (kept for reference only)
// DO NOT USE - Use SFT_STANDARD or DPO_STANDARD instead
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEPRECATED_TEMPLATES: Record<string, TrainingConfig> = {
  'sft_toolbench': SFT_TOOLBENCH_TEMPLATE,
  'sft_pc_building': SFT_PC_BUILDING_TEMPLATE,
  'dpo_basic': DPO_TEMPLATE,
  'teacher_mode': TEACHER_MODE_TEMPLATE,
  'knowledge_dense': KNOWLEDGE_DENSE_TEMPLATE,
  'alpaca_sft': ALPACA_SFT_TEMPLATE,
  'openorca_sft': OPENORCA_SFT_TEMPLATE,
  'unnatural_instructions': UNNATURAL_INSTRUCTIONS_TEMPLATE,
};

// ACTIVE TEMPLATES - Named by training method, not by GPU
export const ALL_TEMPLATES: Record<string, TrainingConfig> = {
  'sft_standard': SFT_STANDARD_TEMPLATE,
  'dpo_standard': DPO_STANDARD_TEMPLATE,
  'rlhf_standard': RLHF_STANDARD_TEMPLATE,
  'orpo_standard': ORPO_STANDARD_TEMPLATE,
  'cpt_standard': CPT_STANDARD_TEMPLATE
};

export function getTemplateByType(type: string): TrainingConfig | null {
  return ALL_TEMPLATES[type] || null;
}

export function getTemplateNames(): string[] {
  return Object.keys(ALL_TEMPLATES);
}

console.log('[TrainingTemplates] Loaded', Object.keys(ALL_TEMPLATES).length, 'templates');
