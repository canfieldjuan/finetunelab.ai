-- Migration: Fix RLS policies for user_context_profiles
-- Date: 2025-12-03
-- Description: Adds INSERT and UPDATE policies so users can manage their own context preferences

-- Enable RLS if not already enabled
ALTER TABLE user_context_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own context profile" ON user_context_profiles;
DROP POLICY IF EXISTS "Users can insert their own context profile" ON user_context_profiles;
DROP POLICY IF EXISTS "Users can update their own context profile" ON user_context_profiles;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view their own context profile"
  ON user_context_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert their own context profile"
  ON user_context_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own context profile"
  ON user_context_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Verify the policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'user_context_profiles';

  IF policy_count >= 3 THEN
    RAISE NOTICE 'Migration successful: % RLS policies created for user_context_profiles', policy_count;
  ELSE
    RAISE WARNING 'Migration may be incomplete: only % policies found (expected at least 3)', policy_count;
  END IF;
END $$;
