-- Migration: Add Demo Sessions Table for Question Tracking
-- Date: 2026-01-01
-- Purpose: Track Atlas question count per demo session (10 limit)
-- Related: Demo Atlas Integration

-- ============================================================================
-- Create demo_sessions table
-- ============================================================================
CREATE TABLE IF NOT EXISTS demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  questions_asked INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_demo_sessions_session_id
  ON demo_sessions(session_id);

-- Index for cleanup (old sessions)
CREATE INDEX IF NOT EXISTS idx_demo_sessions_created_at
  ON demo_sessions(created_at);

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE demo_sessions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for demo (no auth required)
CREATE POLICY "demo_sessions_public_access"
  ON demo_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE demo_sessions IS
  'Tracks Atlas question count per demo session (10 question limit). Auto-cleaned with expired demo_model_configs.';

COMMENT ON COLUMN demo_sessions.session_id IS
  'Links to demo_model_configs.session_id';

COMMENT ON COLUMN demo_sessions.questions_asked IS
  'Number of questions asked to Atlas in this session (max 10 for demo)';

-- ============================================================================
-- Cleanup function update
-- Update cleanup function to also delete demo_sessions
-- Must drop existing function first because return type is changing
-- ============================================================================
DROP FUNCTION IF EXISTS cleanup_expired_demo_v2_data();

CREATE FUNCTION cleanup_expired_demo_v2_data()
RETURNS TABLE(
  configs_deleted BIGINT,
  runs_deleted BIGINT,
  results_deleted BIGINT,
  sessions_deleted BIGINT
) AS $$
DECLARE
  expired_sessions TEXT[];
  config_count BIGINT;
  run_count BIGINT;
  result_count BIGINT;
  session_count BIGINT;
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

  -- Delete associated demo sessions (question tracking)
  DELETE FROM demo_sessions
  WHERE session_id = ANY(expired_sessions);
  GET DIAGNOSTICS session_count = ROW_COUNT;

  -- Delete expired model configs
  DELETE FROM demo_model_configs
  WHERE expires_at < NOW();
  GET DIAGNOSTICS config_count = ROW_COUNT;

  RETURN QUERY SELECT config_count, run_count, result_count, session_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_demo_v2_data IS
  'Deletes expired demo v2 sessions and all associated data (model configs, batch runs/results, session question tracking). Call periodically via cron.';

-- ============================================================================
-- Verification Query
-- To verify migration worked, run:
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'demo_sessions';
-- ============================================================================
