-- Canonical tool execution telemetry table.
-- Existing code already writes built-in portal tools here; this migration makes
-- the contract versioned and allows scoped MCP tools, which intentionally have no
-- global tools.id row.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  tool_id UUID REFERENCES public.tools(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  input_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_result JSONB,
  error_message TEXT,
  execution_time_ms INTEGER NOT NULL DEFAULT 0 CHECK (execution_time_ms >= 0),
  tool_source TEXT NOT NULL DEFAULT 'portal',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tool_executions
  ADD COLUMN IF NOT EXISTS tool_source TEXT DEFAULT 'portal',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.tool_executions
  ALTER COLUMN tool_id DROP NOT NULL,
  ALTER COLUMN tool_source SET DEFAULT 'portal',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

UPDATE public.tool_executions
   SET tool_source = 'portal'
 WHERE tool_source IS NULL;

UPDATE public.tool_executions
   SET metadata = '{}'::jsonb
 WHERE metadata IS NULL;

ALTER TABLE public.tool_executions
  ALTER COLUMN tool_source SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'tool_executions_source_check'
       AND conrelid = 'public.tool_executions'::regclass
  ) THEN
    ALTER TABLE public.tool_executions
      ADD CONSTRAINT tool_executions_source_check
      CHECK (tool_source IN ('portal', 'mcp'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tool_executions_conversation_id
  ON public.tool_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_message_id
  ON public.tool_executions(message_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_id
  ON public.tool_executions(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_name
  ON public.tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_source
  ON public.tool_executions(tool_source);
CREATE INDEX IF NOT EXISTS idx_tool_executions_created_at
  ON public.tool_executions(created_at DESC);

ALTER TABLE public.tool_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tool_executions_select_own ON public.tool_executions;
CREATE POLICY tool_executions_select_own
  ON public.tool_executions
  FOR SELECT
  USING (
    conversation_id IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.conversations c
       WHERE c.id = tool_executions.conversation_id
         AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS tool_executions_insert_own ON public.tool_executions;
CREATE POLICY tool_executions_insert_own
  ON public.tool_executions
  FOR INSERT
  WITH CHECK (
    conversation_id IS NULL
    OR EXISTS (
      SELECT 1
        FROM public.conversations c
       WHERE c.id = tool_executions.conversation_id
         AND c.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.tool_executions IS
  'Records chat portal tool executions, including scoped MCP tools without global tools rows';
COMMENT ON COLUMN public.tool_executions.tool_id IS
  'Nullable for scoped tool sources such as MCP that are not stored in public.tools';
COMMENT ON COLUMN public.tool_executions.tool_source IS
  'Tool origin: portal for registry-backed tools, mcp for per-user MCP tools';
COMMENT ON COLUMN public.tool_executions.metadata IS
  'Non-sensitive execution metadata such as scoped tool source details';
