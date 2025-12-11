-- ============================================================================
-- Fix: Notification RPC Function Type Mismatch
-- Issue: actor_email returns VARCHAR(255) but function declares TEXT
-- Error: "Returned type character varying(255) does not match expected type text"
-- ============================================================================

-- Drop and recreate get_notifications with correct types
DROP FUNCTION IF EXISTS get_notifications(UUID, TEXT, BOOLEAN, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_notifications(
  p_workspace_id UUID DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_unread_only BOOLEAN DEFAULT false,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  message TEXT,
  actor_id UUID,
  actor_email VARCHAR(255),  -- FIXED: Changed from TEXT to VARCHAR(255) to match auth.users.email
  actor_name TEXT,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  read BOOLEAN,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.type,
    n.title,
    n.message,
    n.actor_id,
    u.email as actor_email,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      split_part(u.email, '@', 1)
    ) as actor_name,
    n.resource_type,
    n.resource_id,
    n.metadata,
    n.read,
    n.read_at,
    n.created_at
  FROM workspace_notifications n
  LEFT JOIN auth.users u ON u.id = n.actor_id
  WHERE n.user_id = auth.uid()
    AND (p_workspace_id IS NULL OR n.workspace_id = p_workspace_id)
    AND (p_type IS NULL OR n.type = p_type)
    AND (p_unread_only = false OR n.read = false)
  ORDER BY n.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Verify function exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_notifications'
  ) THEN
    RAISE NOTICE '✓ get_notifications function fixed successfully';
  ELSE
    RAISE EXCEPTION '✗ Failed to create get_notifications function';
  END IF;
END $$;
