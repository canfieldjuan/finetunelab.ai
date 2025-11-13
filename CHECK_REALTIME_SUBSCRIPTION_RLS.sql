-- Check RLS policies on realtime.subscription table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'realtime' AND tablename = 'subscription';

-- Check if RLS is even enabled on realtime.subscription
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'realtime' AND tablename = 'subscription';
