-- LLM Models Registry Table
-- Dynamic model management for enterprise multi-model support
-- Date: 2025-10-14
-- Run in Supabase SQL editor

-- ============================================================================
-- TABLE: llm_models
-- ============================================================================
-- Stores model configurations with encrypted credentials
-- Supports: OpenAI, Anthropic, HuggingFace, vLLM, Ollama, custom endpoints

CREATE TABLE IF NOT EXISTS llm_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership (NULL = global/admin model)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Display Information
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL,  -- 'openai', 'anthropic', 'huggingface', 'ollama', 'vllm', 'custom'

  -- Endpoint Configuration
  base_url TEXT NOT NULL,
  model_id TEXT NOT NULL,

  -- Authentication (encrypted)
  auth_type TEXT NOT NULL,  -- 'bearer', 'api_key', 'custom_header', 'none'
  api_key_encrypted TEXT,  -- AES-256-GCM encrypted
  auth_headers JSONB DEFAULT '{}'::jsonb,

  -- Model Capabilities
  supports_streaming BOOLEAN DEFAULT true,
  supports_functions BOOLEAN DEFAULT true,
  supports_vision BOOLEAN DEFAULT false,
  context_length INTEGER DEFAULT 4096,
  max_output_tokens INTEGER DEFAULT 2000,

  -- Pricing (per token, for cost tracking)
  price_per_input_token NUMERIC(12, 10),
  price_per_output_token NUMERIC(12, 10),

  -- Default Parameters
  default_temperature NUMERIC(3, 2) DEFAULT 0.7 CHECK (default_temperature >= 0 AND default_temperature <= 2),
  default_top_p NUMERIC(3, 2) DEFAULT 1.0 CHECK (default_top_p >= 0 AND default_top_p <= 1),

  -- Status
  enabled BOOLEAN DEFAULT true,
  is_global BOOLEAN DEFAULT false,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE (user_id, name),
  CHECK (
    (user_id IS NULL AND is_global = true) OR
    (user_id IS NOT NULL AND is_global = false)
  )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_llm_models_user_id
  ON llm_models(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_llm_models_enabled
  ON llm_models(enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_llm_models_global
  ON llm_models(is_global) WHERE is_global = true;

CREATE INDEX IF NOT EXISTS idx_llm_models_provider
  ON llm_models(provider);

CREATE INDEX IF NOT EXISTS idx_llm_models_created_at
  ON llm_models(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE llm_models ENABLE ROW LEVEL SECURITY;

-- Users can view global models + their own models
DROP POLICY IF EXISTS "Users can view accessible models" ON llm_models;
CREATE POLICY "Users can view accessible models"
  ON llm_models FOR SELECT
  USING (
    is_global = true OR
    user_id = (SELECT auth.uid())
  );

-- Users can insert their own models
DROP POLICY IF EXISTS "Users can insert their own models" ON llm_models;
CREATE POLICY "Users can insert their own models"
  ON llm_models FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND
    is_global = false
  );

-- Users can update their own models
DROP POLICY IF EXISTS "Users can update their own models" ON llm_models;
CREATE POLICY "Users can update their own models"
  ON llm_models FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can delete their own models
DROP POLICY IF EXISTS "Users can delete their own models" ON llm_models;
CREATE POLICY "Users can delete their own models"
  ON llm_models FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- Service role has full access (for admin operations)
DROP POLICY IF EXISTS "Service role full access to models" ON llm_models;
CREATE POLICY "Service role full access to models"
  ON llm_models FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION set_llm_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_llm_models_updated_at ON llm_models;

CREATE TRIGGER trg_llm_models_updated_at
  BEFORE UPDATE ON llm_models
  FOR EACH ROW
  EXECUTE FUNCTION set_llm_models_updated_at();

-- ============================================================================
-- ALTER EXISTING TABLES
-- ============================================================================

-- Add model tracking to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS llm_model_id UUID REFERENCES llm_models(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_llm_model_id
  ON conversations(llm_model_id) WHERE llm_model_id IS NOT NULL;

-- Add model tracking to messages (for A/B testing analytics)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS llm_model_id UUID REFERENCES llm_models(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_llm_model_id
  ON messages(llm_model_id) WHERE llm_model_id IS NOT NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check table was created
SELECT
  tablename,
  schemaname,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE tablename = 'llm_models';

-- Check policies
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'llm_models'
ORDER BY policyname;

-- Check indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'llm_models'
ORDER BY indexname;
