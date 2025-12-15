-- Demo V2 Tables Migration
-- Purpose: Add tables for BYOM (Bring Your Own Model) demo functionality
-- Date: December 15, 2025

-- ============================================================================
-- Demo Model Configs Table
-- Stores ephemeral model configurations with encrypted API keys
-- Auto-deleted after TTL expiration
-- ============================================================================
CREATE TABLE IF NOT EXISTS demo_model_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  endpoint_url TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  connection_tested BOOLEAN DEFAULT FALSE,
  connection_latency_ms INTEGER,
  last_error TEXT
);

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_demo_model_configs_session
  ON demo_model_configs(session_id);

-- Index for cleanup job (expired sessions)
CREATE INDEX IF NOT EXISTS idx_demo_model_configs_expires
  ON demo_model_configs(expires_at);

-- ============================================================================
-- Add demo_session_id to demo_batch_test_runs for session scoping
-- ============================================================================
ALTER TABLE demo_batch_test_runs
  ADD COLUMN IF NOT EXISTS demo_session_id TEXT;

-- Index for session-scoped queries
CREATE INDEX IF NOT EXISTS idx_demo_batch_test_runs_session
  ON demo_batch_test_runs(demo_session_id);

-- ============================================================================
-- Add demo_session_id to demo_batch_test_results for session scoping
-- ============================================================================
ALTER TABLE demo_batch_test_results
  ADD COLUMN IF NOT EXISTS demo_session_id TEXT;

-- Index for session-scoped queries
CREATE INDEX IF NOT EXISTS idx_demo_batch_test_results_session
  ON demo_batch_test_results(demo_session_id);

-- ============================================================================
-- RLS Policies for Demo Model Configs
-- Public access for demo (rate limiting enforced at app layer)
-- ============================================================================
ALTER TABLE demo_model_configs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for demo (no auth required)
CREATE POLICY "demo_model_configs_public_access"
  ON demo_model_configs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Cleanup Function for Demo V2 Data
-- Deletes expired model configs and associated data
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_demo_v2_data()
RETURNS TABLE(
  configs_deleted BIGINT,
  runs_deleted BIGINT,
  results_deleted BIGINT
) AS $$
DECLARE
  expired_sessions TEXT[];
  config_count BIGINT;
  run_count BIGINT;
  result_count BIGINT;
BEGIN
  -- Get expired session IDs
  SELECT ARRAY_AGG(session_id) INTO expired_sessions
  FROM demo_model_configs
  WHERE expires_at < NOW();

  -- Delete associated batch test results
  DELETE FROM demo_batch_test_results
  WHERE demo_session_id = ANY(expired_sessions);
  GET DIAGNOSTICS result_count = ROW_COUNT;

  -- Delete associated batch test runs
  DELETE FROM demo_batch_test_runs
  WHERE demo_session_id = ANY(expired_sessions);
  GET DIAGNOSTICS run_count = ROW_COUNT;

  -- Delete expired model configs
  DELETE FROM demo_model_configs
  WHERE expires_at < NOW();
  GET DIAGNOSTICS config_count = ROW_COUNT;

  RETURN QUERY SELECT config_count, run_count, result_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_demo_v2_data IS
  'Deletes expired demo v2 sessions and all associated data. Call periodically via cron.';

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE demo_model_configs IS
  'Ephemeral model configurations for BYOM demo. API keys encrypted at rest, auto-deleted after TTL.';

COMMENT ON COLUMN demo_model_configs.session_id IS
  'Unique session identifier for the demo session';

COMMENT ON COLUMN demo_model_configs.endpoint_url IS
  'OpenAI-compatible API endpoint URL';

COMMENT ON COLUMN demo_model_configs.api_key_encrypted IS
  'AES-256-GCM encrypted API key - NEVER logged or exposed';

COMMENT ON COLUMN demo_model_configs.expires_at IS
  'Session expiration time (max 1 hour from creation)';

COMMENT ON COLUMN demo_batch_test_runs.demo_session_id IS
  'Links batch test run to demo v2 session for scoping';

COMMENT ON COLUMN demo_batch_test_results.demo_session_id IS
  'Links batch test result to demo v2 session for scoping';
