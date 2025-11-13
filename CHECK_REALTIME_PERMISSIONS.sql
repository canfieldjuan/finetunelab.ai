-- Try to manually trigger what the Realtime server should be doing
-- This will help us understand if it's a permission issue or config issue

-- First, check what the Realtime user/role is
SELECT current_user, session_user;

-- Check if there's a realtime role
SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin
FROM pg_roles
WHERE rolname LIKE '%realtime%' OR rolname = 'supabase_realtime_admin';

-- Check grants on realtime.subscription
SELECT 
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'realtime' AND table_name = 'subscription';
