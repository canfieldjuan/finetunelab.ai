-- Check if realtime is properly configured
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Check if tables are in supabase_realtime publication
SELECT schemaname, tablename, 'IN PUBLICATION' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('local_training_jobs', 'local_training_metrics')
ORDER BY tablename;

-- Expected: Should return 2 rows (both tables)
-- If EMPTY: Realtime is NOT enabled (this is the problem)

-- 2. Check replica identity (should be 'full' for realtime)
SELECT
  c.relname AS tablename,
  CASE c.relreplident
    WHEN 'd' THEN 'default (primary key only)'
    WHEN 'n' THEN 'nothing (realtime disabled)'
    WHEN 'f' THEN 'full (all columns - CORRECT)'
    WHEN 'i' THEN 'index'
  END AS replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('local_training_jobs', 'local_training_metrics')
  AND c.relkind = 'r'
ORDER BY c.relname;

-- Expected: Both tables should show 'full (all columns - CORRECT)'
