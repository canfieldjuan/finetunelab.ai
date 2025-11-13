-- =============================================================================
-- COMPLETE REALTIME AUTHORIZATION - ALL OPERATIONS
-- =============================================================================
-- The previous fix only added SELECT policies, but Realtime needs more
-- Run this in Supabase Dashboard > SQL Editor
-- =============================================================================

-- Drop existing policies to recreate them with full permissions
DROP POLICY IF EXISTS "Anonymous users can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Service role can receive broadcasts" ON realtime.messages;

-- Create comprehensive policies for ALL operations (SELECT, INSERT, UPDATE, DELETE)

-- Authenticated users - full access
CREATE POLICY "Authenticated users full access to broadcasts"
ON realtime.messages
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Service role - full access
CREATE POLICY "Service role full access to broadcasts"
ON realtime.messages
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Anon users - full access (for websocket connections)
CREATE POLICY "Anonymous users full access to broadcasts"
ON realtime.messages
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Verification
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  roles::text
FROM pg_policies
WHERE tablename = 'messages' AND schemaname = 'realtime'
ORDER BY policyname;

-- =============================================================================
-- EXPLANATION
-- =============================================================================
-- Realtime needs to INSERT messages into realtime.messages when broadcasting
-- changes. The previous policies only allowed SELECT, which is why we could
-- fetch existing data but couldn't subscribe to new changes.
--
-- These policies grant full access (SELECT, INSERT, UPDATE, DELETE) to allow
-- the Realtime infrastructure to properly manage message broadcasting.
-- =============================================================================
