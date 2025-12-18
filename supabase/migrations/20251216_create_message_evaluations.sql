-- Migration: Create Message Evaluations Table
-- Created: 2025-12-16
-- Purpose: Store user ratings and evaluations of LLM message quality

-- Create message_evaluations table
CREATE TABLE IF NOT EXISTS public.message_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,

  -- Evaluation metrics
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  success BOOLEAN DEFAULT NULL,
  notes TEXT,

  -- Metadata
  evaluation_type TEXT DEFAULT 'manual', -- 'manual', 'automated', 'thumbs_up', 'thumbs_down'
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure one evaluation per message per user (can update existing)
  UNIQUE(message_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_evaluations_user_id
  ON public.message_evaluations(user_id);

CREATE INDEX IF NOT EXISTS idx_message_evaluations_message_id
  ON public.message_evaluations(message_id);

CREATE INDEX IF NOT EXISTS idx_message_evaluations_created_at
  ON public.message_evaluations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_evaluations_rating
  ON public.message_evaluations(rating);

CREATE INDEX IF NOT EXISTS idx_message_evaluations_success
  ON public.message_evaluations(success);

-- Enable Row Level Security
ALTER TABLE public.message_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own evaluations
CREATE POLICY "Users can view their own evaluations"
  ON public.message_evaluations
  FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policy: Users can insert their own evaluations
CREATE POLICY "Users can insert their own evaluations"
  ON public.message_evaluations
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can update their own evaluations
CREATE POLICY "Users can update their own evaluations"
  ON public.message_evaluations
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can delete their own evaluations
CREATE POLICY "Users can delete their own evaluations"
  ON public.message_evaluations
  FOR DELETE
  USING (user_id = auth.uid());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_message_evaluations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER message_evaluations_updated_at_trigger
  BEFORE UPDATE ON public.message_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_message_evaluations_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.message_evaluations IS 'Stores user ratings and evaluations of LLM message quality for analytics and quality tracking';
COMMENT ON COLUMN public.message_evaluations.rating IS 'User rating from 1-5 stars';
COMMENT ON COLUMN public.message_evaluations.success IS 'Whether the message successfully accomplished its task (true/false/null)';
COMMENT ON COLUMN public.message_evaluations.notes IS 'Optional text feedback from the user';
COMMENT ON COLUMN public.message_evaluations.evaluation_type IS 'Type of evaluation: manual (user input), automated (system), thumbs_up/down (quick feedback)';
COMMENT ON COLUMN public.message_evaluations.metadata IS 'Additional evaluation metadata (custom fields, context, etc.)';
