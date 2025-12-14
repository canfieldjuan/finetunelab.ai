-- Migration: Add stable identity columns to training_predictions
-- Purpose: Make predictions comparable across runs by persisting stable prompt identifiers and source indices
-- Date: 2025-12-12
-- Feature: Developer-value upgrades for training eval predictions

ALTER TABLE training_predictions
  ADD COLUMN IF NOT EXISTS prompt_id TEXT,
  ADD COLUMN IF NOT EXISTS source_index INTEGER,
  ADD COLUMN IF NOT EXISTS sample_source TEXT,
  ADD COLUMN IF NOT EXISTS sample_source_id TEXT;

-- Indexes to support common queries (optional columns; keep indexes partial)
CREATE INDEX IF NOT EXISTS idx_training_predictions_job_prompt_id
  ON training_predictions(job_id, prompt_id)
  WHERE prompt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_training_predictions_job_source
  ON training_predictions(job_id, sample_source, sample_source_id)
  WHERE sample_source IS NOT NULL;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'training_predictions'
  AND column_name IN ('prompt_id', 'source_index', 'sample_source', 'sample_source_id')
ORDER BY column_name;
