// MCP Client - Server config service (Slice 2)
//
// CRUD for per-user *HTTP* MCP servers (DB), plus listEnabledServers() which merges
// the user's enabled DB http servers with the trusted host stdio servers for the
// client manager. There is intentionally NO API to create a stdio server: stdio is
// host-config-only (see host-config.ts) and the DB CHECK rejects it anyway. HTTP
// auth tokens are encrypted at rest. See PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md.

import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt, encrypt } from '@/lib/models/encryption';
import type { McpServerConfig } from './types';
import { loadHostStdioServers } from './host-config';
import { assertSafeHttpUrl } from './url-guard';

const TABLE = 'mcp_servers';

// Server name doubles as the tool namespace (mcp__<name>__<tool>), which is
// sanitized to [A-Za-z0-9_-]. Restrict the stored name to that same set so DB
// uniqueness == namespace uniqueness (mirrors the DB CHECK; prevents "my server"
// vs "my_server" collisions).
const NAME_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
function assertValidName(name: string): void {
  if (!NAME_PATTERN.test(name)) {
    throw new Error(`[MCP] Server name must be 1-100 chars of [A-Za-z0-9_-]: "${name}"`);
  }
}

export interface CreateHttpServerInput {
  name: string;
  url: string;
  authToken?: string;
  enabled?: boolean;
}

export interface UpdateHttpServerInput {
  name?: string;
  url?: string;
  /** Pass a string to replace the token, null to clear it, omit to leave unchanged. */
  authToken?: string | null;
  enabled?: boolean;
}

/** UI/API-safe view of a server — NEVER includes the decrypted auth token. */
export interface McpServerSummary {
  id: string;
  name: string;
  transport: 'http';
  url?: string;
  enabled: boolean;
  hasAuthToken: boolean;
}

interface McpServerRow {
  id: string;
  user_id: string;
  name: string;
  transport: string;
  url: string | null;
  auth_token_encrypted: string | null;
  enabled: boolean;
}

// Internal: includes the decrypted token for the client manager. NEVER return this
// shape from a UI/API surface — use rowToSummary for anything user-facing.
function rowToConfig(row: McpServerRow): McpServerConfig {
  return {
    id: row.id,
    name: row.name,
    transport: 'http',
    url: row.url ?? undefined,
    authToken: row.auth_token_encrypted ? decrypt(row.auth_token_encrypted) : undefined,
    enabled: row.enabled,
  };
}

function rowToSummary(row: McpServerRow): McpServerSummary {
  return {
    id: row.id,
    name: row.name,
    transport: 'http',
    url: row.url ?? undefined,
    enabled: row.enabled,
    hasAuthToken: !!row.auth_token_encrypted,
  };
}

export class McpServerConfigService {
  constructor(private readonly supabase: SupabaseClient) {}

  /** All of a user's configured (http) MCP servers (token-redacted). */
  async listUserServers(userId: string): Promise<McpServerSummary[]> {
    const { data, error } = await this.supabase.from(TABLE).select('*').eq('user_id', userId);
    if (error) throw new Error(error.message);
    return ((data ?? []) as McpServerRow[]).map(rowToSummary);
  }

  /** Create an http MCP server for a user. (No stdio path exists by design.) */
  async createHttpServer(userId: string, input: CreateHttpServerInput): Promise<McpServerSummary> {
    assertValidName(input.name);
    assertSafeHttpUrl(input.url);

    const { data, error } = await this.supabase
      .from(TABLE)
      .insert({
        user_id: userId,
        name: input.name,
        transport: 'http', // hardcoded — never taken from caller input
        url: input.url,
        auth_token_encrypted: input.authToken ? encrypt(input.authToken) : null,
        enabled: input.enabled ?? true,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return rowToSummary(data as McpServerRow);
  }

  /** Update an http MCP server the user owns. */
  async updateHttpServer(
    userId: string,
    id: string,
    input: UpdateHttpServerInput,
  ): Promise<McpServerSummary> {
    if (input.name !== undefined) assertValidName(input.name);
    if (input.url !== undefined) assertSafeHttpUrl(input.url);

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.url !== undefined) patch.url = input.url;
    if (input.enabled !== undefined) patch.enabled = input.enabled;
    if (input.authToken !== undefined) {
      patch.auth_token_encrypted = input.authToken === null ? null : encrypt(input.authToken);
    }

    const { data, error } = await this.supabase
      .from(TABLE)
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return rowToSummary(data as McpServerRow);
  }

  /** Delete an http MCP server the user owns. */
  async deleteServer(userId: string, id: string): Promise<void> {
    const { error } = await this.supabase.from(TABLE).delete().eq('id', id).eq('user_id', userId);
    if (error) throw new Error(error.message);
  }

  /**
   * Servers ready for the client manager: the user's *enabled* http servers from
   * the DB plus the trusted host stdio servers (env). stdio never originates here.
   */
  async listEnabledServers(userId: string): Promise<McpServerConfig[]> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true);
    if (error) throw new Error(error.message);

    const httpServers = ((data ?? []) as McpServerRow[]).map(rowToConfig);
    const stdioServers = loadHostStdioServers().filter((server) => server.enabled);
    return [...httpServers, ...stdioServers];
  }
}
