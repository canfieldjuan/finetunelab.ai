-- Apply metadata column migration to Supabase
-- Run this in Supabase SQL Editor

ALTER TABLE training_datasets
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_training_datasets_metadata 
ON training_datasets USING gin(metadata);

COMMENT ON COLUMN training_datasets.metadata IS 'Format detection and normalization metadata including original_format, normalized flag, normalization_date, and errors';

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'training_datasets'
AND column_name = 'metadata';
