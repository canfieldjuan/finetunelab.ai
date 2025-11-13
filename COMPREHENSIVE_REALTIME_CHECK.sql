-- =============================================================================
-- COMPREHENSIVE REALTIME DIAGNOSTIC
-- =============================================================================
-- Run this to see exactly what's missing
-- =============================================================================

-- Check 1: Is RLS enabled on the tables?
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS ENABLED'
    ELSE '❌ RLS DISABLED'
  END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
  AND tablename IN ('local_training_jobs', 'local_training_metrics');

-- Check 2: What policies exist?
SELECT 
  '--- EXISTING POLICIES ---' as section,
  tablename,
  policyname,
  string_to_array(roles::text, ',') as roles,
  cmd as command
FROM pg_policies
WHERE tablename IN ('local_training_jobs', 'local_training_metrics')
ORDER BY tablename, policyname;

-- Check 3: Are tables in realtime publication?
SELECT 
  '--- REALTIME PUBLICATION ---' as section,
  schemaname,
  tablename,
  CASE 
    WHEN tablename IS NOT NULL THEN '✅ IN PUBLICATION'
    ELSE '❌ NOT IN PUBLICATION'
  END as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('local_training_jobs', 'local_training_metrics');

-- Check 4: Replica identity
SELECT 
  '--- REPLICA IDENTITY ---' as section,
  c.relname as table_name,
  CASE c.relreplident
    WHEN 'd' THEN '⚠️  DEFAULT (primary key only)'
    WHEN 'n' THEN '❌ NOTHING'
    WHEN 'f' THEN '✅ FULL (all columns)'
    WHEN 'i' THEN '⚠️  INDEX'
  END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('local_training_jobs', 'local_training_metrics');

-- Check 5: Table permissions
SELECT 
  '--- TABLE PERMISSIONS ---' as section,
  grantee,
  table_name,
  string_agg(privilege_type, ', ') as privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('local_training_jobs', 'local_training_metrics')
  AND grantee IN ('authenticated', 'service_role', 'anon')
GROUP BY grantee, table_name
ORDER BY table_name, grantee;
