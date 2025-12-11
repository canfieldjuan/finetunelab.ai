-- Add context injection preference to user profiles
-- Date: 2025-11-27

-- Add column to user_context_profiles table
ALTER TABLE user_context_profiles
ADD COLUMN IF NOT EXISTS enable_context_injection BOOLEAN DEFAULT true;

-- Add comment
COMMENT ON COLUMN user_context_profiles.enable_context_injection IS 'Whether to inject user context (profile, features, activity) into chat messages. Default: true';
