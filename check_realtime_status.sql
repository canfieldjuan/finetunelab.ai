-- Check if Realtime is enabled for training tables
-- This will verify if ALTER PUBLICATION was applied

-- Check 1: See if tables are in the realtime publication
SELECT 
  schemaname,
  tablename,
  'IN PUBLICATION' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('local_training_jobs', 'local_training_metrics')
ORDER BY tablename;

-- Check 2: Verify replica identity is set to FULL
SELECT 
  c.relname as table_name,
  CASE c.relreplident
    WHEN 'd' THEN 'DEFAULT (primary key)'
    WHEN 'n' THEN 'NOTHING'
    WHEN 'f' THEN 'FULL (all columns)'
    WHEN 'i' THEN 'INDEX'
  END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('local_training_jobs', 'local_training_metrics')
ORDER BY c.relname;

-- Check 3: Verify publication exists
SELECT 
  pubname,
  puballtables,
  pubinsert,
  pubupdate,
  pubdelete
FROM pg_publication
WHERE pubname = 'supabase_realtime';
