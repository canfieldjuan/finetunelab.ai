-- ============================================================================
-- Migration: Create User Profiles Table
-- Created: November 13, 2025
-- Purpose: Store additional user information during signup
-- ============================================================================

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personal Information
  first_name TEXT NOT NULL CHECK (length(first_name) > 0 AND length(first_name) <= 100),
  last_name TEXT NOT NULL CHECK (length(last_name) > 0 AND length(last_name) <= 100),
  
  -- Company Information
  company_name TEXT NOT NULL CHECK (length(company_name) > 0 AND length(company_name) <= 200),
  company_email TEXT CHECK (company_email IS NULL OR (length(company_email) > 0 AND length(company_email) <= 255 AND company_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')),
  role_in_company TEXT NOT NULL CHECK (length(role_in_company) > 0 AND length(role_in_company) <= 150),
  team_size INTEGER CHECK (team_size > 0),
  
  -- Finetuning Information
  finetuning_type TEXT NOT NULL CHECK (finetuning_type IN (
    'SFT',           -- Supervised Fine-Tuning
    'DPO',           -- Direct Preference Optimization
    'RLHF',          -- Reinforcement Learning from Human Feedback
    'ORPO',          -- Odds Ratio Preference Optimization
    'Teacher Mode',  -- Teacher Mode Training
    'Multiple',      -- Multiple types
    'Undecided'      -- Not sure yet
  )),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one profile per user
  UNIQUE(user_id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id 
  ON user_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_company 
  ON user_profiles(company_name);

CREATE INDEX IF NOT EXISTS idx_user_profiles_finetuning_type 
  ON user_profiles(finetuning_type);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own profile
CREATE POLICY user_profiles_select_own 
  ON user_profiles 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can insert their own profile (during signup)
CREATE POLICY user_profiles_insert_own 
  ON user_profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY user_profiles_update_own 
  ON user_profiles 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own profile
CREATE POLICY user_profiles_delete_own 
  ON user_profiles 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER user_profiles_updated_at_trigger
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- Verify table creation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles'
  ) THEN
    RAISE NOTICE '✓ user_profiles table created successfully';
  ELSE
    RAISE EXCEPTION '✗ Failed to create user_profiles table';
  END IF;
END $$;
