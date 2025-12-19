-- ============================================================================
-- ADD SESSION_TAG COLUMN TO LLM_TRACES
-- ============================================================================
-- Purpose: Enable trace search by user-friendly session tags
-- Date: 2025-12-19
-- Dependencies: Requires conversations table to have session_id column
-- 
-- This migration adds a session_tag column to llm_traces for easier searching
-- and grouping of traces by model version and chat session.
-- ============================================================================

-- Add session_tag column (nullable for backward compatibility)
ALTER TABLE public.llm_traces
ADD COLUMN IF NOT EXISTS session_tag TEXT;

-- Create index for fast session_tag lookups
CREATE INDEX IF NOT EXISTS idx_llm_traces_session_tag
  ON public.llm_traces(session_tag)
  WHERE session_tag IS NOT NULL;

-- Create composite index for user + session_tag queries
CREATE INDEX IF NOT EXISTS idx_llm_traces_user_session
  ON public.llm_traces(user_id, session_tag)
  WHERE session_tag IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.llm_traces.session_tag IS 
  'User-friendly session tag for trace search. Format: chat_model_{uuid}_{counter}. Copied from conversations.session_id on trace creation.';
