-- Migration: Add scoring columns to training_predictions table
-- Purpose: Store quality metrics (exact_match, char_error_rate, etc.) for trend visualization
-- Date: 2025-12-09
-- Feature: Prediction trends & visualization
-- Related: predictions_writer.py already computes these scores but they were being silently dropped

-- Add scoring columns to training_predictions table
-- These are nullable because:
-- 1. Existing predictions don't have scores (backfill would be expensive)
-- 2. Predictions without ground_truth cannot be scored
-- 3. Python code already handles null scores gracefully
ALTER TABLE training_predictions
  ADD COLUMN IF NOT EXISTS exact_match DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS char_error_rate DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS length_ratio DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS word_overlap DOUBLE PRECISION;

-- Add comment explaining score semantics
COMMENT ON COLUMN training_predictions.exact_match IS 'Binary exact match: 1.0 = perfect match, 0.0 = no match. NULL if no ground_truth.';
COMMENT ON COLUMN training_predictions.char_error_rate IS 'Character-level error rate: 0.0 = perfect, 1.0 = completely wrong. NULL if no ground_truth.';
COMMENT ON COLUMN training_predictions.length_ratio IS 'prediction_length / ground_truth_length. NULL if no ground_truth.';
COMMENT ON COLUMN training_predictions.word_overlap IS 'Word-level overlap score: 0.0 to 1.0. NULL if no ground_truth.';

-- Create index for efficient epoch-level aggregations
-- This index is used by the /trends endpoint to compute avg/min/max scores per epoch
-- WHERE clause makes this a partial index (only rows with scores), saving space
CREATE INDEX IF NOT EXISTS idx_training_predictions_job_epoch_scores
  ON training_predictions(job_id, epoch)
  WHERE exact_match IS NOT NULL;

-- Verify migration: Check that columns were added with correct types
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'training_predictions'
  AND column_name IN ('exact_match', 'char_error_rate', 'length_ratio', 'word_overlap')
ORDER BY ordinal_position;

-- Verify index was created
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'training_predictions'
  AND indexname = 'idx_training_predictions_job_epoch_scores';
