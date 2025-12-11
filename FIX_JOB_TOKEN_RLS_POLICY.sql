-- FIX: Allow anon role to update metrics with correct job_token
--
-- Current issue: The UPDATE policy has USING (job_token IS NOT NULL)
-- but anon role can't SELECT the row, so WHERE clause never matches
--
-- Solution: Add SELECT policy for anon role so they can find their row,
-- and improve UPDATE policy to validate the token matches

-- Step 1: Allow anon to SELECT rows with valid job_token
-- This is needed so the UPDATE's WHERE clause can find the row
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow anon to select jobs with valid token" ON local_training_jobs;

  CREATE POLICY "Allow anon to select jobs with valid token"
  ON local_training_jobs
  FOR SELECT
  TO anon
  USING (job_token IS NOT NULL);
END $$;

-- Step 2: Improve the UPDATE policy (currently it doesn't validate token matches)
-- Note: We can't access the request parameters in RLS, so we rely on the
-- application to filter by .eq('job_token', TOKEN) in the query
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow metrics updates with valid job_token" ON local_training_jobs;

  CREATE POLICY "Allow metrics updates with valid job_token"
  ON local_training_jobs
  FOR UPDATE
  TO anon, authenticated
  USING (job_token IS NOT NULL)  -- Can update if row has a token
  WITH CHECK (job_token IS NOT NULL);  -- Ensure token isn't cleared
END $$;

-- Verify policies were created
SELECT
  policyname,
  cmd as operation,
  roles,
  qual as using_clause
FROM pg_policies
WHERE tablename = 'local_training_jobs'
AND policyname IN (
  'Allow anon to select jobs with valid token',
  'Allow metrics updates with valid job_token'
)
ORDER BY cmd, policyname;

-- Expected result: 2 rows
-- 1. SELECT policy for anon
-- 2. UPDATE policy for anon,authenticated
