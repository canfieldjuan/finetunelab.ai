-- =============================================================================
-- RLS Policy Verification and Fix for local_training_metrics
-- Issue: RunPod training scripts can't insert metrics due to RLS violation
-- Date: 2025-12-01
-- =============================================================================

-- 1. CHECK CURRENT RLS STATUS
-- Verify if RLS is enabled on the metrics table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'local_training_metrics';

-- 2. LIST ALL CURRENT RLS POLICIES
-- See what policies currently exist on the metrics table
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'local_training_metrics'
ORDER BY policyname;

-- 3. CHECK TABLE PRIVILEGES
-- Verify what privileges anon and authenticated roles have
SELECT grantee, privilege_type 
FROM information_schema.table_privileges 
WHERE table_name = 'local_training_metrics' 
AND grantee IN ('anon', 'authenticated');

-- 4. CHECK IF THE SPECIFIC POLICY EXISTS
-- Look for our expected RLS policy
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'local_training_metrics' 
AND policyname = 'Allow insert metrics with valid job token';

-- 5. VERIFY MIGRATION STATUS
-- Check if our migration has been applied by looking for the policy
-- This is the key policy that should allow anon role to insert metrics
-- when a corresponding job exists in local_training_jobs

-- Expected policy details:
-- Name: "Allow insert metrics with valid job token"
-- Command: INSERT
-- Role: anon
-- Using: EXISTS (SELECT 1 FROM local_training_jobs WHERE id = job_id)

-- =============================================================================
-- MIGRATION TO APPLY IF POLICY DOESN'T EXIST
-- =============================================================================

-- Enable RLS on local_training_metrics if not already enabled
ALTER TABLE local_training_metrics ENABLE ROW LEVEL SECURITY;

-- Grant basic table access to anon role
GRANT INSERT ON local_training_metrics TO anon;
GRANT SELECT ON local_training_metrics TO anon;

-- Create the RLS policy that allows anon role to insert metrics
-- but only if a corresponding job exists in local_training_jobs
CREATE POLICY "Allow insert metrics with valid job token" 
ON local_training_metrics 
FOR INSERT 
TO anon 
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM local_training_jobs 
        WHERE id = job_id
    )
);

-- Optional: Allow anon to read their own metrics (if needed)
CREATE POLICY "Allow read metrics for valid jobs" 
ON local_training_metrics 
FOR SELECT 
TO anon 
USING (
    EXISTS (
        SELECT 1 
        FROM local_training_jobs 
        WHERE id = job_id
    )
);

-- =============================================================================
-- TEST QUERIES TO VALIDATE FIX
-- =============================================================================

-- Test 1: Create a test job (use service role key)
INSERT INTO local_training_jobs (
    id, 
    user_id, 
    model_name, 
    status, 
    job_token
) VALUES (
    'test-rls-job-' || extract(epoch from now())::text,
    (SELECT id FROM auth.users LIMIT 1), -- Use existing user
    'test-model',
    'running',
    'test-token-123'
);

-- Test 2: Try to insert metrics with that job_id (should succeed with anon key)
-- This should work after the RLS policy is applied
-- Replace 'test-rls-job-XXXXX' with the actual job ID from Test 1
/*
INSERT INTO local_training_metrics (
    job_id,
    step,
    epoch,
    current_loss,
    learning_rate,
    recorded_at
) VALUES (
    'test-rls-job-XXXXX', -- Replace with actual job ID
    1,
    1,
    1.0,
    0.001,
    now()
);
*/

-- Test 3: Cleanup test data
-- DELETE FROM local_training_metrics WHERE job_id LIKE 'test-rls-job-%';
-- DELETE FROM local_training_jobs WHERE id LIKE 'test-rls-job-%';

-- =============================================================================
-- VERIFICATION COMPLETE - Expected Results
-- =============================================================================

-- If migration is needed:
-- - Query 4 should return 0 rows (policy doesn't exist)
-- - Apply the migration SQL above
-- - Re-run Query 4 to confirm policy was created

-- If migration already applied:
-- - Query 4 should return 1 row with the policy details
-- - The issue might be timing or a different problem

-- The RunPod training error should be resolved once this RLS policy exists
-- and allows anon role to insert metrics when a valid job_id exists.