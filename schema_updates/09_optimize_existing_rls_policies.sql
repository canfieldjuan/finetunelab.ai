-- Optimize Existing RLS Policies for Performance
-- Date: 2025-10-14
-- Purpose: Fix auth_rls_initplan warnings by wrapping auth.uid() in SELECT
-- Run in Supabase SQL Editor AFTER tables have RLS enabled
--
-- WHAT THIS FIXES:
-- PostgreSQL re-evaluates auth.uid() for every row without SELECT wrapper
-- Wrapping in (SELECT auth.uid()) caches the result for the entire query
-- This can improve query performance by 10-100x on large tables
--
-- TABLES AFFECTED:
-- - conversations, messages, feedback, session_logs (core tables)
-- - conversation_exports, message_evaluations (evaluation tables)
-- - user_preferences, conversation_memory (memory system)
-- - documents, runs, calculator_history (data tables)
-- - prompt_patterns (new table)

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;

CREATE POLICY "Users can view their own conversations"
  ON conversations FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own conversations"
  ON conversations FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own conversations"
  ON conversations FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON conversations FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Users can create messages in their conversations"
  ON messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- FEEDBACK TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can create their own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can update their own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can delete their own feedback" ON feedback;

CREATE POLICY "Users can view their own feedback"
  ON feedback FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own feedback"
  ON feedback FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own feedback"
  ON feedback FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own feedback"
  ON feedback FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- SESSION_LOGS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own session logs" ON session_logs;
DROP POLICY IF EXISTS "Users can create their own session logs" ON session_logs;

CREATE POLICY "Users can view their own session logs"
  ON session_logs FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own session logs"
  ON session_logs FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- CONVERSATION_EXPORTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own exports" ON conversation_exports;
DROP POLICY IF EXISTS "Users can create their own exports" ON conversation_exports;
DROP POLICY IF EXISTS "Users can update their own exports" ON conversation_exports;
DROP POLICY IF EXISTS "Users can delete their own exports" ON conversation_exports;

CREATE POLICY "Users can view their own exports"
  ON conversation_exports FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own exports"
  ON conversation_exports FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own exports"
  ON conversation_exports FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own exports"
  ON conversation_exports FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- MESSAGE_EVALUATIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own evaluations" ON message_evaluations;
DROP POLICY IF EXISTS "Users can insert their own evaluations" ON message_evaluations;
DROP POLICY IF EXISTS "Users can update their own evaluations" ON message_evaluations;

CREATE POLICY "Users can view their own evaluations"
  ON message_evaluations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = message_evaluations.message_id
    AND messages.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Users can insert their own evaluations"
  ON message_evaluations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = message_evaluations.message_id
    AND messages.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Users can update their own evaluations"
  ON message_evaluations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = message_evaluations.message_id
    AND messages.user_id = (SELECT auth.uid())
  ));

-- ============================================================================
-- USER_PREFERENCES TABLE (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_preferences') THEN
    DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
    DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
    DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
    DROP POLICY IF EXISTS "Users can delete their own preferences" ON user_preferences;

    CREATE POLICY "Users can view their own preferences"
      ON user_preferences FOR SELECT
      USING ((SELECT auth.uid()) = user_id);

    CREATE POLICY "Users can insert their own preferences"
      ON user_preferences FOR INSERT
      WITH CHECK ((SELECT auth.uid()) = user_id);

    CREATE POLICY "Users can update their own preferences"
      ON user_preferences FOR UPDATE
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);

    CREATE POLICY "Users can delete their own preferences"
      ON user_preferences FOR DELETE
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END
$$;

-- ============================================================================
-- CONVERSATION_MEMORY TABLE (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversation_memory') THEN
    DROP POLICY IF EXISTS "Users can view their conversation memory" ON conversation_memory;
    DROP POLICY IF EXISTS "Users can insert memory for their conversations" ON conversation_memory;
    DROP POLICY IF EXISTS "Users can update memory for their conversations" ON conversation_memory;
    DROP POLICY IF EXISTS "Users can delete memory for their conversations" ON conversation_memory;

    CREATE POLICY "Users can view their conversation memory"
      ON conversation_memory FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = conversation_memory.conversation_id
        AND conversations.user_id = (SELECT auth.uid())
      ));

    CREATE POLICY "Users can insert memory for their conversations"
      ON conversation_memory FOR INSERT
      WITH CHECK (EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = conversation_memory.conversation_id
        AND conversations.user_id = (SELECT auth.uid())
      ));

    CREATE POLICY "Users can update memory for their conversations"
      ON conversation_memory FOR UPDATE
      USING (EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = conversation_memory.conversation_id
        AND conversations.user_id = (SELECT auth.uid())
      ));

    CREATE POLICY "Users can delete memory for their conversations"
      ON conversation_memory FOR DELETE
      USING (EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = conversation_memory.conversation_id
        AND conversations.user_id = (SELECT auth.uid())
      ));
  END IF;
END
$$;

-- ============================================================================
-- DOCUMENTS TABLE (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents') THEN
    DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
    DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
    DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
    DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;

    CREATE POLICY "Users can view their own documents"
      ON documents FOR SELECT
      USING (user_id::uuid = (SELECT auth.uid()));

    CREATE POLICY "Users can insert their own documents"
      ON documents FOR INSERT
      WITH CHECK (user_id::uuid = (SELECT auth.uid()));

    CREATE POLICY "Users can update their own documents"
      ON documents FOR UPDATE
      USING (user_id::uuid = (SELECT auth.uid()))
      WITH CHECK (user_id::uuid = (SELECT auth.uid()));

    CREATE POLICY "Users can delete their own documents"
      ON documents FOR DELETE
      USING (user_id::uuid = (SELECT auth.uid()));
  END IF;
END
$$;

-- ============================================================================
-- RUNS TABLE (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'runs') THEN
    DROP POLICY IF EXISTS "Users can view their own runs" ON runs;
    DROP POLICY IF EXISTS "Users can insert their own runs" ON runs;
    DROP POLICY IF EXISTS "Users can update their own runs" ON runs;
    DROP POLICY IF EXISTS "Users can delete their own runs" ON runs;

    CREATE POLICY "Users can view their own runs"
      ON runs FOR SELECT
      USING ((SELECT auth.uid()) = created_by);

    CREATE POLICY "Users can insert their own runs"
      ON runs FOR INSERT
      WITH CHECK ((SELECT auth.uid()) = created_by);

    CREATE POLICY "Users can update their own runs"
      ON runs FOR UPDATE
      USING ((SELECT auth.uid()) = created_by)
      WITH CHECK ((SELECT auth.uid()) = created_by);

    CREATE POLICY "Users can delete their own runs"
      ON runs FOR DELETE
      USING ((SELECT auth.uid()) = created_by);
  END IF;
END
$$;

-- ============================================================================
-- CALCULATOR_HISTORY TABLE (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'calculator_history') THEN
    DROP POLICY IF EXISTS "Users can view their own calculator history" ON calculator_history;
    DROP POLICY IF EXISTS "Users can insert their own calculator history" ON calculator_history;

    CREATE POLICY "Users can view their own calculator history"
      ON calculator_history FOR SELECT
      USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "Users can insert their own calculator history"
      ON calculator_history FOR INSERT
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END
$$;

-- ============================================================================
-- PROMPT_PATTERNS TABLE (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'prompt_patterns') THEN
    DROP POLICY IF EXISTS "Users can view their own patterns" ON prompt_patterns;
    DROP POLICY IF EXISTS "Users can insert their own patterns" ON prompt_patterns;
    DROP POLICY IF EXISTS "Users can update their own patterns" ON prompt_patterns;
    DROP POLICY IF EXISTS "Users can delete their own patterns" ON prompt_patterns;

    CREATE POLICY "Users can view their own patterns"
      ON prompt_patterns FOR SELECT
      USING ((SELECT auth.uid()) = user_id);

    CREATE POLICY "Users can insert their own patterns"
      ON prompt_patterns FOR INSERT
      WITH CHECK ((SELECT auth.uid()) = user_id);

    CREATE POLICY "Users can update their own patterns"
      ON prompt_patterns FOR UPDATE
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);

    CREATE POLICY "Users can delete their own patterns"
      ON prompt_patterns FOR DELETE
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that policies were recreated
SELECT
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
  'conversations', 'messages', 'feedback', 'session_logs',
  'conversation_exports', 'message_evaluations',
  'user_preferences', 'conversation_memory',
  'documents', 'runs', 'calculator_history', 'prompt_patterns'
)
ORDER BY tablename, policyname;
