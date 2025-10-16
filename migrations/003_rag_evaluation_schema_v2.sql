-- Migration 003 v2: RAG Evaluation Framework Schema (FIXED)
-- Date: 2025-10-14
-- Phase: RAG Evaluation - Production-Grade Metrics
-- Description: Creates tables for experiment tracking, document management,
--              retrieval logging, citations, judgments, and error tracking
--
-- IMPORTANT: This version ALTERs the existing documents table from GraphRAG
--            instead of creating a new one
--
-- Tables Created:
--   1. runs - Experiment tracking (A/B testing, version control)
--   2. chunks - Document chunks with vector embeddings
--   3. retriever_logs - Audit trail of retrieval operations
--   4. citations - Answer-to-document attribution links
--   5. judgments - Unified evaluation (rule/human/llm judges)
--   6. tool_calls - Normalized tool execution tracking
--   7. errors - Normalized error tracking
--
-- Tables Modified:
--   - documents: Add columns for RAG evaluation (checksum, content, etc.)
--   - messages: Add content_json JSONB column
--
-- Dependencies:
--   - pgvector extension (for embeddings)
--   - Existing tables: messages, conversations, auth.users, documents

-- ============================================================================
-- VERIFY DEPENDENCIES
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Check pgvector extension
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    RAISE EXCEPTION 'pgvector extension not found. Run: CREATE EXTENSION vector;';
  END IF;
END
$$;

-- ============================================================================
-- TABLE 1: RUNS - Experiment Tracking
-- ============================================================================
-- Purpose: Track different experiment runs for A/B testing and version control
-- Use case: Compare prompt v1 vs v2, model A vs B, dataset versions

CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  dataset_version TEXT,
  git_sha TEXT,
  config_json JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for experiment queries
CREATE INDEX IF NOT EXISTS idx_runs_model_name ON runs(model_name);
CREATE INDEX IF NOT EXISTS idx_runs_prompt_version ON runs(prompt_version);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at DESC);

-- Comments
COMMENT ON TABLE runs IS 'Experiment tracking for A/B testing and reproducibility';
COMMENT ON COLUMN runs.git_sha IS 'Git commit SHA for code reproducibility';
COMMENT ON COLUMN runs.config_json IS 'JSON config: temperature, top_p, etc.';

-- ============================================================================
-- MODIFY EXISTING DOCUMENTS TABLE (from GraphRAG)
-- ============================================================================
-- Purpose: Extend existing documents table with RAG evaluation fields
-- Note: GraphRAG table has: id, user_id, filename, file_type, upload_path,
--       processed, neo4j_episode_ids, created_at, updated_at, metadata

-- Add new columns for RAG evaluation (all nullable for backward compatibility)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS uri TEXT,
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS checksum TEXT,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private',
ADD COLUMN IF NOT EXISTS owner TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add CHECK constraint separately to avoid issues
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_visibility_check'
  ) THEN
    ALTER TABLE documents ADD CONSTRAINT documents_visibility_check
      CHECK (visibility IN ('private', 'team', 'public') OR visibility IS NULL);
  END IF;
END
$$;

-- Rename metadata to metadata_json if not already done
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE documents RENAME COLUMN metadata TO metadata_json;
  END IF;
END
$$;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_documents_checksum ON documents(checksum);
CREATE INDEX IF NOT EXISTS idx_documents_visibility ON documents(visibility);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);

-- Comments
COMMENT ON COLUMN documents.checksum IS 'SHA256 hash for deduplication and version tracking';
COMMENT ON COLUMN documents.visibility IS 'Access control: private, team, public';
COMMENT ON COLUMN documents.content IS 'Full document content (for RAG evaluation)';
COMMENT ON COLUMN documents.title IS 'Document title (can differ from filename)';

-- ============================================================================
-- TABLE 2: CHUNKS - Document Chunks with Embeddings
-- ============================================================================
-- Purpose: Store document chunks with vector embeddings for semantic search
-- Use case: RAG retrieval, similarity search

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  embedding_vector vector(1536),
  page INTEGER,
  section TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for chunk queries
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON chunks USING ivfflat (embedding_vector vector_cosine_ops)
  WITH (lists = 100);

-- Comments
COMMENT ON TABLE chunks IS 'Document chunks with embeddings for semantic search';
COMMENT ON COLUMN chunks.embedding_vector IS 'OpenAI ada-002 embeddings (1536 dimensions)';
COMMENT ON COLUMN chunks.page IS 'Page number (for PDFs)';

-- ============================================================================
-- TABLE 3: RETRIEVER_LOGS - Audit Trail of Retrieval Operations
-- ============================================================================
-- Purpose: Log every retrieval operation for debugging and quality analysis
-- Use case: Analyze retrieval quality, track topk performance

CREATE TABLE IF NOT EXISTS retriever_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  topk INTEGER NOT NULL,
  retrieved_doc_ids UUID[],
  scores FLOAT[],
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for retriever analysis
CREATE INDEX IF NOT EXISTS idx_retriever_logs_conversation_id ON retriever_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_retriever_logs_user_id ON retriever_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_retriever_logs_created_at ON retriever_logs(created_at DESC);

-- Comments
COMMENT ON TABLE retriever_logs IS 'Audit trail of all RAG retrieval operations';
COMMENT ON COLUMN retriever_logs.retrieved_doc_ids IS 'Array of document UUIDs retrieved';
COMMENT ON COLUMN retriever_logs.scores IS 'Relevance scores for each retrieved doc';

-- ============================================================================
-- TABLE 4: CITATIONS - Answer-to-Document Attribution
-- ============================================================================
-- Purpose: Track which documents were cited in each answer
-- Use case: Grounding validation, citation correctness analysis

CREATE TABLE IF NOT EXISTS citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  span_start INTEGER,
  span_end INTEGER,
  quote TEXT,
  correctness BOOLEAN,
  retriever_log_id UUID REFERENCES retriever_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for citation queries
CREATE INDEX IF NOT EXISTS idx_citations_message_id ON citations(message_id);
CREATE INDEX IF NOT EXISTS idx_citations_document_id ON citations(document_id);
CREATE INDEX IF NOT EXISTS idx_citations_correctness ON citations(correctness)
  WHERE correctness IS NOT NULL;

-- Comments
COMMENT ON TABLE citations IS 'Answer-to-document attribution links';
COMMENT ON COLUMN citations.span_start IS 'Character offset start in answer';
COMMENT ON COLUMN citations.span_end IS 'Character offset end in answer';
COMMENT ON COLUMN citations.correctness IS 'Human/LLM validated citation correctness';

-- ============================================================================
-- TABLE 5: JUDGMENTS - Unified Evaluation Table
-- ============================================================================
-- Purpose: Store ALL evaluations (rule-based, human, LLM-as-judge)
-- Use case: Unified metrics, multi-judge comparison, experiment tracking

CREATE TABLE IF NOT EXISTS judgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
  judge_type TEXT NOT NULL CHECK (judge_type IN ('rule', 'human', 'llm')),
  judge_name TEXT,
  criterion TEXT NOT NULL,
  score FLOAT NOT NULL CHECK (score >= 0 AND score <= 1),
  passed BOOLEAN NOT NULL,
  evidence_json JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for judgment queries
CREATE INDEX IF NOT EXISTS idx_judgments_message_id ON judgments(message_id);
CREATE INDEX IF NOT EXISTS idx_judgments_run_id ON judgments(run_id);
CREATE INDEX IF NOT EXISTS idx_judgments_judge_type ON judgments(judge_type);
CREATE INDEX IF NOT EXISTS idx_judgments_criterion ON judgments(criterion);
CREATE INDEX IF NOT EXISTS idx_judgments_passed ON judgments(passed);

-- Comments
COMMENT ON TABLE judgments IS 'Unified evaluation table for rule/human/llm judges';
COMMENT ON COLUMN judgments.judge_type IS 'Type: rule (automated), human, llm (LLM-as-judge)';
COMMENT ON COLUMN judgments.criterion IS 'What is being evaluated: citation_required, factual_accuracy, etc.';
COMMENT ON COLUMN judgments.score IS 'Normalized score 0.0-1.0 (0=worst, 1=best)';
COMMENT ON COLUMN judgments.evidence_json IS 'Supporting evidence for the judgment';

-- ============================================================================
-- TABLE 6: TOOL_CALLS - Normalized Tool Execution Tracking
-- ============================================================================
-- Purpose: Track individual tool calls (replaces tools_called JSONB)
-- Use case: Tool performance analysis, debugging tool failures

CREATE TABLE IF NOT EXISTS tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  input_json JSONB NOT NULL,
  output_json JSONB,
  success BOOLEAN NOT NULL,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for tool analysis
CREATE INDEX IF NOT EXISTS idx_tool_calls_message_id ON tool_calls(message_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name ON tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_calls_success ON tool_calls(success);
CREATE INDEX IF NOT EXISTS idx_tool_calls_created_at ON tool_calls(created_at DESC);

-- Comments
COMMENT ON TABLE tool_calls IS 'Normalized tool execution tracking';
COMMENT ON COLUMN tool_calls.input_json IS 'Tool input parameters as JSON';
COMMENT ON COLUMN tool_calls.output_json IS 'Tool output result as JSON';

-- ============================================================================
-- TABLE 7: ERRORS - Normalized Error Tracking
-- ============================================================================
-- Purpose: Track all errors for analysis and debugging
-- Use case: Error analysis, failure categorization

CREATE TABLE IF NOT EXISTS errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for error analysis
CREATE INDEX IF NOT EXISTS idx_errors_message_id ON errors(message_id);
CREATE INDEX IF NOT EXISTS idx_errors_conversation_id ON errors(conversation_id);
CREATE INDEX IF NOT EXISTS idx_errors_error_type ON errors(error_type);
CREATE INDEX IF NOT EXISTS idx_errors_severity ON errors(severity);
CREATE INDEX IF NOT EXISTS idx_errors_created_at ON errors(created_at DESC);

-- Comments
COMMENT ON TABLE errors IS 'Normalized error tracking for analysis';
COMMENT ON COLUMN errors.error_type IS 'Category: timeout, rate_limit, context_length, api_error, etc.';
COMMENT ON COLUMN errors.severity IS 'Impact level: low, medium, high, critical';

-- ============================================================================
-- MODIFY MESSAGES TABLE
-- ============================================================================

-- Add content_json column to messages table for structured output
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS content_json JSONB;

-- Add index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_messages_content_json
  ON messages USING GIN(content_json);

-- Comment
COMMENT ON COLUMN messages.content_json IS 'Structured JSON output from LLM (validated by Zod schemas)';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Note: documents table already has RLS policies from GraphRAG
-- We only need to add policies for new tables

-- Enable RLS on new tables
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE retriever_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE judgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE errors ENABLE ROW LEVEL SECURITY;

-- CHUNKS: Users can only access chunks from their documents
-- Note: Cast documents.user_id to UUID since it may be TEXT type
CREATE POLICY "Users can view chunks from their documents"
  ON chunks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = chunks.document_id
    AND documents.user_id::uuid = (SELECT auth.uid())
  ));

-- RETRIEVER_LOGS: Users can only access their own logs
CREATE POLICY "Users can view their own retriever logs"
  ON retriever_logs FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own retriever logs"
  ON retriever_logs FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- CITATIONS: Users can view citations from their messages
-- Note: Cast messages.user_id to UUID since it may be TEXT type
CREATE POLICY "Users can view citations from their messages"
  ON citations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = citations.message_id
    AND messages.user_id::uuid = (SELECT auth.uid())
  ));

-- JUDGMENTS: Users can view judgments on their messages
-- Note: Cast messages.user_id to UUID since it may be TEXT type
CREATE POLICY "Users can view judgments on their messages"
  ON judgments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = judgments.message_id
    AND messages.user_id::uuid = (SELECT auth.uid())
  ));

-- TOOL_CALLS: Users can view tool calls from their messages
-- Note: Cast messages.user_id to UUID since it may be TEXT type
CREATE POLICY "Users can view tool calls from their messages"
  ON tool_calls FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = tool_calls.message_id
    AND messages.user_id::uuid = (SELECT auth.uid())
  ));

-- ERRORS: Users can view errors from their conversations
-- Note: Cast conversations.user_id to UUID since it may be TEXT type
CREATE POLICY "Users can view errors from their conversations"
  ON errors FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = errors.conversation_id
    AND conversations.user_id::uuid = (SELECT auth.uid())
  ));

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries after migration to verify everything was created correctly

-- Verify all tables exist
/*
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'runs', 'documents', 'chunks', 'retriever_logs',
  'citations', 'judgments', 'tool_calls', 'errors'
)
ORDER BY tablename;
*/

-- Verify documents table has new columns
/*
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'documents'
AND column_name IN ('checksum', 'content', 'title', 'uri', 'visibility', 'owner', 'tags')
ORDER BY column_name;
*/

-- Verify messages.content_json column exists
/*
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'messages'
AND column_name = 'content_json';
*/

-- Verify all indexes were created
/*
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
  'runs', 'documents', 'chunks', 'retriever_logs',
  'citations', 'judgments', 'tool_calls', 'errors', 'messages'
)
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
*/

-- Verify RLS policies
/*
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
  'chunks', 'retriever_logs', 'citations',
  'judgments', 'tool_calls', 'errors'
)
ORDER BY tablename, policyname;
*/

-- Check pgvector extension
/*
SELECT * FROM pg_extension WHERE extname = 'vector';
*/

-- Count records (should all be 0 initially except documents)
/*
SELECT 'runs' AS table_name, COUNT(*) FROM runs
UNION ALL
SELECT 'chunks', COUNT(*) FROM chunks
UNION ALL
SELECT 'retriever_logs', COUNT(*) FROM retriever_logs
UNION ALL
SELECT 'citations', COUNT(*) FROM citations
UNION ALL
SELECT 'judgments', COUNT(*) FROM judgments
UNION ALL
SELECT 'tool_calls', COUNT(*) FROM tool_calls
UNION ALL
SELECT 'errors', COUNT(*) FROM errors;
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Verify tables created with verification queries above
-- 2. Create TypeScript schemas (company-expert.schema.ts, pc-expert.schema.ts)
-- 3. Create validators (structured-output.validator.ts, rule-validators.ts)
-- 4. Create services (citations.service.ts, retriever-logs.service.ts, judgments.service.ts)
-- 5. Integrate into chat route (app/api/chat/route.ts)
--
-- See: docs/RAG_EVALUATION_INSERTION_POINTS.md for detailed implementation guide
