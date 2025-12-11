-- Fix RLS policies for judgments table
-- Date: 2025-11-27
-- Issue: Users cannot save human judgments due to missing RLS policies

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can insert judgments for their own messages" ON judgments;
DROP POLICY IF EXISTS "Users can view judgments for their own messages" ON judgments;
DROP POLICY IF EXISTS "Users can update judgments for their own messages" ON judgments;
DROP POLICY IF EXISTS "Users can delete judgments for their own messages" ON judgments;

-- Enable RLS on judgments table
ALTER TABLE judgments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert judgments for their own messages
CREATE POLICY "Users can insert judgments for their own messages"
ON judgments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = judgments.message_id
    AND messages.user_id = auth.uid()
  )
);

-- Policy: Users can view judgments for their own messages
CREATE POLICY "Users can view judgments for their own messages"
ON judgments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = judgments.message_id
    AND messages.user_id = auth.uid()
  )
);

-- Policy: Users can update judgments for their own messages
CREATE POLICY "Users can update judgments for their own messages"
ON judgments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = judgments.message_id
    AND messages.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = judgments.message_id
    AND messages.user_id = auth.uid()
  )
);

-- Policy: Users can delete judgments for their own messages
CREATE POLICY "Users can delete judgments for their own messages"
ON judgments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = judgments.message_id
    AND messages.user_id = auth.uid()
  )
);
