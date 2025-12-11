-- Check Row Level Security (RLS) policies for training tables
-- Empty data usually means RLS is blocking anonymous access

-- 1. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('local_training_jobs', 'local_training_metrics');

-- 2. Check existing policies
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
WHERE tablename IN ('local_training_jobs', 'local_training_metrics')
ORDER BY tablename, policyname;

-- 3. If RLS is enabled but no policies exist for 'anon' role, create them:

-- Enable anonymous SELECT on training jobs
-- Uncomment to run:
-- CREATE POLICY "Allow anonymous read training jobs"
-- ON local_training_jobs FOR SELECT
-- TO anon
-- USING (true);

-- Enable anonymous SELECT on training metrics
-- Uncomment to run:
-- CREATE POLICY "Allow anonymous read training metrics"
-- ON local_training_metrics FOR SELECT
-- TO anon
-- USING (true);

-- 4. Test if anonymous user can read data
-- Run this in a new connection WITHOUT authentication:
-- SELECT COUNT(*) FROM local_training_jobs;
-- SELECT COUNT(*) FROM local_training_metrics;

-- If counts return 0 or error, RLS is blocking access
