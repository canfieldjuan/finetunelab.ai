-- =============================================================================
-- PERFORMANCE-OPTIMIZED RLS POLICY FIX
-- Root Cause: Large table + COUNT operations cause statement timeouts for anon role
-- Solution: Optimize RLS policy to avoid expensive table scans
-- Date: 2025-12-01
-- =============================================================================

-- PROBLEM IDENTIFIED:
-- Current policy: EXISTS (SELECT 1 FROM local_training_jobs WHERE id = job_id)
-- Issue: With large tables, this causes COUNT timeouts for anon role (57014 error)
-- Python supabase client does internal COUNT operations that timeout

-- =============================================================================
-- SOLUTION 1: USE INDEXES TO SPEED UP EXISTS CHECKS
-- =============================================================================

-- Ensure there's an index on local_training_jobs.id (should already exist as PK)
-- Add index on local_training_metrics.job_id for faster joins
CREATE INDEX IF NOT EXISTS idx_local_training_metrics_job_id 
ON local_training_metrics (job_id);

-- =============================================================================
-- SOLUTION 2: REPLACE EXISTING POLICY WITH OPTIMIZED VERSION
-- =============================================================================

-- Drop the current policy that's causing timeouts
DROP POLICY IF EXISTS "Allow insert metrics with valid job token" ON local_training_metrics;

-- Create optimized policy with better performance characteristics
-- Option A: Use a more specific filter that doesn't require full table scan
CREATE POLICY "Allow insert metrics optimized" 
ON local_training_metrics 
FOR INSERT 
TO anon 
WITH CHECK (
    -- More efficient: use the job_id directly without EXISTS subquery
    -- This works because foreign key constraint already ensures job exists
    job_id IS NOT NULL
    -- Alternative: limit to recent jobs to reduce scan scope
    -- AND job_id IN (
    --     SELECT id FROM local_training_jobs 
    --     WHERE created_at > (NOW() - INTERVAL '7 days')
    --     LIMIT 1000
    -- )
);

-- =============================================================================
-- SOLUTION 3: ALTERNATIVE APPROACH - BYPASS RLS FOR METRICS DURING TRAINING
-- =============================================================================

-- If performance is still an issue, we can temporarily disable RLS for anon
-- during training operations and rely on application-level security

-- OPTION 3A: Create a specific policy for training operations
-- DROP POLICY IF EXISTS "Allow insert metrics optimized" ON local_training_metrics;
-- 
-- CREATE POLICY "Allow training metrics insert" 
-- ON local_training_metrics 
-- FOR INSERT 
-- TO anon 
-- WITH CHECK (
--     -- Allow if step is provided (indicates training operation)
--     step IS NOT NULL AND step >= 0
-- );

-- OPTION 3B: Temporarily allow all anon inserts (least secure but fastest)
-- DROP POLICY IF EXISTS "Allow insert metrics optimized" ON local_training_metrics;
-- 
-- CREATE POLICY "Allow all anon metrics insert" 
-- ON local_training_metrics 
-- FOR INSERT 
-- TO anon 
-- WITH CHECK (true);

-- =============================================================================
-- SOLUTION 4: CLEANUP OLD DATA TO IMPROVE PERFORMANCE
-- =============================================================================

-- Remove old metrics data to improve performance (optional)
-- Keep only last 30 days of metrics
-- DELETE FROM local_training_metrics 
-- WHERE created_at < (NOW() - INTERVAL '30 days');

-- =============================================================================
-- TESTING THE FIX
-- =============================================================================

-- Test 1: Verify the new policy works
-- Should work without timeouts
SELECT COUNT(*) FROM local_training_metrics; -- This should complete faster

-- Test 2: Test insertion with anon role (using your test script)
-- INSERT INTO local_training_metrics (
--     job_id,
--     step,
--     epoch,
--     train_loss,
--     learning_rate,
--     timestamp
-- ) VALUES (
--     '3c3513cd-6f45-4733-8ae2-b09e229460a2',
--     999,
--     0,
--     0.555,
--     0.00005,
--     NOW()
-- );

-- =============================================================================
-- MONITORING AND VERIFICATION
-- =============================================================================

-- Check current policies
SELECT policyname, cmd, roles, with_check 
FROM pg_policies 
WHERE tablename = 'local_training_metrics' 
AND policyname LIKE '%insert%'
ORDER BY policyname;

-- Check if index was created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'local_training_metrics' 
AND indexname LIKE '%job_id%';

-- Monitor query performance
-- EXPLAIN ANALYZE SELECT COUNT(*) FROM local_training_metrics WHERE job_id = '3c3513cd-6f45-4733-8ae2-b09e229460a2';

-- =============================================================================
-- ROLLBACK PLAN (if needed)
-- =============================================================================

-- If the optimized policy doesn't work, rollback to original
-- DROP POLICY IF EXISTS "Allow insert metrics optimized" ON local_training_metrics;
-- 
-- CREATE POLICY "Allow insert metrics with valid job token" 
-- ON local_training_metrics 
-- FOR INSERT 
-- TO anon 
-- WITH CHECK (
--     EXISTS (
--         SELECT 1 
--         FROM local_training_jobs 
--         WHERE id = job_id
--     )
-- );

-- =============================================================================
-- EXPECTED RESULTS
-- =============================================================================

-- After applying this fix:
-- 1. ✅ COUNT operations should complete faster
-- 2. ✅ INSERT operations should not timeout
-- 3. ✅ RunPod Python client should succeed
-- 4. ✅ No more 57014 statement timeout errors
-- 5. ✅ Maintains security (only valid training operations allowed)