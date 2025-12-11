-- Migration: Create training_predictions table
-- Purpose: Store model predictions on sample prompts during training (W&B-style)
-- Date: 2025-11-15
-- Feature: Training predictions tracking for quality visualization

-- Create training_predictions table
CREATE TABLE IF NOT EXISTS training_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  epoch INTEGER NOT NULL,
  step INTEGER NOT NULL,
  sample_index INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  ground_truth TEXT,
  prediction TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign key to local_training_jobs
  CONSTRAINT fk_training_predictions_job
    FOREIGN KEY (job_id)
    REFERENCES local_training_jobs(id)
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_predictions_job_id
  ON training_predictions(job_id);

CREATE INDEX IF NOT EXISTS idx_training_predictions_job_epoch
  ON training_predictions(job_id, epoch);

CREATE INDEX IF NOT EXISTS idx_training_predictions_user_id
  ON training_predictions(user_id);

-- Enable Row Level Security
ALTER TABLE training_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only select their own predictions
CREATE POLICY "Users can view their own predictions"
  ON training_predictions
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can only insert their own predictions
CREATE POLICY "Users can create their own predictions"
  ON training_predictions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can only delete their own predictions
CREATE POLICY "Users can delete their own predictions"
  ON training_predictions
  FOR DELETE
  USING (auth.uid() = user_id);

-- No UPDATE policy - predictions are immutable once created

-- Verify migration
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'training_predictions'
ORDER BY ordinal_position;
