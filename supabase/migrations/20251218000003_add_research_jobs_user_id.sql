-- Migration: Add user_id column to research_jobs table with RLS policies
-- Purpose: Enable user-scoped authentication for research endpoints
-- Security: Replaces supabaseAdmin with user-scoped queries
-- Related: Phase 3 security fix for /api/web-search/research/* endpoints

-- Step 1: Add user_id column with foreign key constraint
ALTER TABLE research_jobs
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Create index for efficient user_id filtering
CREATE INDEX IF NOT EXISTS idx_research_jobs_user_id 
ON research_jobs(user_id);

-- Step 3: Enable Row Level Security
ALTER TABLE research_jobs ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for user-scoped access
-- Policy 1: SELECT - Users can only view their own research jobs
CREATE POLICY research_jobs_select_own
ON research_jobs
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: INSERT - Users can only create research jobs for themselves
CREATE POLICY research_jobs_insert_own
ON research_jobs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy 3: UPDATE - Users can only update their own research jobs
CREATE POLICY research_jobs_update_own
ON research_jobs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: DELETE - Users can only delete their own research jobs
CREATE POLICY research_jobs_delete_own
ON research_jobs
FOR DELETE
USING (auth.uid() = user_id);

-- Step 5: Verification queries
DO $$
DECLARE
  column_exists BOOLEAN;
  index_exists BOOLEAN;
  rls_enabled BOOLEAN;
  policy_count INTEGER;
  policy_name TEXT;
BEGIN
  -- Check if user_id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'research_jobs' AND column_name = 'user_id'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE NOTICE '✓ user_id column added to research_jobs';
  ELSE
    RAISE WARNING '✗ user_id column NOT found in research_jobs';
  END IF;

  -- Check if index exists
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'research_jobs' AND indexname = 'idx_research_jobs_user_id'
  ) INTO index_exists;
  
  IF index_exists THEN
    RAISE NOTICE '✓ Index idx_research_jobs_user_id created';
  ELSE
    RAISE WARNING '✗ Index idx_research_jobs_user_id NOT found';
  END IF;

  -- Check if RLS is enabled
  SELECT relrowsecurity FROM pg_class 
  WHERE relname = 'research_jobs' 
  INTO rls_enabled;
  
  IF rls_enabled THEN
    RAISE NOTICE '✓ Row Level Security enabled on research_jobs';
  ELSE
    RAISE WARNING '✗ RLS NOT enabled on research_jobs';
  END IF;

  -- Check policy count
  SELECT COUNT(*) FROM pg_policies 
  WHERE tablename = 'research_jobs' 
  INTO policy_count;
  
  IF policy_count = 4 THEN
    RAISE NOTICE '✓ All 4 RLS policies created for research_jobs';
  ELSE
    RAISE WARNING '✗ Expected 4 policies, found %', policy_count;
  END IF;

  -- List all policies
  RAISE NOTICE 'Policies created:';
  FOR policy_name IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'research_jobs'
  LOOP
    RAISE NOTICE '  - %', policy_name;
  END LOOP;
END $$;

-- Step 6: Backfill existing rows (if needed)
-- Note: This sets user_id to NULL for existing records without ownership data
-- In production, you may want to assign these to a specific user or delete them
-- Example: UPDATE research_jobs SET user_id = '<admin_user_id>' WHERE user_id IS NULL;

-- Display row count summary
DO $$
DECLARE
  total_rows INTEGER;
  rows_with_user INTEGER;
  rows_without_user INTEGER;
BEGIN
  SELECT COUNT(*) FROM research_jobs INTO total_rows;
  SELECT COUNT(*) FROM research_jobs WHERE user_id IS NOT NULL INTO rows_with_user;
  SELECT COUNT(*) FROM research_jobs WHERE user_id IS NULL INTO rows_without_user;
  
  RAISE NOTICE 'Research jobs summary:';
  RAISE NOTICE '  Total rows: %', total_rows;
  RAISE NOTICE '  With user_id: %', rows_with_user;
  RAISE NOTICE '  Without user_id: %', rows_without_user;
  
  IF rows_without_user > 0 THEN
    RAISE WARNING 'Action required: % rows have NULL user_id and will not be accessible', rows_without_user;
  END IF;
END $$;
