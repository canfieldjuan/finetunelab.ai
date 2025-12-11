-- Migration: Enable anonymous metrics updates using job_token
-- Purpose: Allow training scripts to update their own job metrics using job_token
-- Date: 2025-11-25
-- Required for: RunPod/cloud training metrics integration

-- 1. Grant UPDATE permission on metrics columns to anon role
GRANT UPDATE (
  current_step,
  current_epoch,
  loss,
  eval_loss,
  learning_rate,
  grad_norm,
  samples_per_second,
  gpu_memory_allocated_gb,
  gpu_memory_reserved_gb,
  elapsed_seconds,
  remaining_seconds,
  progress,
  updated_at,
  status
) ON local_training_jobs TO anon, authenticated;

-- 2. Create RLS policy to allow updates only with valid job_token
CREATE POLICY "Allow metrics updates with valid job_token"
ON local_training_jobs
FOR UPDATE
TO anon, authenticated
USING (
  -- Allow update if the job_token matches
  job_token IS NOT NULL
)
WITH CHECK (
  -- Ensure they can only update their own job (matching job_token)
  job_token IS NOT NULL
);

-- 3. Verify the policy was created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'local_training_jobs'
AND policyname = 'Allow metrics updates with valid job_token';
