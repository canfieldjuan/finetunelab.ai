-- Migration: Add embedding provider settings to user_settings
-- Date: 2025-12-05
-- Description: Stores user's embedding provider preference for GraphRAG

-- Add embedding_provider column (openai or runpod)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS embedding_provider TEXT DEFAULT 'openai';

-- Add embedding_base_url column (for RunPod serverless endpoint)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS embedding_base_url TEXT;

-- Add embedding_model column (model name/id)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS embedding_model TEXT;

-- Add embedding_api_key column (optional API key for the endpoint)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS embedding_api_key TEXT;

-- Add check constraint for valid provider values (drop first if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_embedding_provider'
    AND table_name = 'user_settings'
  ) THEN
    ALTER TABLE user_settings ADD CONSTRAINT check_embedding_provider
      CHECK (embedding_provider IS NULL OR embedding_provider IN ('openai', 'runpod'));
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN user_settings.embedding_provider IS 'Embedding provider: openai or runpod';
COMMENT ON COLUMN user_settings.embedding_base_url IS 'Base URL for embedding API (e.g., RunPod serverless endpoint)';
COMMENT ON COLUMN user_settings.embedding_model IS 'Embedding model name (e.g., text-embedding-3-small, BAAI/bge-large-en-v1.5)';
COMMENT ON COLUMN user_settings.embedding_api_key IS 'API key for embedding endpoint (encrypted at rest)';

-- Verify the migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings'
    AND column_name = 'embedding_provider'
  ) THEN
    RAISE NOTICE 'Migration successful: embedding settings columns added to user_settings table';
  ELSE
    RAISE EXCEPTION 'Migration failed: columns not found';
  END IF;
END $$;
