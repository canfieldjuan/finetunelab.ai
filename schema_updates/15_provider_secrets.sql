-- Provider Secrets Vault Table
-- Centralized API key management per provider
-- Date: 2025-10-16
-- Run in Supabase SQL editor

-- ============================================================================
-- TABLE: provider_secrets
-- ============================================================================
-- Stores provider-level API keys that can be reused across multiple models
-- One secret per user per provider (openai, anthropic, huggingface, etc.)

CREATE TABLE IF NOT EXISTS provider_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership (required - each user has their own provider secrets)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Provider identification
  provider TEXT NOT NULL,  -- 'openai', 'anthropic', 'huggingface', 'ollama', 'vllm', 'azure', 'custom'

  -- Encrypted credentials
  api_key_encrypted TEXT NOT NULL,  -- AES-256-GCM encrypted using existing encryption module

  -- Metadata
  description TEXT,  -- Optional note about this key (e.g., "Personal OpenAI key", "Production HF token")

  -- Usage tracking
  last_used_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints: One secret per user per provider
  UNIQUE (user_id, provider)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_provider_secrets_user_id
  ON provider_secrets(user_id);

CREATE INDEX IF NOT EXISTS idx_provider_secrets_provider
  ON provider_secrets(provider);

CREATE INDEX IF NOT EXISTS idx_provider_secrets_user_provider
  ON provider_secrets(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_provider_secrets_created_at
  ON provider_secrets(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE provider_secrets ENABLE ROW LEVEL SECURITY;

-- Users can only view their own provider secrets
DROP POLICY IF EXISTS "Users can view their own secrets" ON provider_secrets;
CREATE POLICY "Users can view their own secrets"
  ON provider_secrets FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- Users can only insert their own provider secrets
DROP POLICY IF EXISTS "Users can insert their own secrets" ON provider_secrets;
CREATE POLICY "Users can insert their own secrets"
  ON provider_secrets FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can only update their own provider secrets
DROP POLICY IF EXISTS "Users can update their own secrets" ON provider_secrets;
CREATE POLICY "Users can update their own secrets"
  ON provider_secrets FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can only delete their own provider secrets
DROP POLICY IF EXISTS "Users can delete their own secrets" ON provider_secrets;
CREATE POLICY "Users can delete their own secrets"
  ON provider_secrets FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- Service role has full access (for admin operations)
DROP POLICY IF EXISTS "Service role full access to secrets" ON provider_secrets;
CREATE POLICY "Service role full access to secrets"
  ON provider_secrets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION set_provider_secrets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_provider_secrets_updated_at ON provider_secrets;

CREATE TRIGGER trg_provider_secrets_updated_at
  BEFORE UPDATE ON provider_secrets
  FOR EACH ROW
  EXECUTE FUNCTION set_provider_secrets_updated_at();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check table was created
SELECT
  tablename,
  schemaname,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE tablename = 'provider_secrets';

-- Check policies
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'provider_secrets'
ORDER BY policyname;

-- Check indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'provider_secrets'
ORDER BY indexname;

-- Check constraints
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'provider_secrets'::regclass
ORDER BY conname;
