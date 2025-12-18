-- Add raw_text format support and storage constraints (step-by-step approach)
-- Date: 2025-12-18
-- Purpose: Support CPT with diagnostic steps

-- Step 1: Drop existing constraints
ALTER TABLE training_datasets DROP CONSTRAINT IF EXISTS training_datasets_format_check;
ALTER TABLE training_datasets DROP CONSTRAINT IF EXISTS storage_consistency_check;

-- Step 2: Add format constraint (this should always work)
ALTER TABLE training_datasets
ADD CONSTRAINT training_datasets_format_check
CHECK (format IN ('chatml', 'sharegpt', 'jsonl', 'dpo', 'rlhf', 'alpaca', 'openorca', 'unnatural', 'raw_text'));

-- Step 3: Show which rows would violate storage constraint (for debugging)
DO $$
DECLARE
  violation_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO violation_count
  FROM training_datasets
  WHERE
    storage_path IS NULL
    OR storage_provider IS NULL
    OR storage_provider NOT IN ('supabase', 's3')
    OR (storage_provider = 'supabase' AND storage_path NOT LIKE '%/private/%')
    OR (storage_provider = 's3' AND storage_path NOT LIKE 'datasets/%');

  IF violation_count > 0 THEN
    RAISE NOTICE 'Found % rows that violate storage constraint', violation_count;
    RAISE NOTICE 'Run this query to see details: SELECT id, storage_provider, storage_path FROM training_datasets WHERE storage_path IS NULL OR storage_provider IS NULL OR storage_provider NOT IN (''supabase'', ''s3'') OR (storage_provider = ''supabase'' AND storage_path NOT LIKE ''%%/private/%%'') OR (storage_provider = ''s3'' AND storage_path NOT LIKE ''datasets/%%'')';
  ELSE
    RAISE NOTICE 'No constraint violations found - safe to add constraint';
  END IF;
END $$;

-- Step 4: Fix any problematic rows
UPDATE training_datasets SET storage_path = user_id || '/private/' || id || '.jsonl.gz' WHERE storage_path IS NULL;
UPDATE training_datasets SET storage_path = user_id || '/private/' || id || '.jsonl.gz' WHERE storage_provider = 'supabase' AND storage_path NOT LIKE '%/private/%';
UPDATE training_datasets SET storage_path = 'datasets/' || user_id || '/' || id WHERE storage_provider = 's3' AND storage_path NOT LIKE 'datasets/%';

-- Step 5: Try to add constraint (will fail if rows still violate it)
ALTER TABLE training_datasets
ADD CONSTRAINT storage_consistency_check
CHECK (
  storage_path IS NOT NULL AND
  (
    (storage_provider = 'supabase' AND storage_path LIKE '%/private/%') OR
    (storage_provider = 's3' AND storage_path LIKE 'datasets/%')
  )
);

-- Step 6: Update comments
COMMENT ON COLUMN training_datasets.format IS 'Dataset format: chatml, sharegpt, jsonl, dpo, rlhf, alpaca, openorca, unnatural, or raw_text';
COMMENT ON CONSTRAINT storage_consistency_check ON training_datasets IS 'Ensures storage_path format matches storage_provider type';
