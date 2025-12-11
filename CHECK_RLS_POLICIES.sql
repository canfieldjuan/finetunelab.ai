-- Check RLS policies that might block realtime
-- Run this in Supabase SQL Editor

-- 1. Check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('local_training_jobs', 'local_training_metrics');

-- 2. Check ALL policies on these tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename IN ('local_training_jobs', 'local_training_metrics')
ORDER BY tablename, cmd, policyname;

-- 3. Check table permissions
SELECT
  grantee,
  table_schema,
  table_name,
  string_agg(privilege_type, ', ') as privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('local_training_jobs', 'local_training_metrics')
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee, table_schema, table_name
ORDER BY table_name, grantee;
