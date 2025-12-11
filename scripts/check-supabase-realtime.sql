-- Check if Realtime is enabled for training tables
-- Run this in Supabase SQL Editor

-- 1. Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('local_training_jobs', 'local_training_metrics');

-- 2. Check Realtime publications (Realtime v2)
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('local_training_jobs', 'local_training_metrics');

-- 3. If tables are missing from publication, enable them:
-- ALTER PUBLICATION supabase_realtime ADD TABLE local_training_jobs;
-- ALTER PUBLICATION supabase_realtime ADD TABLE local_training_metrics;

-- 4. Check table policies (RLS)
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('local_training_jobs', 'local_training_metrics');

-- 5. Verify replica identity (needed for UPDATE/DELETE events)
SELECT 
  n.nspname AS schemaname,
  c.relname AS tablename,
  CASE c.relreplident
    WHEN 'd' THEN 'default'
    WHEN 'n' THEN 'nothing'
    WHEN 'f' THEN 'full'
    WHEN 'i' THEN 'index'
  END AS replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relname IN ('local_training_jobs', 'local_training_metrics')
  AND c.relkind = 'r';

-- If replica identity is not FULL, set it:
-- ALTER TABLE local_training_jobs REPLICA IDENTITY FULL;
-- ALTER TABLE local_training_metrics REPLICA IDENTITY FULL;
