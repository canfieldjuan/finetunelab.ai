-- ============================================================================
-- CHECK REALTIME CONFIGURATION
-- ============================================================================

-- Query 1: Check if table exists in realtime publication
-- ============================================================================
SELECT
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables
WHERE tablename = 'local_training_jobs';

-- Query 2: Check all publications
-- ============================================================================
SELECT
  pubname,
  puballtables,
  pubinsert,
  pubupdate,
  pubdelete
FROM pg_publication;

-- Query 3: Check what tables are in 'supabase_realtime' publication
-- ============================================================================
SELECT
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Query 4: Check if RLS is enabled on the table
-- ============================================================================
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'local_training_jobs';

-- Query 5: Check RLS policies on the table
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'local_training_jobs';
