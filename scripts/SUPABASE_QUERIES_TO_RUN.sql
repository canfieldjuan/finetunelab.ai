-- ============================================================================
-- RUN THESE QUERIES IN SUPABASE SQL EDITOR
-- Copy the results and paste them back to me
-- ============================================================================

-- QUERY 1: What type does auth.uid() return?
-- ============================================================================
SELECT pg_typeof(auth.uid()) as auth_uid_type;


-- QUERY 2: What type is auth.users.id?
-- ============================================================================
SELECT
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_schema = 'auth'
AND table_name = 'users'
AND column_name = 'id';


-- QUERY 3: Show me ALL existing working RLS policies
-- ============================================================================
SELECT
    tablename,
    policyname,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- QUERY 4: Show me the exact RLS policy for user_subscriptions
-- ============================================================================
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
WHERE tablename = 'user_subscriptions';


-- QUERY 5: What's the type of user_id in user_subscriptions?
-- ============================================================================
SELECT
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_subscriptions'
AND column_name = 'user_id';


-- QUERY 6: Test if this RLS pattern works (will tell us the right syntax)
-- ============================================================================
-- This will either work or give us the error we need to fix
CREATE TABLE IF NOT EXISTS test_rls_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_data TEXT
);

ALTER TABLE test_rls_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "test_policy"
  ON test_rls_table
  FOR SELECT
  USING (auth.uid() = user_id);

-- If the above works, great! If it errors, copy the error message.
-- Then clean up:
DROP TABLE IF EXISTS test_rls_table CASCADE;
