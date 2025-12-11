-- Migration: Add best checkpoint tracking columns to local_training_jobs
-- Purpose: Enable multi-metric checkpoint scoring and best model tracking
-- Date: 2025-12-07
-- Required for: RunPod multi-metric checkpoint scorer

-- Add best checkpoint score column (multi-metric score, lower = better)
ALTER TABLE local_training_jobs
ADD COLUMN IF NOT EXISTS best_checkpoint_score DOUBLE PRECISION;

-- Add best checkpoint step (global training step when best checkpoint was saved)
ALTER TABLE local_training_jobs
ADD COLUMN IF NOT EXISTS best_checkpoint_step INTEGER;

-- Add best checkpoint epoch (training epoch when best checkpoint was saved)
ALTER TABLE local_training_jobs
ADD COLUMN IF NOT EXISTS best_checkpoint_epoch INTEGER;

-- Add best eval loss (evaluation loss of best checkpoint)
ALTER TABLE local_training_jobs
ADD COLUMN IF NOT EXISTS best_eval_loss DOUBLE PRECISION;

-- Add index for querying best checkpoints
CREATE INDEX IF NOT EXISTS idx_local_training_jobs_best_checkpoint_score
ON local_training_jobs(best_checkpoint_score)
WHERE best_checkpoint_score IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN local_training_jobs.best_checkpoint_score IS 'Multi-metric score (50% eval_loss + 30% gap_penalty + 10% perplexity + 10% improvement_bonus). Lower = better.';
COMMENT ON COLUMN local_training_jobs.best_checkpoint_step IS 'Global training step when best checkpoint was identified';
COMMENT ON COLUMN local_training_jobs.best_checkpoint_epoch IS 'Training epoch when best checkpoint was identified';
COMMENT ON COLUMN local_training_jobs.best_eval_loss IS 'Evaluation loss of the best checkpoint';

-- Verify migration
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'local_training_jobs'
AND column_name IN ('best_checkpoint_score', 'best_checkpoint_step', 'best_checkpoint_epoch', 'best_eval_loss')
ORDER BY column_name;
