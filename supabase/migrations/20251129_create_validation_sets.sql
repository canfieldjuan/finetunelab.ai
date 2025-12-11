-- Create validation_sets table
-- Date: 2025-11-29
-- Purpose: Store validation sets for comparing model responses to expected answers

CREATE TABLE IF NOT EXISTS validation_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  test_cases JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster user queries
CREATE INDEX IF NOT EXISTS idx_validation_sets_user_id ON validation_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_validation_sets_created_at ON validation_sets(created_at DESC);

-- Enable RLS
ALTER TABLE validation_sets ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own validation sets

-- Users can insert their own validation sets
CREATE POLICY "Users can insert their own validation sets"
ON validation_sets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own validation sets
CREATE POLICY "Users can view their own validation sets"
ON validation_sets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own validation sets
CREATE POLICY "Users can update their own validation sets"
ON validation_sets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own validation sets
CREATE POLICY "Users can delete their own validation sets"
ON validation_sets
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE validation_sets IS 'Stores validation sets with expected prompt-response pairs for model evaluation';
COMMENT ON COLUMN validation_sets.id IS 'Unique identifier for the validation set';
COMMENT ON COLUMN validation_sets.user_id IS 'User who created the validation set';
COMMENT ON COLUMN validation_sets.name IS 'Name of the validation set';
COMMENT ON COLUMN validation_sets.description IS 'Optional description of what the validation set tests';
COMMENT ON COLUMN validation_sets.test_cases IS 'Array of test cases with prompts, expected responses, keywords, etc.';
COMMENT ON COLUMN validation_sets.created_at IS 'When the validation set was created';
COMMENT ON COLUMN validation_sets.updated_at IS 'When the validation set was last updated';
