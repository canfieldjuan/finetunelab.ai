-- Migration: Add generation metadata columns to training_predictions
-- Purpose: Improve reproducibility/debuggability (token counts, latency, generation params)
-- Date: 2025-12-12

ALTER TABLE training_predictions
  ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS completion_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS total_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS max_new_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS do_sample BOOLEAN;

COMMENT ON COLUMN training_predictions.prompt_tokens IS 'Number of input tokens for the sampled prompt/messages.';
COMMENT ON COLUMN training_predictions.completion_tokens IS 'Number of generated tokens for the prediction.';
COMMENT ON COLUMN training_predictions.total_tokens IS 'prompt_tokens + completion_tokens.';
COMMENT ON COLUMN training_predictions.latency_ms IS 'Wall-clock latency (ms) for generation of this prediction.';
COMMENT ON COLUMN training_predictions.max_new_tokens IS 'max_new_tokens used for generation (from PREDICTIONS_MAX_LENGTH).';
COMMENT ON COLUMN training_predictions.do_sample IS 'Whether generation used sampling.';

-- Optional index to support sorting/filtering by performance over time
CREATE INDEX IF NOT EXISTS idx_training_predictions_job_epoch_latency
  ON training_predictions(job_id, epoch)
  WHERE latency_ms IS NOT NULL;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'training_predictions'
  AND column_name IN (
    'prompt_tokens', 'completion_tokens', 'total_tokens',
    'latency_ms', 'max_new_tokens', 'do_sample'
  )
ORDER BY column_name;
