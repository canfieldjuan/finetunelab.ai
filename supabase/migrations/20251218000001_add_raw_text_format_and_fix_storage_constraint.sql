-- Add raw_text format support and fix storage constraints
-- Date: 2025-12-18
-- Purpose: Support CPT (Continued Pre-Training) with raw_text format

-- Step 1: Drop ALL existing constraints FIRST (before any data modifications)
ALTER TABLE training_datasets
DROP CONSTRAINT IF EXISTS training_datasets_format_check;

ALTER TABLE training_datasets
DROP CONSTRAINT IF EXISTS storage_consistency_check;

ALTER TABLE training_datasets
DROP CONSTRAINT IF EXISTS check_storage_provider;

ALTER TABLE training_datasets
DROP CONSTRAINT IF EXISTS training_datasets_storage_provider_check;

-- Step 2: Fix ALL existing rows that might violate future constraints
-- (Safe to do now since constraints are dropped)

-- CRITICAL: Migrate old 'finetunelab' storage_provider to 'supabase'
-- All existing datasets with 'finetunelab' are actually stored in Supabase
UPDATE training_datasets
SET storage_provider = 'supabase'
WHERE storage_provider = 'finetunelab' OR storage_provider NOT IN ('supabase', 's3');

-- Fix rows with NULL storage_path (should not exist, but just in case)
UPDATE training_datasets
SET storage_path = user_id || '/private/' || id || '.jsonl.gz'
WHERE storage_path IS NULL;

-- Fix Supabase rows with incorrect path format
UPDATE training_datasets
SET storage_path = user_id || '/private/' || id || '.jsonl.gz'
WHERE storage_provider = 'supabase'
  AND storage_path NOT LIKE '%/private/%';

-- Fix S3 rows with incorrect path format
UPDATE training_datasets
SET storage_path = 'datasets/' || user_id || '/' || id
WHERE storage_provider = 's3'
  AND storage_path NOT LIKE 'datasets/%';

-- Step 3: Add new format check constraint with raw_text included
ALTER TABLE training_datasets
ADD CONSTRAINT training_datasets_format_check
CHECK (format IN ('chatml', 'sharegpt', 'jsonl', 'dpo', 'rlhf', 'alpaca', 'openorca', 'unnatural', 'raw_text'));

-- Step 4: Add storage_provider check constraint
-- This ensures storage_provider is only 'supabase' or 's3'
ALTER TABLE training_datasets
ADD CONSTRAINT check_storage_provider
CHECK (storage_provider IN ('supabase', 's3'));

-- Step 5: Add storage consistency check constraint
-- This ensures that storage_path is not null and matches the storage_provider format
ALTER TABLE training_datasets
ADD CONSTRAINT storage_consistency_check
CHECK (
  storage_path IS NOT NULL AND
  (
    -- For Supabase: path should contain /private/
    (storage_provider = 'supabase' AND storage_path LIKE '%/private/%') OR
    -- For S3: path should start with datasets/
    (storage_provider = 's3' AND storage_path LIKE 'datasets/%')
  )
);

-- Step 6: Update column comments
COMMENT ON COLUMN training_datasets.format IS 'Dataset format: chatml, sharegpt, jsonl, dpo, rlhf, alpaca, openorca, unnatural, or raw_text';
COMMENT ON COLUMN training_datasets.storage_provider IS 'Storage provider for dataset: supabase or s3';
COMMENT ON CONSTRAINT storage_consistency_check ON training_datasets IS 'Ensures storage_path format matches storage_provider type';
