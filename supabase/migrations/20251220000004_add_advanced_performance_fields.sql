-- Add advanced performance tracking fields to llm_traces
-- Phase 1: Database Schema Enhancement
-- Date: 2025-12-20

-- Cache tracking (Anthropic prompt caching)
ALTER TABLE public.llm_traces
  ADD COLUMN IF NOT EXISTS cache_creation_input_tokens INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cache_read_input_tokens INTEGER DEFAULT NULL;

-- Retry tracking
ALTER TABLE public.llm_traces
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_reason TEXT DEFAULT NULL;

-- Error categorization
ALTER TABLE public.llm_traces
  ADD COLUMN IF NOT EXISTS error_category TEXT DEFAULT NULL;

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_llm_traces_error_category ON public.llm_traces(error_category);
CREATE INDEX IF NOT EXISTS idx_llm_traces_model_provider ON public.llm_traces(model_provider);
CREATE INDEX IF NOT EXISTS idx_llm_traces_cache_read ON public.llm_traces(cache_read_input_tokens)
  WHERE cache_read_input_tokens IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_llm_traces_retry_count ON public.llm_traces(retry_count)
  WHERE retry_count > 0;

-- Add comments for documentation
COMMENT ON COLUMN public.llm_traces.cache_creation_input_tokens IS
  'Tokens used to create cache (Anthropic prompt caching) - charged at 1.25x input rate';

COMMENT ON COLUMN public.llm_traces.cache_read_input_tokens IS
  'Tokens read from cache (Anthropic prompt caching) - charged at 0.1x input rate (90% discount)';

COMMENT ON COLUMN public.llm_traces.retry_count IS
  'Number of retry attempts for this operation (0 = first attempt, 1+ = retried)';

COMMENT ON COLUMN public.llm_traces.retry_reason IS
  'Reason for retry (e.g., rate_limit, timeout, network_error)';

COMMENT ON COLUMN public.llm_traces.error_category IS
  'Categorized error type for pattern detection: rate_limit, timeout, auth, validation, api_error, network_error, quota_exceeded, model_overloaded, unknown';
