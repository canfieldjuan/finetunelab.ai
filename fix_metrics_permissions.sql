-- FIX: Enable metrics updates from training scripts using job_token
-- Date: 2025-11-25
-- Purpose: Allow anonymous role to update metrics with valid job_token
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"

-- Step 1: Grant UPDATE permission on metrics columns to anon role
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

-- Step 2: Create RLS policy to allow updates only with valid job_token
DO $$
BEGIN
  -- Drop the policy if it exists (to make this idempotent)
  DROP POLICY IF EXISTS "Allow metrics updates with valid job_token" ON local_training_jobs;

  -- Create the policy
  CREATE POLICY "Allow metrics updates with valid job_token"
  ON local_training_jobs
  FOR UPDATE
  TO anon, authenticated
  USING (job_token IS NOT NULL)
  WITH CHECK (job_token IS NOT NULL);

  RAISE NOTICE '✅ Policy created successfully';
END $$;

-- Step 3: Verify the policy was created
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'local_training_jobs'
AND policyname = 'Allow metrics updates with valid job_token';
