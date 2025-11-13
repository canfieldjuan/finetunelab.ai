-- Fix Replica Identity for Realtime INSERT events
-- This is required for Supabase Realtime to broadcast INSERT events

-- Check current replica identity
SELECT 
  c.relname as table_name,
  CASE c.relreplident
    WHEN 'd' THEN 'default (primary key)'
    WHEN 'n' THEN 'nothing'
    WHEN 'f' THEN 'full'
    WHEN 'i' THEN 'index'
  END as replica_identity
FROM pg_class c
WHERE c.relname IN ('local_training_jobs', 'local_training_metrics')
AND c.relnamespace = 'public'::regnamespace;

-- Set FULL replica identity (required for INSERT events)
ALTER TABLE local_training_metrics REPLICA IDENTITY FULL;
ALTER TABLE local_training_jobs REPLICA IDENTITY FULL;

-- Verify the change
SELECT 
  c.relname as table_name,
  CASE c.relreplident
    WHEN 'd' THEN 'default (primary key)'
    WHEN 'n' THEN 'nothing'
    WHEN 'f' THEN 'full'
    WHEN 'i' THEN 'index'
  END as replica_identity,
  CASE 
    WHEN c.relreplident = 'f' THEN '✅ FULL (INSERT events will work)'
    ELSE '❌ NOT FULL (INSERT events may not work)'
  END as status
FROM pg_class c
WHERE c.relname IN ('local_training_jobs', 'local_training_metrics')
AND c.relnamespace = 'public'::regnamespace;
