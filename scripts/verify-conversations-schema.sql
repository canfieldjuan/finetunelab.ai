-- ============================================================================
-- VERIFY CONVERSATIONS TABLE SCHEMA
-- ============================================================================
-- Purpose: Check if conversations table has required columns for session tagging
-- Date: 2025-12-19
-- Run in Supabase SQL Editor
-- ============================================================================

-- Query 1: Get all columns for conversations table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'conversations'
ORDER BY ordinal_position;

-- Query 2: Check for specific columns needed for auto-session-tagging
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'session_id'
      AND data_type = 'text'
  ) THEN 'YES' ELSE 'NO' END AS has_session_id_text,

  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'experiment_name'
      AND data_type = 'text'
  ) THEN 'YES' ELSE 'NO' END AS has_experiment_name_text,

  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'llm_model_id'
  ) THEN 'YES' ELSE 'NO' END AS has_llm_model_id;

-- Query 3: Sample existing data
SELECT
  id,
  user_id,
  title,
  session_id,
  experiment_name,
  llm_model_id,
  created_at
FROM conversations
ORDER BY created_at DESC
LIMIT 5;

-- Query 4: Count conversations with session tagging
SELECT
  COUNT(*) AS total_conversations,
  COUNT(session_id) AS with_session_id,
  COUNT(experiment_name) AS with_experiment_name,
  COUNT(llm_model_id) AS with_llm_model_id
FROM conversations;
