-- Migration: Add Performance Metrics to LLM Traces
-- Date: 2025-12-20
-- Purpose: Add TTFT and throughput tracking for enhanced observability

-- Add performance metric columns
ALTER TABLE public.llm_traces
  ADD COLUMN IF NOT EXISTS ttft_ms NUMERIC,
  ADD COLUMN IF NOT EXISTS tokens_per_second NUMERIC;

-- Add indexes for performance queries
CREATE INDEX IF NOT EXISTS idx_llm_traces_ttft_ms
  ON public.llm_traces(ttft_ms)
  WHERE ttft_ms IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_llm_traces_tokens_per_second
  ON public.llm_traces(tokens_per_second)
  WHERE tokens_per_second IS NOT NULL;

-- Create GIN indexes on JSONB columns if not exists (for efficient queries on input_data, output_data)
CREATE INDEX IF NOT EXISTS idx_llm_traces_input_data_gin
  ON public.llm_traces USING gin(input_data);

CREATE INDEX IF NOT EXISTS idx_llm_traces_output_data_gin
  ON public.llm_traces USING gin(output_data);

CREATE INDEX IF NOT EXISTS idx_llm_traces_metadata_gin
  ON public.llm_traces USING gin(metadata);

-- Add comments for documentation
COMMENT ON COLUMN public.llm_traces.ttft_ms IS 'Time to first token in milliseconds (streaming only)';
COMMENT ON COLUMN public.llm_traces.tokens_per_second IS 'Token generation throughput (output_tokens / duration_ms * 1000)';
