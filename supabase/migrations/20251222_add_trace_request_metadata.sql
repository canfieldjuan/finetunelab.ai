-- Migration: Add Trace Request Metadata
-- Created: 2025-12-22
-- Purpose: Extend llm_traces with request, performance, RAG, and evaluation metadata

-- 1. Request Metadata
ALTER TABLE public.llm_traces
  ADD COLUMN IF NOT EXISTS api_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS api_base_url TEXT,
  ADD COLUMN IF NOT EXISTS request_headers_sanitized JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS provider_request_id TEXT;

-- 2. Performance Metrics
ALTER TABLE public.llm_traces
  ADD COLUMN IF NOT EXISTS queue_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS inference_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS network_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS streaming_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS chunk_usage JSONB DEFAULT '{}'::jsonb;

-- 3. RAG & Context Metrics
ALTER TABLE public.llm_traces
  ADD COLUMN IF NOT EXISTS context_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS retrieval_latency_ms INTEGER;

-- 4. Evaluation & Quality Metrics
ALTER TABLE public.llm_traces
  ADD COLUMN IF NOT EXISTS groundedness_score NUMERIC(4, 3), -- 0.000 to 1.000
  ADD COLUMN IF NOT EXISTS response_quality_breakdown JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS warning_flags TEXT[] DEFAULT '{}';

-- 5. Create Indexes for Analytics
CREATE INDEX IF NOT EXISTS idx_llm_traces_api_endpoint ON public.llm_traces(api_endpoint);
CREATE INDEX IF NOT EXISTS idx_llm_traces_streaming_enabled ON public.llm_traces(streaming_enabled);
CREATE INDEX IF NOT EXISTS idx_llm_traces_provider_request_id ON public.llm_traces(provider_request_id);
CREATE INDEX IF NOT EXISTS idx_llm_traces_warning_flags ON public.llm_traces USING GIN(warning_flags);

-- 6. Add Comments
COMMENT ON COLUMN public.llm_traces.api_endpoint IS 'Full API endpoint URL called';
COMMENT ON COLUMN public.llm_traces.request_headers_sanitized IS 'Sanitized request headers (auth masked)';
COMMENT ON COLUMN public.llm_traces.queue_time_ms IS 'Time spent in provider queue before processing';
COMMENT ON COLUMN public.llm_traces.inference_time_ms IS 'Time spent generating tokens (excluding queue/network)';
COMMENT ON COLUMN public.llm_traces.streaming_enabled IS 'Whether the response was streamed';
COMMENT ON COLUMN public.llm_traces.chunk_usage IS 'Detailed usage per chunk/step';
COMMENT ON COLUMN public.llm_traces.groundedness_score IS 'RAG groundedness score (0-1)';
COMMENT ON COLUMN public.llm_traces.warning_flags IS 'Array of warning codes (e.g., token_limit, fallback_triggered)';
