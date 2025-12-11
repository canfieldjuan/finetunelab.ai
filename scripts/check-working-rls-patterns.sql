-- Check which RLS policy patterns are actually working in the database
-- Run this in Supabase SQL Editor to see the exact syntax being used

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,  -- This shows the USING expression
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('user_subscriptions', 'conversations', 'messages', 'user_profiles', 'user_activity', 'context_injection_logs')
ORDER BY tablename, policyname;
