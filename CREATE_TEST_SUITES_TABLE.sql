-- ============================================================================
-- CREATE TEST SUITES TABLE
-- ============================================================================
-- Purpose: Store test prompt suites for batch testing (separate from training data)
-- Date: 2025-11-25
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard -> SQL Editor
-- 2. Paste this ENTIRE file
-- 3. Click "RUN"
-- ============================================================================

-- Create test_suites table
CREATE TABLE IF NOT EXISTS test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
  prompt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_test_suites_user_id ON test_suites(user_id);

-- Enable RLS
ALTER TABLE test_suites ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own test suites
CREATE POLICY "Users can view own test suites"
  ON test_suites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own test suites"
  ON test_suites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own test suites"
  ON test_suites FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own test suites"
  ON test_suites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_test_suites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER test_suites_updated_at
  BEFORE UPDATE ON test_suites
  FOR EACH ROW
  EXECUTE FUNCTION update_test_suites_updated_at();

-- ============================================================================
-- Expected Result: "Success. No rows returned"
-- ============================================================================
