-- Fix local_training_metrics realtime subscription
-- Issue: Complex RLS policies with EXISTS can cause CHANNEL_ERROR for realtime
-- Solution: Add a simpler policy that checks the filter directly

-- Add policy allowing authenticated users to see metrics for jobs they can access
-- This is simpler than the EXISTS subquery and works better with realtime
DO $$
BEGIN
  -- Drop if exists, then create
  DROP POLICY IF EXISTS "Allow realtime metrics for authenticated users" ON local_training_metrics;

  CREATE POLICY "Allow realtime metrics for authenticated users"
  ON local_training_metrics
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if the user owns the job
    job_id IN (
      SELECT id FROM local_training_jobs
      WHERE user_id = auth.uid()
    )
  );
END $$;

-- Verify the policy was created
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'local_training_metrics'
AND policyname = 'Allow realtime metrics for authenticated users';
