-- Analytics Tool Execution Logs Table
-- Tracks performance and errors for analytics assistant tool calls
-- Date: 2026-01-02
-- Phase 4: Enhanced Logging

CREATE TABLE IF NOT EXISTS public.analytics_tool_logs (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User context
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tool information
  tool_name TEXT NOT NULL,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'error')),

  -- Error tracking
  error_type TEXT,
  error_message TEXT,

  -- Request/response data (sanitized)
  args JSONB,
  result_summary JSONB,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_analytics_tool_logs_user_id ON public.analytics_tool_logs(user_id);
CREATE INDEX idx_analytics_tool_logs_tool_name ON public.analytics_tool_logs(tool_name);
CREATE INDEX idx_analytics_tool_logs_started_at ON public.analytics_tool_logs(started_at DESC);
CREATE INDEX idx_analytics_tool_logs_status ON public.analytics_tool_logs(status);
CREATE INDEX idx_analytics_tool_logs_user_tool ON public.analytics_tool_logs(user_id, tool_name);

-- Enable Row Level Security
ALTER TABLE public.analytics_tool_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own logs
CREATE POLICY "Users can view own tool logs"
  ON public.analytics_tool_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert logs (used by tool logger)
CREATE POLICY "Service role can insert tool logs"
  ON public.analytics_tool_logs
  FOR INSERT
  WITH CHECK (true);

-- Service role can update logs (for completing pending logs)
CREATE POLICY "Service role can update tool logs"
  ON public.analytics_tool_logs
  FOR UPDATE
  USING (true);

-- Add comment for documentation
COMMENT ON TABLE public.analytics_tool_logs IS 'Tracks analytics assistant tool execution performance and errors for monitoring and debugging';
COMMENT ON COLUMN public.analytics_tool_logs.tool_name IS 'Name of the tool executed (e.g., get_session_evaluations, web_search)';
COMMENT ON COLUMN public.analytics_tool_logs.args IS 'Sanitized tool arguments (sensitive data removed, truncated to 5KB)';
COMMENT ON COLUMN public.analytics_tool_logs.result_summary IS 'High-level result summary (not full response, truncated to 2KB)';
