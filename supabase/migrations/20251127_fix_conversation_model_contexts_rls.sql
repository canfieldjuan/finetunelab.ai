-- Fix RLS policies for conversation_model_contexts table
-- Date: 2025-11-27
-- Purpose: Allow authenticated users to manage their own conversation context data

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own conversation contexts" ON conversation_model_contexts;
DROP POLICY IF EXISTS "Users can insert their own conversation contexts" ON conversation_model_contexts;
DROP POLICY IF EXISTS "Users can update their own conversation contexts" ON conversation_model_contexts;
DROP POLICY IF EXISTS "Users can delete their own conversation contexts" ON conversation_model_contexts;

-- Ensure RLS is enabled
ALTER TABLE conversation_model_contexts ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view contexts for conversations they own
CREATE POLICY "Users can view their own conversation contexts"
ON conversation_model_contexts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = conversation_model_contexts.conversation_id
    AND conversations.user_id = auth.uid()
  )
);

-- INSERT: Users can create contexts for their own conversations
CREATE POLICY "Users can insert their own conversation contexts"
ON conversation_model_contexts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = conversation_model_contexts.conversation_id
    AND conversations.user_id = auth.uid()
  )
);

-- UPDATE: Users can update contexts for their own conversations
CREATE POLICY "Users can update their own conversation contexts"
ON conversation_model_contexts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = conversation_model_contexts.conversation_id
    AND conversations.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = conversation_model_contexts.conversation_id
    AND conversations.user_id = auth.uid()
  )
);

-- DELETE: Users can delete contexts for their own conversations
CREATE POLICY "Users can delete their own conversation contexts"
ON conversation_model_contexts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = conversation_model_contexts.conversation_id
    AND conversations.user_id = auth.uid()
  )
);
