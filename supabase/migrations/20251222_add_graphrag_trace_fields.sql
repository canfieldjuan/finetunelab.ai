-- Migration: Add GraphRAG-specific fields to llm_traces
-- Created: 2025-12-22
-- Purpose: Add detailed GraphRAG retrieval metrics to traces for better RAG observability

-- Add GraphRAG-specific columns
ALTER TABLE public.llm_traces
  ADD COLUMN IF NOT EXISTS rag_graph_used BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rag_nodes_retrieved INTEGER,
  ADD COLUMN IF NOT EXISTS rag_chunks_used INTEGER,
  ADD COLUMN IF NOT EXISTS rag_relevance_score NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS rag_answer_grounded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rag_retrieval_method TEXT;

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_llm_traces_rag_graph_used
  ON public.llm_traces(rag_graph_used) WHERE rag_graph_used = true;
CREATE INDEX IF NOT EXISTS idx_llm_traces_rag_retrieval_method
  ON public.llm_traces(rag_retrieval_method);

-- Add comments for documentation
COMMENT ON COLUMN public.llm_traces.rag_graph_used
  IS 'Whether knowledge graph was used for retrieval';
COMMENT ON COLUMN public.llm_traces.rag_nodes_retrieved
  IS 'Number of graph nodes retrieved';
COMMENT ON COLUMN public.llm_traces.rag_chunks_used
  IS 'Number of context chunks used in prompt';
COMMENT ON COLUMN public.llm_traces.rag_relevance_score
  IS 'Average relevance score of retrieved context (0-1)';
COMMENT ON COLUMN public.llm_traces.rag_answer_grounded
  IS 'Whether answer is grounded in retrieved graph context';
COMMENT ON COLUMN public.llm_traces.rag_retrieval_method
  IS 'Retrieval method used: semantic, keyword, or hybrid';
