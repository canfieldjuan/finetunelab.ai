-- Migration: Remove restrictive operation_type constraint
-- Created: 2025-12-17
-- Purpose: Allow flexible operation_type values for external SDK users
-- The constraint was too restrictive for SDK usage where different
-- operation types may be needed for various use cases

-- Drop the existing CHECK constraint if it exists
ALTER TABLE public.llm_traces
DROP CONSTRAINT IF EXISTS llm_traces_operation_type_check;

-- Add comment explaining why we removed the constraint
COMMENT ON COLUMN public.llm_traces.operation_type IS 'Type of operation - flexible text field to support various operation types (e.g., "completion", "embedding", "tool_call", "llm", etc.)';
