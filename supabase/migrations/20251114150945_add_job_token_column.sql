-- Migration: Add job_token column to local_training_jobs
-- Purpose: Enable secure API-based metrics reporting from training scripts
-- Date: 2025-11-14
-- Required for: RunPod/cloud training metrics integration

-- Add job_token column (nullable to support existing jobs)
ALTER TABLE local_training_jobs
ADD COLUMN IF NOT EXISTS job_token TEXT;

-- Add index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_local_training_jobs_job_token
ON local_training_jobs(job_token)
WHERE job_token IS NOT NULL;

-- Verify migration
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'local_training_jobs'
AND column_name = 'job_token';
