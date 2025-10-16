-- Enable RLS on Missing Tables (OPTIMIZED FOR PERFORMANCE)
-- Date: 2025-10-14
-- Updated: 2025-10-14 - Added SELECT wrapper for auth.uid() performance
-- Purpose: Fix Supabase linter errors by enabling RLS on all public tables
-- Run in Supabase SQL Editor
--
-- IMPORTANT: All auth.uid() calls are wrapped in (SELECT auth.uid())
-- This caches the result instead of re-evaluating for every row

-- ============================================================================
-- ENABLE RLS ON CORE TABLES
-- ============================================================================

-- Tools table (from plugin system)
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;

-- Tools are global/shared resources - all authenticated users can view
CREATE POLICY "Authenticated users can view tools"
  ON tools FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify tools (service role)
CREATE POLICY "Service role can manage tools"
  ON tools FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- USER PREFERENCES
-- ============================================================================

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

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

-- ============================================================================
-- CONVERSATION MEMORY
-- ============================================================================

ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;

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

-- ============================================================================
-- RUNS (Experiment Tracking)
-- ============================================================================

ALTER TABLE runs ENABLE ROW LEVEL SECURITY;

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

-- ============================================================================
-- DOCUMENTS (if not already enabled from GraphRAG)
-- ============================================================================

-- Enable RLS if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'documents'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

-- Check if policies exist before creating
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'documents'
    AND policyname = 'Users can view their own documents'
  ) THEN
    CREATE POLICY "Users can view their own documents"
      ON documents FOR SELECT
      USING (user_id::uuid = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'documents'
    AND policyname = 'Users can insert their own documents'
  ) THEN
    CREATE POLICY "Users can insert their own documents"
      ON documents FOR INSERT
      WITH CHECK (user_id::uuid = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'documents'
    AND policyname = 'Users can update their own documents'
  ) THEN
    CREATE POLICY "Users can update their own documents"
      ON documents FOR UPDATE
      USING (user_id::uuid = (SELECT auth.uid()))
      WITH CHECK (user_id::uuid = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'documents'
    AND policyname = 'Users can delete their own documents'
  ) THEN
    CREATE POLICY "Users can delete their own documents"
      ON documents FOR DELETE
      USING (user_id::uuid = (SELECT auth.uid()));
  END IF;
END
$$;

-- ============================================================================
-- CALCULATOR HISTORY (if table exists)
-- ============================================================================

-- Only enable RLS if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'calculator_history'
  ) THEN
    ALTER TABLE calculator_history ENABLE ROW LEVEL SECURITY;

    -- Create policies
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
-- VERIFICATION
-- ============================================================================

-- Check which tables now have RLS enabled
SELECT
  tablename,
  rowsecurity as "RLS Enabled",
  (SELECT COUNT(*) FROM pg_policies WHERE pg_policies.tablename = pg_tables.tablename) as "Policy Count"
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('tools', 'documents', 'user_preferences', 'conversation_memory', 'runs', 'calculator_history')
ORDER BY tablename;
