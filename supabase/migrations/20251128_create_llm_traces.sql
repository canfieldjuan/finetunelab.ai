-- Migration: Create LLM Traces Table
-- Created: 2025-11-28
-- Purpose: Store execution traces for debugging and performance analysis

-- Create llm_traces table
CREATE TABLE IF NOT EXISTS public.llm_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Trace identification
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  trace_id TEXT NOT NULL,
  parent_trace_id TEXT,
  span_id TEXT NOT NULL,
  span_name TEXT NOT NULL,

  -- Timing information
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_ms NUMERIC,

  -- Operation details
  operation_type TEXT NOT NULL,
  model_name TEXT,
  model_provider TEXT,
  model_version TEXT,

  -- Input/Output data
  input_data JSONB,
  output_data JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Token usage
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,

  -- Cost tracking
  cost_usd NUMERIC(10, 6),

  -- Status and errors
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  error_type TEXT,

  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_llm_traces_user_id
  ON public.llm_traces(user_id);

CREATE INDEX IF NOT EXISTS idx_llm_traces_trace_id
  ON public.llm_traces(trace_id);

CREATE INDEX IF NOT EXISTS idx_llm_traces_conversation_id
  ON public.llm_traces(conversation_id);

CREATE INDEX IF NOT EXISTS idx_llm_traces_message_id
  ON public.llm_traces(message_id);

CREATE INDEX IF NOT EXISTS idx_llm_traces_parent_trace_id
  ON public.llm_traces(parent_trace_id);

CREATE INDEX IF NOT EXISTS idx_llm_traces_created_at
  ON public.llm_traces(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_traces_operation_type
  ON public.llm_traces(operation_type);

CREATE INDEX IF NOT EXISTS idx_llm_traces_status
  ON public.llm_traces(status);

-- Composite index for trace hierarchy queries
CREATE INDEX IF NOT EXISTS idx_llm_traces_hierarchy
  ON public.llm_traces(trace_id, parent_trace_id);

-- Enable Row Level Security
ALTER TABLE public.llm_traces ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own traces
CREATE POLICY "Users can view their own traces"
  ON public.llm_traces
  FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policy: Users can insert their own traces
CREATE POLICY "Users can insert their own traces"
  ON public.llm_traces
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can update their own traces
CREATE POLICY "Users can update their own traces"
  ON public.llm_traces
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can delete their own traces
CREATE POLICY "Users can delete their own traces"
  ON public.llm_traces
  FOR DELETE
  USING (user_id = auth.uid());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_llm_traces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER llm_traces_updated_at_trigger
  BEFORE UPDATE ON public.llm_traces
  FOR EACH ROW
  EXECUTE FUNCTION update_llm_traces_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.llm_traces IS 'Stores execution traces for LLM operations including timing, tokens, and costs for debugging and analytics';
COMMENT ON COLUMN public.llm_traces.trace_id IS 'Unique identifier for the entire trace (multiple spans can share a trace_id)';
COMMENT ON COLUMN public.llm_traces.parent_trace_id IS 'Parent trace_id for hierarchical trace relationships';
COMMENT ON COLUMN public.llm_traces.span_id IS 'Unique identifier for this specific span within the trace';
COMMENT ON COLUMN public.llm_traces.span_name IS 'Human-readable name for the span (e.g., "llm.completion", "tool.call")';
COMMENT ON COLUMN public.llm_traces.operation_type IS 'Type of operation (e.g., "completion", "embedding", "tool_call")';
COMMENT ON COLUMN public.llm_traces.input_data IS 'Input data for the operation (prompts, parameters, etc.)';
COMMENT ON COLUMN public.llm_traces.output_data IS 'Output data from the operation (responses, results, etc.)';
COMMENT ON COLUMN public.llm_traces.metadata IS 'Additional metadata for the trace (tool context, custom fields, etc.)';
COMMENT ON COLUMN public.llm_traces.status IS 'Status of the operation (pending, success, error)';
