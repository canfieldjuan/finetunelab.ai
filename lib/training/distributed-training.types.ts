/**
 * Distributed Training Configuration Types
 *
 * Defines multi-GPU training strategies for distributed training
 * Phase 0: Type definitions only - NO RUNTIME CODE
 * Date: 2025-11-02
 *
 * Supported Strategies:
 * - DDP (Distributed Data Parallel): Simple, works with most models
 * - FSDP (Fully Sharded Data Parallel): Shards model across GPUs for memory efficiency
 * - DeepSpeed ZeRO: Advanced optimization with CPU offloading
 */

/**
 * Distributed training strategy options
 * - none: Single GPU, no distributed training
 * - ddp: PyTorch Distributed Data Parallel
 * - fsdp: PyTorch Fully Sharded Data Parallel
 * - deepspeed: DeepSpeed ZeRO optimization
 */
export type DistributedStrategy = 'none' | 'ddp' | 'fsdp' | 'deepspeed';

/**
 * Base configuration for distributed training
 * All distributed strategies extend this interface
 */
export interface BaseDistributedConfig {
  /** Number of GPUs to use (1 = single GPU, >1 = multi-GPU) */
  num_gpus: number;

  /** Distributed training strategy to use */
  strategy: DistributedStrategy;
}

/**
 * DDP (Distributed Data Parallel) Configuration
 * Recommended for: Small to medium models (<13B parameters)
 * GPU Requirements: 2-8 GPUs
 */
export interface DDPConfig extends BaseDistributedConfig {
  strategy: 'ddp';

  /** Use gradient as bucket view for memory efficiency */
  gradient_as_bucket_view?: boolean;

  /** Enable static graph optimization */
  static_graph?: boolean;
}

/**
 * FSDP (Fully Sharded Data Parallel) Configuration
 * Recommended for: Large models (13B-70B parameters)
 * GPU Requirements: 4+ GPUs
 */
export interface FSDPConfig extends BaseDistributedConfig {
  strategy: 'fsdp';

  /** Sharding strategy for model parameters */
  sharding_strategy?: 'full_shard' | 'shard_grad_op' | 'no_shard' | 'hybrid_shard';

  /** Offload parameters to CPU to save GPU memory */
  cpu_offload?: boolean;

  /** Backward prefetch strategy for efficiency */
  backward_prefetch?: 'backward_pre' | 'backward_post';
}

/**
 * DeepSpeed ZeRO Configuration
 * Recommended for: Very large models (70B+ parameters)
 * GPU Requirements: 8+ GPUs
 */
export interface DeepSpeedConfig extends BaseDistributedConfig {
  strategy: 'deepspeed';

  /** ZeRO optimization stage (0-3, higher = more memory savings) */
  zero_stage?: 0 | 1 | 2 | 3;

  /** Offload optimizer states to CPU memory */
  offload_optimizer?: boolean;

  /** Offload model parameters to CPU or NVMe */
  offload_param?: boolean;

  /** Path to custom DeepSpeed configuration JSON file */
  config_file?: string;
}

/**
 * Union type for all distributed training configurations
 * Used in training config to allow any distributed strategy
 */
export type DistributedConfig =
  | BaseDistributedConfig
  | DDPConfig
  | FSDPConfig
  | DeepSpeedConfig;

console.log('[DistributedTrainingTypes] Type definitions loaded');

