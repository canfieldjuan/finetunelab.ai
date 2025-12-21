-- Add unique constraint on span_id to prevent duplicate traces
-- This ensures each span_id can only appear once in the database

-- First, remove any existing duplicates (keep the most recent one)
DELETE FROM public.llm_traces a
USING public.llm_traces b
WHERE a.span_id = b.span_id
  AND a.created_at < b.created_at;

-- Add unique constraint on span_id
ALTER TABLE public.llm_traces
  ADD CONSTRAINT llm_traces_span_id_unique UNIQUE (span_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT llm_traces_span_id_unique ON public.llm_traces IS
  'Ensures each span_id is unique to prevent duplicate trace entries';
