-- =============================================================================
-- REALTIME BROADCAST AUTHORIZATION - THE MISSING PIECE!
-- =============================================================================
-- This is what's blocking Realtime from working!
-- Run this in Supabase Dashboard > SQL Editor
-- =============================================================================

-- Enable RLS on the realtime.messages table
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to receive broadcasts
CREATE POLICY "Authenticated users can receive broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow service role to receive broadcasts
CREATE POLICY "Service role can receive broadcasts"
ON realtime.messages
FOR SELECT
TO service_role
USING (true);

-- Create policy to allow anon users to receive broadcasts (optional, for testing)
CREATE POLICY "Anonymous users can receive broadcasts"
ON realtime.messages
FOR SELECT
TO anon
USING (true);

-- Verification
SELECT 
  schemaname,
  tablename,
  policyname,
  roles::text
FROM pg_policies
WHERE tablename = 'messages' AND schemaname = 'realtime';

-- =============================================================================
-- EXPLANATION
-- =============================================================================
-- Realtime uses an internal table called "realtime.messages" to manage
-- broadcast messages. Even though your data tables have correct RLS policies,
-- Realtime itself needs authorization to send/receive messages.
--
-- Without this policy, Realtime connections timeout because the client
-- cannot receive any broadcast messages from the realtime infrastructure.
-- =============================================================================
