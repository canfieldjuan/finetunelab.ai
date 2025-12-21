-- Migration: Add trace_id to Quality Tables
-- Created: 2025-12-20
-- Purpose: Link quality evaluations (judgments, ratings, feedback) to execution traces
-- Phase 1: Category 2 Quality Integration

-- Add trace_id column to judgments table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'judgments'
    AND column_name = 'trace_id'
  ) THEN
    ALTER TABLE public.judgments ADD COLUMN trace_id TEXT;
  END IF;
END $$;

-- Add trace_id column to message_evaluations table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'message_evaluations'
    AND column_name = 'trace_id'
  ) THEN
    ALTER TABLE public.message_evaluations ADD COLUMN trace_id TEXT;
  END IF;
END $$;

-- Add trace_id column to widget_feedback table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'widget_feedback'
    AND column_name = 'trace_id'
  ) THEN
    ALTER TABLE public.widget_feedback ADD COLUMN trace_id TEXT;
  END IF;
END $$;

-- Create indexes for fast trace_id lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_judgments_trace_id
  ON public.judgments(trace_id);

CREATE INDEX IF NOT EXISTS idx_message_evaluations_trace_id
  ON public.message_evaluations(trace_id);

CREATE INDEX IF NOT EXISTS idx_widget_feedback_trace_id
  ON public.widget_feedback(trace_id);

-- Backfill trace_id for existing judgments (join through message_id)
-- Only update records where trace_id is NULL and message_id exists
UPDATE public.judgments j
SET trace_id = (
  SELECT lt.trace_id
  FROM public.llm_traces lt
  WHERE lt.message_id::text = j.message_id::text
  ORDER BY lt.created_at DESC
  LIMIT 1
)
WHERE j.trace_id IS NULL
  AND j.message_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.llm_traces lt
    WHERE lt.message_id::text = j.message_id::text
  );

-- Backfill trace_id for existing message_evaluations
UPDATE public.message_evaluations me
SET trace_id = (
  SELECT lt.trace_id
  FROM public.llm_traces lt
  WHERE lt.message_id::text = me.message_id::text
  ORDER BY lt.created_at DESC
  LIMIT 1
)
WHERE me.trace_id IS NULL
  AND me.message_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.llm_traces lt
    WHERE lt.message_id::text = me.message_id::text
  );

-- Backfill trace_id for existing widget_feedback
UPDATE public.widget_feedback wf
SET trace_id = (
  SELECT lt.trace_id
  FROM public.llm_traces lt
  WHERE lt.message_id::text = wf.message_id::text
  ORDER BY lt.created_at DESC
  LIMIT 1
)
WHERE wf.trace_id IS NULL
  AND wf.message_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.llm_traces lt
    WHERE lt.message_id::text = wf.message_id::text
  );

-- Add column comments for documentation
COMMENT ON COLUMN public.judgments.trace_id IS 'Links to llm_traces.trace_id for execution trace correlation';
COMMENT ON COLUMN public.message_evaluations.trace_id IS 'Links to llm_traces.trace_id for execution trace correlation';
COMMENT ON COLUMN public.widget_feedback.trace_id IS 'Links to llm_traces.trace_id for execution trace correlation';
