-- Migration: Add default model support
-- Date: 2025-12-03
-- Description: Adds is_default column to llm_models table to support user's default model selection

-- Add is_default column to llm_models table
ALTER TABLE llm_models ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Create index for faster default model lookups
CREATE INDEX IF NOT EXISTS idx_llm_models_user_default ON llm_models(user_id, is_default) WHERE is_default = true;

-- Add comment for documentation
COMMENT ON COLUMN llm_models.is_default IS 'Whether this is the user''s default model for chat interface';

-- Function to ensure only one default model per user
CREATE OR REPLACE FUNCTION ensure_single_default_model()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a model as default, unset all other defaults for this user
  IF NEW.is_default = true THEN
    UPDATE llm_models
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single default model per user
DROP TRIGGER IF EXISTS trigger_ensure_single_default_model ON llm_models;
CREATE TRIGGER trigger_ensure_single_default_model
  BEFORE INSERT OR UPDATE ON llm_models
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_model();

-- Verify the migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'llm_models'
    AND column_name = 'is_default'
  ) THEN
    RAISE NOTICE 'Migration successful: is_default column added to llm_models table';
  ELSE
    RAISE EXCEPTION 'Migration failed: is_default column not found';
  END IF;
END $$;
