-- Migration: Add default model columns to user_settings
-- Date: 2025-12-03
-- Description: Stores user's default model preference in user_settings instead of llm_models

-- Add default_model_id column (references the UUID of the model in llm_models)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_model_id UUID REFERENCES llm_models(id) ON DELETE SET NULL;

-- Add default_model_provider column (stores the provider name like 'anthropic', 'openai')
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_model_provider TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_default_model ON user_settings(user_id, default_model_id) WHERE default_model_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN user_settings.default_model_id IS 'UUID of the user''s default model from llm_models table';
COMMENT ON COLUMN user_settings.default_model_provider IS 'Provider name (e.g., anthropic, openai) for the default model';

-- Verify the migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings'
    AND column_name = 'default_model_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings'
    AND column_name = 'default_model_provider'
  ) THEN
    RAISE NOTICE 'Migration successful: default_model_id and default_model_provider columns added to user_settings table';
  ELSE
    RAISE EXCEPTION 'Migration failed: columns not found';
  END IF;
END $$;
