-- Direct Realtime Fix for Training Tables
-- Run this in Supabase SQL Editor

-- Check current publication status
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('local_training_jobs', 'local_training_metrics');

-- Add tables to realtime publication if not already present
DO $$
BEGIN
  -- Add local_training_jobs
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'local_training_jobs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE local_training_jobs';
    RAISE NOTICE '✅ Added local_training_jobs to realtime';
  ELSE
    RAISE NOTICE 'ℹ️  local_training_jobs already in realtime';
  END IF;

  -- Add local_training_metrics
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'local_training_metrics'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE local_training_metrics';
    RAISE NOTICE '✅ Added local_training_metrics to realtime';
  ELSE
    RAISE NOTICE 'ℹ️  local_training_metrics already in realtime';
  END IF;
END$$;

-- Verify publication is complete
SELECT 
  CASE 
    WHEN COUNT(*) = 2 THEN '✅ Both tables are in realtime publication'
    ELSE '❌ Missing tables in realtime publication'
  END as status,
  string_agg(tablename, ', ') as tables
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('local_training_jobs', 'local_training_metrics');

-- Grant necessary permissions
GRANT SELECT ON local_training_jobs TO anon, authenticated;
GRANT SELECT ON local_training_metrics TO anon, authenticated;

-- Verify permissions
SELECT 
  grantee,
  string_agg(privilege_type, ', ') as privileges
FROM information_schema.table_privileges
WHERE table_name IN ('local_training_jobs', 'local_training_metrics')
AND grantee IN ('anon', 'authenticated')
GROUP BY grantee;

-- Final verification
SELECT 
  '✅ Realtime is configured correctly for training tables' as result
WHERE (
  SELECT COUNT(*) 
  FROM pg_publication_tables 
  WHERE pubname = 'supabase_realtime'
  AND tablename IN ('local_training_jobs', 'local_training_metrics')
) = 2;
