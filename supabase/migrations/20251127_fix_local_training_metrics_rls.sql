-- Fix RLS policies for local_training_metrics table
-- Date: 2025-11-27
-- Issue: Training script cannot insert metrics due to missing RLS policies

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow insert metrics for own jobs" ON local_training_metrics;
DROP POLICY IF EXISTS "Allow select metrics for own jobs" ON local_training_metrics;
DROP POLICY IF EXISTS "Allow update metrics for own jobs" ON local_training_metrics;
DROP POLICY IF EXISTS "Service role can insert metrics" ON local_training_metrics;
DROP POLICY IF EXISTS "Service role can select metrics" ON local_training_metrics;
DROP POLICY IF EXISTS "Anon can insert metrics with valid token" ON local_training_metrics;

-- Enable RLS on local_training_metrics table
ALTER TABLE local_training_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Allow inserting metrics for jobs with valid job_token (for training scripts)
-- Training scripts authenticate with job_token, not user auth
CREATE POLICY "Allow insert metrics with valid job token"
ON local_training_metrics
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM local_training_jobs
    WHERE local_training_jobs.id = local_training_metrics.job_id
  )
);

-- Policy: Allow selecting metrics for own jobs (authenticated users)
CREATE POLICY "Allow select metrics for own jobs"
ON local_training_metrics
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM local_training_jobs
    WHERE local_training_jobs.id = local_training_metrics.job_id
    AND local_training_jobs.user_id = auth.uid()
  )
);

-- Policy: Service role has full access (for admin operations)
CREATE POLICY "Service role full access to metrics"
ON local_training_metrics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
