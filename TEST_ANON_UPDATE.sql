-- Test if the RLS policy is working correctly for anon role updates
-- This tests the exact scenario the training pod uses

-- Step 1: Check current state
SELECT
  id,
  current_step,
  loss,
  progress,
  job_token IS NOT NULL as has_token,
  updated_at
FROM local_training_jobs
WHERE id = '1c85d0c2-1269-44c0-af19-6f5ccc6cea11';

-- Step 2: Test update using service_role (should always work)
-- This verifies the row can be updated at all
UPDATE local_training_jobs
SET
  current_step = 888,
  loss = 0.777,
  progress = 0.66,
  updated_at = NOW()
WHERE id = '1c85d0c2-1269-44c0-af19-6f5ccc6cea11';

-- Step 3: Verify update worked
SELECT
  id,
  current_step,
  loss,
  progress,
  updated_at
FROM local_training_jobs
WHERE id = '1c85d0c2-1269-44c0-af19-6f5ccc6cea11';

-- Step 4: Check the RLS policy that should allow anon updates
SELECT
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as using_check,
  with_check
FROM pg_policies
WHERE tablename = 'local_training_jobs'
AND policyname = 'Allow metrics updates with valid job_token';

-- Expected results:
-- Query 1: Shows current state (zeros)
-- Query 2: Updates as service_role (should succeed)
-- Query 3: Shows updated values (888, 0.777, 0.66)
-- Query 4: Shows the policy exists for anon role with UPDATE permission
--
-- If queries 1-3 work but the pod still can't update, the issue is:
-- - The anon role client is not matching the RLS policy USING clause
-- - Or the Python supabase client is not passing credentials correctly
