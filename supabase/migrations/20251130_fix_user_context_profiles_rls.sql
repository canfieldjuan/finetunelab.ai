-- Fix RLS policies for user_context_profiles table
-- Date: 2025-11-30
-- Issue: Users cannot insert/update their own context profiles due to missing RLS policies

-- Enable RLS on user_context_profiles if not already enabled
ALTER TABLE user_context_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own context profile" ON user_context_profiles;
DROP POLICY IF EXISTS "Users can insert their own context profile" ON user_context_profiles;
DROP POLICY IF EXISTS "Users can update their own context profile" ON user_context_profiles;

-- Allow users to SELECT their own context profile
CREATE POLICY "Users can view their own context profile"
  ON user_context_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to INSERT their own context profile
CREATE POLICY "Users can insert their own context profile"
  ON user_context_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to UPDATE their own context profile
CREATE POLICY "Users can update their own context profile"
  ON user_context_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE user_context_profiles IS 'Stores user-specific context preferences and profiles. Users can only access their own profiles via RLS policies.';
