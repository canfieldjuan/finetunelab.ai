-- Migration: Create workspace activity tracking
-- Created: 2025-11-28
-- Purpose: Track workspace member activities for the activity feed

-- Create workspace_activity table
CREATE TABLE IF NOT EXISTS public.workspace_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL, -- User who performed the action
  activity_type TEXT NOT NULL, -- Type of activity (shared_training, commented_on_benchmark, etc.)
  resource_type TEXT, -- Type of resource (training, benchmark, dataset, config, conversation, etc.)
  resource_id UUID, -- ID of the resource
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional activity data
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_activity_workspace_id
  ON public.workspace_activity(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_created_at
  ON public.workspace_activity(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_actor_id
  ON public.workspace_activity(actor_id);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_resource
  ON public.workspace_activity(resource_type, resource_id);

-- Enable Row Level Security
ALTER TABLE public.workspace_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view activity for workspaces they are members of
CREATE POLICY "Users can view workspace activity for their workspaces"
  ON public.workspace_activity
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = workspace_activity.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert activity for workspaces they are members of
CREATE POLICY "Users can create activity for their workspaces"
  ON public.workspace_activity
  FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = workspace_activity.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete their own activity
CREATE POLICY "Users can delete their own activity"
  ON public.workspace_activity
  FOR DELETE
  USING (actor_id = auth.uid());

-- Create function to get workspace activity feed with user details
CREATE OR REPLACE FUNCTION public.get_workspace_activity_feed(
  p_workspace_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  activity_type TEXT,
  actor_email TEXT,
  actor_name TEXT,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    wa.id,
    wa.activity_type,
    COALESCE(u.email, 'Unknown User') as actor_email,
    COALESCE(
      CONCAT(up.first_name, ' ', up.last_name),
      SPLIT_PART(u.email, '@', 1),
      'Unknown User'
    ) as actor_name,
    wa.resource_type,
    wa.resource_id,
    wa.metadata,
    wa.created_at
  FROM public.workspace_activity wa
  LEFT JOIN auth.users u ON wa.actor_id = u.id
  LEFT JOIN public.user_profiles up ON wa.actor_id = up.user_id
  WHERE wa.workspace_id = p_workspace_id
    -- Verify the requesting user is a member of the workspace (RLS)
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = p_workspace_id
        AND wm.user_id = auth.uid()
    )
  ORDER BY wa.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_workspace_activity_feed(UUID, INT, INT) TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE public.workspace_activity IS 'Tracks user activities within workspaces for the activity feed';
COMMENT ON FUNCTION public.get_workspace_activity_feed IS 'Retrieves workspace activity feed with user details joined from auth.users and user_profiles';
