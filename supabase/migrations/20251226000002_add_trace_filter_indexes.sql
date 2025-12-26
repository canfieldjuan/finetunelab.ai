-- Migration: Add Indexes for Advanced Trace Filtering
-- Date: 2025-12-26
-- Purpose: Optimize cost and duration filtering performance in trace explorer
-- Related: Advanced Trace Filtering feature (Phase 5)

-- Add index for cost_usd filtering
-- Used by: Trace Explorer advanced filters (min/max cost)
-- Performance: Enables fast range queries on cost_usd field
CREATE INDEX IF NOT EXISTS idx_llm_traces_cost_usd
  ON public.llm_traces(cost_usd)
  WHERE cost_usd IS NOT NULL;

-- Add index for duration_ms filtering
-- Used by: Trace Explorer advanced filters (min/max duration)
-- Performance: Enables fast range queries on duration_ms field
CREATE INDEX IF NOT EXISTS idx_llm_traces_duration_ms
  ON public.llm_traces(duration_ms)
  WHERE duration_ms IS NOT NULL;

-- Add composite index for common filter combinations
-- Optimizes queries that filter by user + status + operation_type + time
-- Used by: Trace list queries with multiple filters applied
CREATE INDEX IF NOT EXISTS idx_llm_traces_common_filters
  ON public.llm_traces(user_id, status, operation_type, start_time DESC)
  WHERE parent_trace_id IS NULL;

-- Add index for error filtering
-- Used by: "has_error" filter in trace explorer
-- Performance: Fast queries for traces with/without errors
CREATE INDEX IF NOT EXISTS idx_llm_traces_has_error
  ON public.llm_traces(user_id, (error_message IS NOT NULL))
  WHERE parent_trace_id IS NULL;

-- Add documentation comments
COMMENT ON INDEX idx_llm_traces_cost_usd IS 'Optimize cost range filtering in trace explorer (min_cost, max_cost)';
COMMENT ON INDEX idx_llm_traces_duration_ms IS 'Optimize duration range filtering in trace explorer (min_duration, max_duration)';
COMMENT ON INDEX idx_llm_traces_common_filters IS 'Composite index for common trace list queries with multiple filters';
COMMENT ON INDEX idx_llm_traces_has_error IS 'Optimize has_error boolean filter in trace explorer';
