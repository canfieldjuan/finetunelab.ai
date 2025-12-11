/**
 * Checkpoint Types
 *
 * TypeScript types for training checkpoint data
 *
 * Phase: Checkpoint Selection Feature
 * Date: 2025-10-31
 */

export interface TrainingCheckpoint {
  /** Checkpoint directory name (e.g., "checkpoint-epoch-3-step-1500") */
  path: string;

  /** Epoch number when checkpoint was saved */
  epoch?: number;

  /** Training step number when checkpoint was saved */
  step?: number;

  /** Evaluation loss at this checkpoint (lower is better) */
  eval_loss?: number;

  /** Training loss at this checkpoint */
  train_loss?: number;

  /** Perplexity score (if available) */
  perplexity?: number;

  /** Total size of checkpoint files in bytes */
  size_bytes?: number;

  /** ISO timestamp when checkpoint was created */
  created_at?: string;

  /** True if this is the best checkpoint (lowest eval_loss) */
  is_best: boolean;

  /** True if this is the latest/most recent checkpoint */
  is_latest: boolean;
}

export interface CheckpointListResponse {
  /** Success status */
  success: boolean;

  /** Job ID */
  job_id: string;

  /** Array of available checkpoints */
  checkpoints: TrainingCheckpoint[];

  /** Path of the best checkpoint (lowest eval_loss) */
  best_checkpoint?: string;

  /** Error message if request failed */
  error?: string;

  /** Additional message (e.g., "No checkpoints available yet") */
  message?: string;
}
