-- ============================================
-- TOOLS TABLE RLS POLICY
-- Date: 2025-10-15
-- Issue: Tools table has RLS enabled but no SELECT policy
--        causing "Tool not found in database" errors
-- ============================================

-- Add SELECT policy for tools table
-- Allow all users (authenticated and anonymous) to read tools
-- Drop existing policy if it exists, then create
DROP POLICY IF EXISTS tools_select_policy ON tools;

CREATE POLICY tools_select_policy
  ON tools FOR SELECT
  USING (true);

-- Verify policy created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'tools';

-- Test access with query
SELECT name, is_enabled
FROM tools
WHERE name = 'datetime';
