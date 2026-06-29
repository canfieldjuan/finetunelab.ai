-- ============================================================================
-- Migration: Create mcp_servers Table
-- Created: June 28, 2026
-- Purpose: Per-user configuration of remote (HTTP) MCP servers for the chat portal.
--
-- SECURITY (load-bearing): this table stores ONLY `http` transport rows. A `stdio`
-- MCP server is an arbitrary host command (= RCE), so there must be NO DB-writable
-- path to a command. The CHECK constraint below makes a stdio row impossible to
-- store; stdio servers come exclusively from trusted host config (env), never the
-- DB/UI. See PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md and lib/tools/mcp/host-config.ts.
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Name doubles as the tool namespace (`mcp__<name>__<tool>`), which is sanitized
  -- to [a-zA-Z0-9_-]. Restrict the stored name to that same set so DB uniqueness
  -- matches namespace uniqueness (no "my server" vs "my_server" collisions).
  name TEXT NOT NULL CHECK (name ~ '^[A-Za-z0-9_-]{1,100}$'),

  -- HTTP only, enforced at the database. Do NOT relax without revisiting the
  -- stdio-RCE threat model — stdio must stay host-config-only.
  transport TEXT NOT NULL DEFAULT 'http' CHECK (transport = 'http'),

  -- Remote endpoint (http/https). NOTE: the DB only checks the scheme; the
  -- authoritative internal/private-target (SSRF) check is at connect time
  -- (resolve-time) in the application — owners can INSERT directly via RLS.
  url TEXT NOT NULL CHECK (url ~* '^https?://'),

  -- Optional auth token, encrypted at rest by the app (lib/models/encryption).
  auth_token_encrypted TEXT,

  enabled BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One server name per user.
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_id ON mcp_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_enabled ON mcp_servers(user_id, enabled);

-- Row Level Security: owner-only access (no admin tier in this app).
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY mcp_servers_select_own
  ON mcp_servers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY mcp_servers_insert_own
  ON mcp_servers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY mcp_servers_update_own
  ON mcp_servers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY mcp_servers_delete_own
  ON mcp_servers FOR DELETE
  USING (auth.uid() = user_id);

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION update_mcp_servers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mcp_servers_updated_at ON mcp_servers;
CREATE TRIGGER trg_mcp_servers_updated_at
  BEFORE UPDATE ON mcp_servers
  FOR EACH ROW
  EXECUTE FUNCTION update_mcp_servers_updated_at();
