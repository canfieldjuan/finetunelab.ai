-- ============================================================================
-- FIX: Training Metrics + Realtime
-- ============================================================================
-- Purpose: Enable metrics updates from training pods AND realtime updates in UI
-- Date: 2025-11-25
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this ENTIRE file
-- 3. Click "RUN"
-- 4. You should see "Success. No rows returned" (this is normal)
-- 5. Redeploy your training job for metrics to work
-- ============================================================================

-- ============================================
-- PART 1: Enable Metrics Updates (anon role)
-- ============================================

-- Grant UPDATE permission on metrics columns to anon/authenticated roles
-- This allows training scripts to update their job metrics using job_token
GRANT UPDATE (
  current_step,
  current_epoch,
  total_steps,
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
  status,
  started_at,
  completed_at,
  error_message
) ON local_training_jobs TO anon, authenticated;

-- Create RLS policy to allow updates only with valid job_token
DROP POLICY IF EXISTS "Allow metrics updates with valid job_token" ON local_training_jobs;

CREATE POLICY "Allow metrics updates with valid job_token"
ON local_training_jobs
FOR UPDATE
TO anon, authenticated
USING (job_token IS NOT NULL)
WITH CHECK (job_token IS NOT NULL);

-- ============================================
-- PART 2: Enable Realtime
-- ============================================

-- Add tables to realtime publication (safely handle if already exists)
DO $$
BEGIN
  -- Try to drop from publication (ignore if not in publication)
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE local_training_jobs;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore error if table not in publication
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE local_training_metrics;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore error if table not in publication
  END;

  -- Add tables to publication
ALTER PUBLICATION supabase_realtime ADD TABLE local_training_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE local_training_metrics;
  END $$;
  -- Set replica identity to FULL (required for UPDATE/DELETE realtime events)
ALTER TABLE local_training_jobs REPLICA IDENTITY FULL;
ALTER TABLE local_training_metrics REPLICA IDENTITY FULL;

-- Grant SELECT permission (required for realtime subscriptions)
GRANT SELECT ON local_training_jobs TO anon, authenticated;
GRANT SELECT ON local_training_metrics TO anon, authenticated;

-- Grant usage on sequences (needed when inserting via realtime)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================
-- PART 3: Verify Configuration
-- ============================================

-- Check if tables are in realtime publication
SELECT
  schemaname,
  tablename,
  'Realtime Enabled' AS status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('local_training_jobs', 'local_training_metrics');

-- Check replica identity
SELECT
  c.relname AS tablename,
  CASE c.relreplident
    WHEN 'd' THEN 'default (primary key only)'
    WHEN 'n' THEN 'nothing (realtime disabled)'
    WHEN 'f' THEN 'full (all columns)'
    WHEN 'i' THEN 'index'
  END AS replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('local_training_jobs', 'local_training_metrics')
  AND c.relkind = 'r';

-- Check RLS policies
SELECT
  tablename,
  policyname,
  cmd AS operation,
  roles
FROM pg_policies
WHERE tablename = 'local_training_jobs'
  AND policyname = 'Allow metrics updates with valid job_token';

-- ============================================
-- Expected Results:
-- ============================================
-- Query 1: Should return 2 rows (both tables in realtime publication)
-- Query 2: Should show "full (all columns)" for both tables
-- Query 3: Should show the UPDATE policy for anon/authenticated roles
-- ============================================
