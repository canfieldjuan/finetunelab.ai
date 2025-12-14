-- Migration: Add validation result columns to training_predictions
-- Purpose: Persist per-prediction validator pass/fail and structured error details
-- Date: 2025-12-12

ALTER TABLE training_predictions
  ADD COLUMN IF NOT EXISTS validation_pass BOOLEAN,
  ADD COLUMN IF NOT EXISTS validation_errors JSONB,
  ADD COLUMN IF NOT EXISTS validation_kind TEXT;

COMMENT ON COLUMN training_predictions.validation_pass IS 'True if all enabled validators passed, false if any failed. NULL if validation not run.';
COMMENT ON COLUMN training_predictions.validation_errors IS 'Structured validator errors. NULL if validation not run or no errors.';
COMMENT ON COLUMN training_predictions.validation_kind IS 'Validator mode/kind used (e.g., json_parse, json_schema).';

-- Index to support epoch-level pass rate queries
CREATE INDEX IF NOT EXISTS idx_training_predictions_job_epoch_validation
  ON training_predictions(job_id, epoch)
  WHERE validation_pass IS NOT NULL;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'training_predictions'
  AND column_name IN ('validation_pass', 'validation_errors', 'validation_kind')
ORDER BY column_name;
