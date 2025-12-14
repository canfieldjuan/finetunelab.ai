-- Migration: Create API Key Usage Logs Table
-- Purpose: Detailed per-request tracking for API key authenticated endpoints
-- Date: 2025-12-12

-- ============================================================================
-- TABLE: api_key_usage_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_key_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.user_api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Request identification
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  scope_used TEXT,

  -- Timing
  request_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latency_ms INTEGER,

  -- Token usage (for LLM endpoints like /api/v1/predict)
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,

  -- Model information (for predict endpoint)
  model_id TEXT,
  model_provider TEXT,

  -- Response status
  status TEXT NOT NULL DEFAULT 'pending',
  status_code INTEGER,
  error_type TEXT,
  error_message TEXT,

  -- Request metadata (flexible JSON for additional context)
  request_metadata JSONB DEFAULT '{}'::jsonb,

  -- Client information (for security/debugging)
  client_ip TEXT,
  user_agent TEXT,

  -- Audit timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary query pattern: Get logs for a specific API key
CREATE INDEX IF NOT EXISTS idx_api_key_usage_logs_api_key_id
  ON public.api_key_usage_logs(api_key_id);

-- Query by user (for user-level analytics)
CREATE INDEX IF NOT EXISTS idx_api_key_usage_logs_user_id
  ON public.api_key_usage_logs(user_id);

-- Time-based queries (most common for analytics)
CREATE INDEX IF NOT EXISTS idx_api_key_usage_logs_request_ts
  ON public.api_key_usage_logs(request_ts DESC);

-- Filter by endpoint
CREATE INDEX IF NOT EXISTS idx_api_key_usage_logs_endpoint
  ON public.api_key_usage_logs(endpoint);

-- Filter by status (find errors)
CREATE INDEX IF NOT EXISTS idx_api_key_usage_logs_status
  ON public.api_key_usage_logs(status);

-- Composite index for key + time range queries
CREATE INDEX IF NOT EXISTS idx_api_key_usage_logs_key_time
  ON public.api_key_usage_logs(api_key_id, request_ts DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.api_key_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can view usage logs for their own API keys
CREATE POLICY "Users can view their own API key usage logs"
  ON public.api_key_usage_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role can insert (server-side logging)
-- Note: Service role bypasses RLS, so no explicit INSERT policy needed for server

-- Users cannot directly insert/update/delete (server-side only)
-- No INSERT/UPDATE/DELETE policies for authenticated users

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.api_key_usage_logs IS 'Detailed per-request usage tracking for API key authenticated endpoints';
COMMENT ON COLUMN public.api_key_usage_logs.api_key_id IS 'Reference to the API key used for this request';
COMMENT ON COLUMN public.api_key_usage_logs.endpoint IS 'API endpoint called (e.g., /api/v1/predict)';
COMMENT ON COLUMN public.api_key_usage_logs.scope_used IS 'API key scope used for this request (production, training, testing, all)';
COMMENT ON COLUMN public.api_key_usage_logs.latency_ms IS 'Request duration in milliseconds';
COMMENT ON COLUMN public.api_key_usage_logs.input_tokens IS 'Input tokens consumed (LLM endpoints only)';
COMMENT ON COLUMN public.api_key_usage_logs.output_tokens IS 'Output tokens generated (LLM endpoints only)';
COMMENT ON COLUMN public.api_key_usage_logs.status IS 'Request status: pending, success, error';
COMMENT ON COLUMN public.api_key_usage_logs.request_metadata IS 'Additional request context as JSON';
