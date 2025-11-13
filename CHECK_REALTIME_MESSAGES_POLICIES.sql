-- Create policies to allow Realtime subscriptions and broadcasts
-- Based on Supabase AI recommendation about channel policies

-- First, check current policies on realtime.messages
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'realtime' AND tablename = 'messages';

-- If there are restrictive policies, we need to add permissive ones
-- The Realtime server needs to be able to INSERT messages when broadcasting
-- And clients need to be able to SELECT messages they're subscribed to
