-- Migration: Add loss trend and eval improvement tracking columns
-- Purpose: Track loss trends and eval loss improvements for better training insights
-- Date: 2025-12-19
-- Required for: Enhanced training metrics display

-- Add columns to local_training_metrics table (individual metric points)
ALTER TABLE local_training_metrics
ADD COLUMN IF NOT EXISTS loss_trend TEXT;

ALTER TABLE local_training_metrics
ADD COLUMN IF NOT EXISTS best_eval_loss DOUBLE PRECISION;

ALTER TABLE local_training_metrics
ADD COLUMN IF NOT EXISTS best_epoch INTEGER;

ALTER TABLE local_training_metrics
ADD COLUMN IF NOT EXISTS best_step INTEGER;

ALTER TABLE local_training_metrics
ADD COLUMN IF NOT EXISTS epochs_without_improvement INTEGER;

-- Add columns to local_training_jobs table (job summary)
ALTER TABLE local_training_jobs
ADD COLUMN IF NOT EXISTS loss_trend TEXT;

ALTER TABLE local_training_jobs
ADD COLUMN IF NOT EXISTS epochs_without_improvement INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN local_training_metrics.loss_trend IS 'Loss trend analysis: improving, degrading, stable, or insufficient_data';
COMMENT ON COLUMN local_training_metrics.best_eval_loss IS 'Best evaluation loss observed so far';
COMMENT ON COLUMN local_training_metrics.best_epoch IS 'Epoch when best eval loss was observed';
COMMENT ON COLUMN local_training_metrics.best_step IS 'Step when best eval loss was observed';
COMMENT ON COLUMN local_training_metrics.epochs_without_improvement IS 'Number of epochs without eval loss improvement';

COMMENT ON COLUMN local_training_jobs.loss_trend IS 'Latest loss trend analysis';
COMMENT ON COLUMN local_training_jobs.epochs_without_improvement IS 'Latest count of epochs without improvement';

-- Verify migration
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'local_training_metrics'
AND column_name IN ('loss_trend', 'best_eval_loss', 'best_epoch', 'best_step', 'epochs_without_improvement')
ORDER BY column_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'local_training_jobs'
AND column_name IN ('loss_trend', 'epochs_without_improvement')
ORDER BY column_name;
