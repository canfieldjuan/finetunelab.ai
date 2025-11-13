-- =============================================================================
-- MANUAL REALTIME SETUP FOR TRAINING TABLES
-- =============================================================================
-- Run this in Supabase Dashboard > SQL Editor if migrations won't push
--
-- HOW TO USE:
-- 1. Go to: https://supabase.com/dashboard/project/tkizlemssfmrfluychsn/sql/new
-- 2. Copy and paste this ENTIRE file
-- 3. Click "Run" button
-- 4. Verify no errors
-- 5. Refresh your training dashboard - realtime should work!
-- =============================================================================

-- Enable Realtime for local_training_metrics
DO $$
BEGIN
  -- Set replica identity
  ALTER TABLE local_training_metrics REPLICA IDENTITY FULL;
  RAISE NOTICE '✓ Set replica identity for local_training_metrics';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠ Replica identity already set for local_training_metrics';
END $$;

-- Add to publication (with error handling)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE local_training_metrics;
  RAISE NOTICE '✓ Added local_training_metrics to realtime publication';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠ local_training_metrics already in realtime publication';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error adding local_training_metrics: %', SQLERRM;
END $$;

-- Enable Realtime for local_training_jobs  
DO $$
BEGIN
  -- Set replica identity
  ALTER TABLE local_training_jobs REPLICA IDENTITY FULL;
  RAISE NOTICE '✓ Set replica identity for local_training_jobs';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠ Replica identity already set for local_training_jobs';
END $$;

-- Add to publication (with error handling)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE local_training_jobs;
  RAISE NOTICE '✓ Added local_training_jobs to realtime publication';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠ local_training_jobs already in realtime publication';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error adding local_training_jobs: %', SQLERRM;
END $$;

-- Verification query - this will show you what's in the publication
SELECT 
  'VERIFICATION: Tables in supabase_realtime publication' as info,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('local_training_jobs', 'local_training_metrics')
ORDER BY tablename;

-- If the verification query shows both tables, you're done!
-- If it shows nothing, there may be a deeper issue with Realtime configuration

-- =============================================================================
-- AFTER RUNNING THIS:
-- =============================================================================
-- 1. Refresh your training dashboard in the browser
-- 2. Start a new training job or wait for existing job to log metrics
-- 3. You should see realtime updates in the charts
-- 4. Check browser console for: "[TrainingRealtime] ✅ Realtime connected"
-- =============================================================================
