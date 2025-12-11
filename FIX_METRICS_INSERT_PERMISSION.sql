-- ============================================================================
-- FIX METRICS INSERT PERMISSION
-- ============================================================================
-- Purpose: Allow training scripts to INSERT into local_training_metrics
--          This enables realtime charts in the training monitor UI
-- Date: 2025-11-25
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this ENTIRE file
-- 3. Click "RUN"
-- ============================================================================

-- Grant INSERT permission on local_training_metrics to anon role
-- Training scripts use anon role with job_token for authentication
GRANT INSERT ON local_training_metrics TO anon, authenticated;

-- Create RLS policy to allow inserts with valid job reference
-- First drop if exists to avoid conflicts
DROP POLICY IF EXISTS "Allow anon to insert metrics for valid jobs" ON local_training_metrics;

CREATE POLICY "Allow anon to insert metrics for valid jobs"
ON local_training_metrics
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM local_training_jobs
    WHERE local_training_jobs.id = job_id
    AND local_training_jobs.job_token IS NOT NULL
  )
);

-- Also ensure SELECT is allowed for realtime subscriptions
GRANT SELECT ON local_training_metrics TO anon, authenticated;

-- Verify realtime is enabled for this table
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE local_training_metrics;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  ALTER PUBLICATION supabase_realtime ADD TABLE local_training_metrics;
END $$;

ALTER TABLE local_training_metrics REPLICA IDENTITY FULL;

-- ============================================================================
-- Expected Result: "Success. No rows returned"
-- ============================================================================
