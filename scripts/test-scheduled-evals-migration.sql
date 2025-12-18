-- ============================================================================
-- Test Script for Scheduled Evaluations Migration
-- Purpose: Verify migration applied successfully
-- Usage: Run this in Supabase SQL Editor AFTER applying the migration
-- ============================================================================

-- Test 1: Verify tables exist
SELECT
  'Table Existence Check' as test_name,
  COUNT(*) FILTER (WHERE table_name = 'scheduled_evaluations') as scheduled_evaluations_exists,
  COUNT(*) FILTER (WHERE table_name = 'scheduled_evaluation_runs') as scheduled_eval_runs_exists
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('scheduled_evaluations', 'scheduled_evaluation_runs');

-- Test 2: Verify indexes exist
SELECT
  'Index Check' as test_name,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('scheduled_evaluations', 'scheduled_evaluation_runs')
ORDER BY tablename, indexname;

-- Test 3: Verify RLS is enabled
SELECT
  'RLS Check' as test_name,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('scheduled_evaluations', 'scheduled_evaluation_runs');

-- Test 4: Verify RLS policies exist
SELECT
  'Policy Check' as test_name,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('scheduled_evaluations', 'scheduled_evaluation_runs')
ORDER BY tablename, policyname;

-- Test 5: Test foreign key constraints
SELECT
  'FK Constraint Check' as test_name,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('scheduled_evaluations', 'scheduled_evaluation_runs')
ORDER BY tc.table_name, tc.constraint_name;

-- Test 6: Verify trigger exists
SELECT
  'Trigger Check' as test_name,
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'scheduled_evaluations'
  AND trigger_name = 'scheduled_evaluations_updated_at';

-- Test 7: Test a sample INSERT (will be rolled back)
BEGIN;

-- Insert test schedule
INSERT INTO public.scheduled_evaluations (
  user_id,
  name,
  schedule_type,
  test_suite_id,
  model_id,
  next_run_at
) VALUES (
  auth.uid(),  -- Will fail if no user authenticated
  'Test Schedule',
  'daily',
  gen_random_uuid(),  -- Dummy UUID
  'gpt-4-turbo',
  NOW() + INTERVAL '1 day'
);

SELECT 'Test Insert - SUCCESS (rolling back)' as test_result;

ROLLBACK;

-- ============================================================================
-- EXPECTED RESULTS:
-- Test 1: Both tables should exist (count = 1 for each)
-- Test 2: Should show multiple indexes for each table
-- Test 3: RLS should be enabled (rls_enabled = true)
-- Test 4: Should show policies for scheduled_evaluations (4 policies)
--         and scheduled_evaluation_runs (1 policy)
-- Test 5: Should show FK constraints to test_suites and auth.users
-- Test 6: Should show one trigger
-- Test 7: Should succeed or fail with auth error (expected in SQL Editor)
-- ============================================================================
