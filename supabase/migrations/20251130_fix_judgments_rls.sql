-- Fix RLS policies for judgments table
-- Date: 2025-11-30
-- Issue: Validators cannot insert judgment results due to missing RLS policies

-- Enable RLS on judgments if not already enabled
ALTER TABLE judgments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own judgments" ON judgments;
DROP POLICY IF EXISTS "Users can insert judgments for their messages" ON judgments;
DROP POLICY IF EXISTS "System can insert judgments" ON judgments;

-- Allow users to SELECT judgments for their own messages
-- Uses a join to messages table to check ownership
CREATE POLICY "Users can view their own judgments"
  ON judgments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = judgments.message_id
      AND messages.user_id = auth.uid()
    )
  );

-- Allow users to INSERT judgments for their own messages
-- This is used by the validator system during batch testing
CREATE POLICY "Users can insert judgments for their messages"
  ON judgments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = judgments.message_id
      AND messages.user_id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON TABLE judgments IS 'Stores automated validator judgment results from batch testing. Access controlled via message ownership through RLS policies.';
