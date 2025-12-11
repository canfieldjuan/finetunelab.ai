-- Migration: Add metadata column to local_training_jobs
-- Purpose: Store additional job metadata (HF upload status, model info, etc.)
-- Date: 2025-12-07
-- Required for: Training job metadata tracking

-- Add metadata column (JSONB for flexible metadata storage)
ALTER TABLE local_training_jobs
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for metadata queries
CREATE INDEX IF NOT EXISTS idx_local_training_jobs_metadata
ON local_training_jobs USING GIN (metadata);

-- Add comment for documentation
COMMENT ON COLUMN local_training_jobs.metadata IS 'Flexible JSONB storage for job metadata (HF upload status, model info, training details, etc.)';

-- Verify migration
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'local_training_jobs'
AND column_name = 'metadata';
