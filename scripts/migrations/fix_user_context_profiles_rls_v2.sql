-- Migration: Fix RLS for user_context_profiles (v2)
-- Date: 2025-12-03
-- Description: Disable RLS since API uses service role and validates user_id

-- The API uses service role client and validates user_id in the application layer
-- RLS policies with auth.uid() don't work with service role
-- Simplest solution: disable RLS for this table

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own context profile" ON user_context_profiles;
DROP POLICY IF EXISTS "Users can insert their own context profile" ON user_context_profiles;
DROP POLICY IF EXISTS "Users can update their own context profile" ON user_context_profiles;

-- Disable RLS for this table
ALTER TABLE user_context_profiles DISABLE ROW LEVEL SECURITY;

-- Add comment explaining why RLS is disabled
COMMENT ON TABLE user_context_profiles IS 'RLS disabled - API validates user_id in application layer using service role';

-- Verify RLS is disabled
DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'user_context_profiles';

  IF rls_enabled THEN
    RAISE WARNING 'RLS is still enabled on user_context_profiles';
  ELSE
    RAISE NOTICE 'Migration successful: RLS disabled for user_context_profiles';
  END IF;
END $$;
