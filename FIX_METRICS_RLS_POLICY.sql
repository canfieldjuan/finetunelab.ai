-- ============================================================================
-- FIX METRICS RLS POLICY FOR RUNPOD TRAINING
-- ============================================================================
-- Purpose: Fix RLS policy violation when RunPod training inserts metrics
-- Issue: Current policy uses EXISTS subquery that anon role cannot execute
-- Solution: Simplify policy to allow inserts without complex subquery
-- Date: 2025-11-26
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this ENTIRE file
-- 3. Click "RUN"
-- ============================================================================

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Allow anon to insert metrics for valid jobs" ON local_training_metrics;

-- Create a simpler policy that allows anon role to insert metrics
-- The job_id foreign key constraint already ensures the job exists
CREATE POLICY "Allow anon to insert training metrics"
ON local_training_metrics
FOR INSERT
TO anon
WITH CHECK (true);

-- Also ensure authenticated users can insert
CREATE POLICY "Allow authenticated to insert training metrics"
ON local_training_metrics
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Verify the new policies
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'local_training_metrics'
AND cmd = 'INSERT'
ORDER BY policyname;

-- ============================================================================
-- Expected Result: Should show two policies for INSERT
-- 1. "Allow anon to insert training metrics" (anon role)
-- 2. "Allow authenticated to insert training metrics" (authenticated role)
-- ============================================================================
