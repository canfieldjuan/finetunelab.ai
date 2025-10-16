-- Session Tracking for A/B Testing & Model Comparison
-- Adds session_id and experiment_name columns to conversations table
-- Date: 2025-10-15
-- Run in Supabase SQL editor

-- ============================================
-- ALTER CONVERSATIONS TABLE
-- ============================================

-- Add session tracking columns
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS experiment_name TEXT;

COMMENT ON COLUMN conversations.session_id IS 'User-defined session identifier for grouping related conversations (e.g., "test-run-1", "production-2024-10")';
COMMENT ON COLUMN conversations.experiment_name IS 'Human-readable experiment name (e.g., "GPT-4 vs Claude Comparison", "Temperature Testing")';

-- ============================================
-- CREATE INDEXES
-- ============================================

-- Index for filtering conversations by session
CREATE INDEX IF NOT EXISTS idx_conversations_session_id
  ON conversations(session_id) WHERE session_id IS NOT NULL;

-- Index for filtering conversations by experiment name
CREATE INDEX IF NOT EXISTS idx_conversations_experiment_name
  ON conversations(experiment_name) WHERE experiment_name IS NOT NULL;

-- Composite index for user + session filtering (common query pattern)
CREATE INDEX IF NOT EXISTS idx_conversations_user_session
  ON conversations(user_id, session_id) WHERE session_id IS NOT NULL;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check columns were added
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'conversations'
  AND column_name IN ('session_id', 'experiment_name', 'llm_model_id')
ORDER BY column_name;

-- Check indexes were created
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'conversations'
  AND indexname LIKE '%session%'
ORDER BY indexname;

-- Count conversations with session tags (should be 0 initially)
SELECT
  COUNT(*) FILTER (WHERE session_id IS NOT NULL) as with_session,
  COUNT(*) FILTER (WHERE session_id IS NULL) as without_session,
  COUNT(*) as total
FROM conversations;

-- ============================================
-- SAMPLE QUERIES FOR TESTING
-- ============================================

-- Query 1: Get all sessions for a user
-- SELECT DISTINCT session_id, experiment_name, COUNT(*) as conversation_count
-- FROM conversations
-- WHERE user_id = 'your-user-id-here' AND session_id IS NOT NULL
-- GROUP BY session_id, experiment_name
-- ORDER BY MAX(created_at) DESC;

-- Query 2: Get conversations for a specific session
-- SELECT id, title, llm_model_id, created_at
-- FROM conversations
-- WHERE user_id = 'your-user-id-here'
--   AND session_id = 'test-session-1'
-- ORDER BY created_at DESC;

-- Query 3: Compare metrics across sessions
-- SELECT
--   c.session_id,
--   c.experiment_name,
--   COUNT(DISTINCT c.id) as conversation_count,
--   COUNT(m.id) as message_count,
--   AVG(m.latency_ms) as avg_latency,
--   SUM(m.input_tokens) as total_input_tokens,
--   SUM(m.output_tokens) as total_output_tokens
-- FROM conversations c
-- LEFT JOIN messages m ON m.conversation_id = c.id
-- WHERE c.user_id = 'your-user-id-here'
--   AND c.session_id IS NOT NULL
-- GROUP BY c.session_id, c.experiment_name
-- ORDER BY MAX(c.created_at) DESC;

-- ============================================
-- ROLLBACK (if needed)
-- ============================================

-- UNCOMMIT THESE ONLY IF YOU NEED TO UNDO:
-- DROP INDEX IF EXISTS idx_conversations_user_session;
-- DROP INDEX IF EXISTS idx_conversations_experiment_name;
-- DROP INDEX IF EXISTS idx_conversations_session_id;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS experiment_name;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS session_id;
