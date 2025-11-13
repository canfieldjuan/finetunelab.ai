-- =============================================================================
-- FIX REALTIME POLICIES FOR TRAINING TABLES
-- =============================================================================
-- This creates the missing Realtime-specific policies
-- Run this in Supabase Dashboard > SQL Editor
-- =============================================================================

-- CRITICAL: If policies already exist, drop them first
DO $$
BEGIN
  -- Drop existing policies if they exist (ignore errors if they don't)
  DROP POLICY IF EXISTS "Enable realtime for authenticated users on local_training_jobs" ON local_training_jobs;
  DROP POLICY IF EXISTS "Enable realtime for service role on local_training_jobs" ON local_training_jobs;
  DROP POLICY IF EXISTS "Enable realtime for authenticated users on local_training_metrics" ON local_training_metrics;
  DROP POLICY IF EXISTS "Enable realtime for service role on local_training_metrics" ON local_training_metrics;
  
  -- Also drop any other training policies that might conflict
  DROP POLICY IF EXISTS "training_jobs_select_authenticated" ON local_training_jobs;
  DROP POLICY IF EXISTS "training_jobs_select_service_role" ON local_training_jobs;
  DROP POLICY IF EXISTS "training_metrics_select" ON local_training_metrics;
  DROP POLICY IF EXISTS "training_metrics_select_service_role" ON local_training_metrics;
  
  RAISE NOTICE 'Dropped old policies (if any existed)';
END $$;

-- Enable Realtime for authenticated users on local_training_jobs
CREATE POLICY "Enable realtime for authenticated users on local_training_jobs"
ON local_training_jobs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Enable Realtime for service role on local_training_jobs
CREATE POLICY "Enable realtime for service role on local_training_jobs"
ON local_training_jobs
FOR SELECT
TO service_role
USING (true);

-- Allow authenticated users to INSERT/UPDATE own jobs
CREATE POLICY "authenticated_can_insert_jobs"
ON local_training_jobs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "authenticated_can_update_jobs"
ON local_training_jobs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Service role can do everything on jobs
CREATE POLICY "service_role_all_jobs"
ON local_training_jobs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Enable Realtime for authenticated users on local_training_metrics
CREATE POLICY "Enable realtime for authenticated users on local_training_metrics"
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

-- Enable Realtime for service role on local_training_metrics
CREATE POLICY "Enable realtime for service role on local_training_metrics"
ON local_training_metrics
FOR SELECT
TO service_role
USING (true);

-- Allow authenticated users to INSERT metrics for their jobs
CREATE POLICY "authenticated_can_insert_metrics"
ON local_training_metrics
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM local_training_jobs
    WHERE local_training_jobs.id = local_training_metrics.job_id
    AND local_training_jobs.user_id = auth.uid()
  )
);

-- Service role can do everything on metrics
CREATE POLICY "service_role_all_metrics"
ON local_training_metrics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Show all policies that were created
SELECT 
  '=== POLICIES CREATED ===' as status,
  tablename,
  policyname,
  cmd as command,
  roles::text as roles
FROM pg_policies
WHERE tablename IN ('local_training_jobs', 'local_training_metrics')
ORDER BY tablename, policyname;

-- =============================================================================
-- NEXT STEPS
-- =============================================================================
-- 1. Run this SQL in Supabase Dashboard > SQL Editor
-- 2. Verify output shows policies created for both tables
-- 3. Test realtime connection: node test_realtime_connection.js
-- 4. Should see: "✅ SUCCESS! Realtime is working!"
-- 5. Refresh training dashboard - metrics should update in real-time
-- =============================================================================

-- Verification: Show all policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('local_training_jobs', 'local_training_metrics')
ORDER BY tablename, policyname;

-- =============================================================================
-- EXPLANATION
-- =============================================================================
-- Realtime requires SELECT policies even if you already have them for regular
-- queries. The policies must explicitly allow the role that's subscribing
-- (authenticated or service_role) to SELECT from the tables.
--
-- Without these policies, Realtime connections will timeout even though:
-- - Tables are in the publication ✅
-- - Replica identity is set ✅  
-- - Regular SELECT queries work ✅
-- =============================================================================
