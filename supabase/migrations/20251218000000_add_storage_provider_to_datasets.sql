-- Add storage_provider column to training_datasets table
-- Date: 2025-12-18
-- Purpose: Support S3 and Supabase storage for datasets

-- Add storage_provider column with default 'supabase'
ALTER TABLE training_datasets
ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'supabase';

-- Add index for filtering datasets by user and storage provider
CREATE INDEX idx_training_datasets_storage_provider
ON training_datasets(user_id, storage_provider);

-- Add constraint to ensure valid storage provider values
ALTER TABLE training_datasets
ADD CONSTRAINT check_storage_provider
CHECK (storage_provider IN ('supabase', 's3'));

-- Add comment
COMMENT ON COLUMN training_datasets.storage_provider IS 'Storage provider for dataset: supabase or s3';
