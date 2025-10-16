-- Migration: Create message evaluations table
-- Date: 2025-10-13
-- Phase: B.1 - Enhanced Metrics Capture
-- Description: Stores human evaluations for ML training

-- Create evaluations table
CREATE TABLE IF NOT EXISTS message_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  success BOOLEAN,
  failure_tags TEXT[],
  notes TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_evaluations_message_id
ON message_evaluations(message_id);

CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator_id
ON message_evaluations(evaluator_id);

CREATE INDEX IF NOT EXISTS idx_evaluations_success
ON message_evaluations(success) WHERE success IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evaluations_rating
ON message_evaluations(rating) WHERE rating IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE message_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own evaluations
CREATE POLICY "Users can view their own evaluations"
ON message_evaluations FOR SELECT
USING (auth.uid() = evaluator_id);

-- RLS Policy: Users can insert their own evaluations
CREATE POLICY "Users can insert their own evaluations"
ON message_evaluations FOR INSERT
WITH CHECK (auth.uid() = evaluator_id);

-- RLS Policy: Users can update their own evaluations
CREATE POLICY "Users can update their own evaluations"
ON message_evaluations FOR UPDATE
USING (auth.uid() = evaluator_id);

-- Add comments for documentation
COMMENT ON TABLE message_evaluations IS 'Human evaluations of LLM responses for training';
COMMENT ON COLUMN message_evaluations.failure_tags IS 'Array of failure types: hallucination, wrong_tool, incorrect_info, etc.';
COMMENT ON COLUMN message_evaluations.rating IS 'Rating from 1 (worst) to 5 (best)';
COMMENT ON COLUMN message_evaluations.success IS 'Boolean flag: did the response meet expectations?';

-- Verification queries (run after migration)
-- SELECT * FROM information_schema.tables WHERE table_name = 'message_evaluations';
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'message_evaluations';
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'message_evaluations';
