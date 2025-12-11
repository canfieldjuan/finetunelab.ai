/**
 * Checkpoint Resume Configuration Types
 *
 * Defines configuration for resuming training from saved checkpoints
 * Phase 0: Type definitions only - NO RUNTIME CODE
 * Date: 2025-11-02
 *
 * Features:
 * - Resume from specific checkpoint path
 * - Resume from best checkpoint (lowest eval_loss)
 * - Resume from specific epoch/step
 * - Track runtime parameter modifications
 */

/**
 * Configuration for resuming training from a checkpoint
 * Used when submitting a new training job that continues from a previous run
 */
export interface CheckpointResumeConfig {
  /** Enable checkpoint resume functionality */
  enabled: boolean;

  /** Checkpoint directory path to resume from (e.g., "checkpoint-epoch-3-step-1500") */
  checkpoint_path?: string;

  /** Resume from the best checkpoint instead of latest */
  resume_from_best?: boolean;

  /** Resume from specific epoch number */
  resume_from_epoch?: number;

  /** Resume from specific step number */
  resume_from_step?: number;
}

/**
 * Runtime parameter modification record
 * Tracks changes made to training parameters while job is running
 */
export interface RuntimeParameterUpdate {
  /** New learning rate value */
  learning_rate?: number;

  /** New batch size (requires training loop restart) */
  batch_size?: number;

  /** New gradient accumulation steps */
  gradient_accumulation_steps?: number;

  /** New warmup steps */
  warmup_steps?: number;

  /** ISO timestamp when update was requested */
  requested_at: string;

  /** User ID who requested the update */
  requested_by: string;
}

console.log('[CheckpointResumeTypes] Type definitions loaded');

