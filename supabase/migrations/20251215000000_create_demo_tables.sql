-- Demo Tables Migration
-- Purpose: Create isolated tables for demo page functionality
-- Date: December 15, 2025

-- ============================================================================
-- Demo Conversations Table
-- Mirrors 'conversations' table for demo isolation
-- ============================================================================
CREATE TABLE IF NOT EXISTS demo_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_user_id TEXT NOT NULL DEFAULT 'demo-user',
  session_id TEXT,
  experiment_name TEXT,
  model_id TEXT,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_demo_conversations_session
  ON demo_conversations(session_id, experiment_name);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_demo_conversations_created
  ON demo_conversations(created_at);

-- ============================================================================
-- Demo Messages Table
-- Mirrors 'messages' table for demo isolation
-- ============================================================================
CREATE TABLE IF NOT EXISTS demo_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES demo_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  content_json JSONB,
  model_id TEXT,
  latency_ms INTEGER,
  token_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for conversation message lookups
CREATE INDEX IF NOT EXISTS idx_demo_messages_conversation
  ON demo_messages(conversation_id);

-- ============================================================================
-- Demo Batch Test Runs Table
-- Mirrors 'batch_test_runs' table for demo isolation
-- ============================================================================
CREATE TABLE IF NOT EXISTS demo_batch_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_user_id TEXT NOT NULL DEFAULT 'demo-user',
  model_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  total_prompts INTEGER DEFAULT 0,
  completed_prompts INTEGER DEFAULT 0,
  failed_prompts INTEGER DEFAULT 0,
  config JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_demo_batch_test_runs_status
  ON demo_batch_test_runs(status, archived);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_demo_batch_test_runs_created
  ON demo_batch_test_runs(created_at);

-- ============================================================================
-- Demo Batch Test Results Table
-- Stores individual prompt results for demo batch tests
-- ============================================================================
CREATE TABLE IF NOT EXISTS demo_batch_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID REFERENCES demo_batch_test_runs(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  response TEXT,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error TEXT,
  model_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for test run lookups
CREATE INDEX IF NOT EXISTS idx_demo_batch_test_results_run
  ON demo_batch_test_results(test_run_id);

-- ============================================================================
-- Demo Evaluations Table
-- Stores user ratings for demo messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS demo_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES demo_messages(id) ON DELETE CASCADE,
  demo_user_id TEXT NOT NULL DEFAULT 'demo-user',
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  success BOOLEAN DEFAULT TRUE,
  failure_tags TEXT[],
  notes TEXT,
  expected_behavior TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for message lookups
CREATE INDEX IF NOT EXISTS idx_demo_evaluations_message
  ON demo_evaluations(message_id);

-- ============================================================================
-- Demo Comparisons Table
-- Stores A/B model comparison results
-- ============================================================================
CREATE TABLE IF NOT EXISTS demo_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_user_id TEXT NOT NULL DEFAULT 'demo-user',
  test_run_id UUID REFERENCES demo_batch_test_runs(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  -- Model A
  model_a_id TEXT NOT NULL,
  model_a_name TEXT,
  model_a_response TEXT,
  model_a_latency_ms INTEGER,
  -- Model B
  model_b_id TEXT NOT NULL,
  model_b_name TEXT,
  model_b_response TEXT,
  model_b_latency_ms INTEGER,
  -- Comparison results
  preferred_model TEXT CHECK (preferred_model IN ('a', 'b', 'tie', NULL)),
  model_a_rating JSONB, -- {clarity, accuracy, conciseness, overall}
  model_b_rating JSONB,
  -- Blind comparison metadata
  display_order TEXT CHECK (display_order IN ('ab', 'ba')), -- Which was shown first
  revealed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for test run lookups
CREATE INDEX IF NOT EXISTS idx_demo_comparisons_test_run
  ON demo_comparisons(test_run_id);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_demo_comparisons_created
  ON demo_comparisons(created_at);

-- ============================================================================
-- Demo Test Suites Table
-- Pre-seeded test suites for demo users
-- ============================================================================
CREATE TABLE IF NOT EXISTS demo_test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  task_domain TEXT NOT NULL, -- 'customer_support', 'code_generation', 'qa', 'creative'
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  prompts JSONB NOT NULL, -- Array of {prompt, expected_answer?}
  prompt_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(prompts)) STORED,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active suites by domain
CREATE INDEX IF NOT EXISTS idx_demo_test_suites_domain
  ON demo_test_suites(task_domain, is_active);

-- ============================================================================
-- Demo Analytics Cache Table
-- Caches computed analytics for demo sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS demo_analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  test_run_id UUID REFERENCES demo_batch_test_runs(id) ON DELETE CASCADE,
  analytics_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_demo_analytics_cache_key
  ON demo_analytics_cache(cache_key);

-- Index for expiry cleanup
CREATE INDEX IF NOT EXISTS idx_demo_analytics_cache_expires
  ON demo_analytics_cache(expires_at);

-- ============================================================================
-- RLS Policies - Demo tables are public (no auth required)
-- ============================================================================

-- Enable RLS on all demo tables
ALTER TABLE demo_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_batch_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_batch_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_analytics_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for demo tables (demo is meant to be public)
-- Note: Rate limiting should be handled at the application layer

CREATE POLICY "demo_conversations_public_access" ON demo_conversations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "demo_messages_public_access" ON demo_messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "demo_batch_test_runs_public_access" ON demo_batch_test_runs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "demo_batch_test_results_public_access" ON demo_batch_test_results
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "demo_evaluations_public_access" ON demo_evaluations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "demo_comparisons_public_access" ON demo_comparisons
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "demo_test_suites_public_read" ON demo_test_suites
  FOR SELECT USING (true);

CREATE POLICY "demo_analytics_cache_public_access" ON demo_analytics_cache
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Cleanup Function - Delete demo data older than 24 hours
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_demo_data()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Delete old analytics cache (expired)
  DELETE FROM demo_analytics_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  -- Delete old comparisons (24 hours)
  DELETE FROM demo_comparisons WHERE created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  -- Delete old evaluations (24 hours)
  DELETE FROM demo_evaluations WHERE created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  -- Delete old batch test results (via cascade from runs)
  -- Delete old batch test runs (24 hours)
  DELETE FROM demo_batch_test_runs WHERE created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  -- Delete old messages (via cascade from conversations)
  -- Delete old conversations (24 hours)
  DELETE FROM demo_conversations WHERE created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE demo_conversations IS 'Isolated conversations for demo page - auto-cleaned after 24 hours';
COMMENT ON TABLE demo_messages IS 'Messages for demo conversations - cascades from demo_conversations';
COMMENT ON TABLE demo_batch_test_runs IS 'Batch test runs for demo - auto-cleaned after 24 hours';
COMMENT ON TABLE demo_batch_test_results IS 'Individual results for demo batch tests';
COMMENT ON TABLE demo_evaluations IS 'User ratings for demo messages';
COMMENT ON TABLE demo_comparisons IS 'A/B model comparison results for demo';
COMMENT ON TABLE demo_test_suites IS 'Pre-seeded test suites for demo users - NOT auto-cleaned';
COMMENT ON TABLE demo_analytics_cache IS 'Cached analytics for demo sessions';
COMMENT ON FUNCTION cleanup_old_demo_data IS 'Call periodically to clean up demo data older than 24 hours';
