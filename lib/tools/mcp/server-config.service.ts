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
const MAX_URL_LENGTH = 2048;
const MAX_IMPORT_SERVERS = 25;
const MAX_AUTH_TOKEN_LENGTH = 8192;

export const MCP_SERVER_MANIFEST_KIND = 'finetunelab.mcp_servers';
export const MCP_SERVER_MANIFEST_SCHEMA_VERSION = 1;

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

function normalizeServerNamespace(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

function assertHostNamespaceAvailable(name: string): void {
  const namespace = normalizeServerNamespace(name);
  const collides = loadHostStdioServers()
    .filter((server) => server.enabled)
    .some((server) => normalizeServerNamespace(server.name) === namespace);

  if (collides) {
    throw new Error(`[MCP] Server name is reserved by a host-managed MCP server: "${name}"`);
  }
}

function assertValidUrl(url: string): void {
  if (url.length > MAX_URL_LENGTH) {
    throw new Error(`[MCP] Server url must be ${MAX_URL_LENGTH} characters or less`);
  }
  assertSafeHttpUrl(url);
}

function isNoRowsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: unknown; message?: unknown };
  return maybe.code === 'PGRST116' ||
    (typeof maybe.message === 'string' && /no rows|0 rows|multiple \(or no\) rows/i.test(maybe.message));
}

export class McpServerNotFoundError extends Error {
  constructor(id: string) {
    super(`[MCP_NOT_FOUND] MCP server not found: "${id}"`);
    this.name = 'McpServerNotFoundError';
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

export interface McpServerManifestEntry {
  name: string;
  transport: 'http';
  url: string;
  enabled: boolean;
  hasAuthToken?: boolean;
  authToken?: string;
}

export interface McpServerManifest {
  kind: typeof MCP_SERVER_MANIFEST_KIND;
  schemaVersion: typeof MCP_SERVER_MANIFEST_SCHEMA_VERSION;
  exportedAt?: string;
  servers: McpServerManifestEntry[];
}

export interface McpServerImportResult {
  created: McpServerSummary[];
  updated: McpServerSummary[];
  createdCount: number;
  updatedCount: number;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function rejectExecutableShape(value: Record<string, unknown>): void {
  if ('transport' in value && value.transport !== 'http') {
    throw new Error('[MCP] Imported MCP manifests can only contain HTTP servers');
  }

  for (const field of ['command', 'args', 'env']) {
    if (field in value) {
      throw new Error('[MCP] Stdio MCP servers are host-config-only and cannot be imported');
    }
  }
}

function readRequiredString(value: Record<string, unknown>, field: string): string {
  const raw = value[field];
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error(`[MCP] Manifest server "${field}" must be a non-empty string`);
  }
  return raw.trim();
}

function readOptionalEnabled(value: Record<string, unknown>): boolean {
  if (!('enabled' in value)) return true;
  if (typeof value.enabled !== 'boolean') {
    throw new Error('[MCP] Manifest server "enabled" must be a boolean');
  }
  return value.enabled;
}

function readOptionalAuthToken(value: Record<string, unknown>): string | undefined {
  if (!('authToken' in value)) return undefined;
  if (typeof value.authToken !== 'string' || !value.authToken.trim()) {
    throw new Error('[MCP] Manifest server "authToken" must be a non-empty string when provided');
  }
  const token = value.authToken.trim();
  if (token.length > MAX_AUTH_TOKEN_LENGTH) {
    throw new Error(`[MCP] Manifest server "authToken" must be ${MAX_AUTH_TOKEN_LENGTH} characters or less`);
  }
  return token;
}

function normalizeManifestServer(value: unknown): McpServerManifestEntry {
  if (!isRecord(value)) {
    throw new Error('[MCP] Each manifest server must be an object');
  }

  rejectExecutableShape(value);

  const name = readRequiredString(value, 'name');
  const url = readRequiredString(value, 'url');
  const enabled = readOptionalEnabled(value);
  const authToken = readOptionalAuthToken(value);

  assertValidName(name);
  assertHostNamespaceAvailable(name);
  assertValidUrl(url);

  return {
    name,
    transport: 'http',
    url,
    enabled,
    ...(typeof value.hasAuthToken === 'boolean' ? { hasAuthToken: value.hasAuthToken } : {}),
    ...(authToken ? { authToken } : {}),
  };
}

export function normalizeMcpServerManifest(input: unknown): McpServerManifest {
  if (!isRecord(input)) {
    throw new Error('[MCP] Manifest must be a JSON object');
  }

  if (input.kind !== MCP_SERVER_MANIFEST_KIND) {
    throw new Error(`[MCP] Manifest kind must be "${MCP_SERVER_MANIFEST_KIND}"`);
  }
  if (input.schemaVersion !== MCP_SERVER_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`[MCP] Manifest schemaVersion must be ${MCP_SERVER_MANIFEST_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(input.servers)) {
    throw new Error('[MCP] Manifest "servers" must be an array');
  }
  if (input.servers.length === 0) {
    throw new Error('[MCP] Manifest must include at least one server');
  }
  if (input.servers.length > MAX_IMPORT_SERVERS) {
    throw new Error(`[MCP] Manifest can import at most ${MAX_IMPORT_SERVERS} servers at a time`);
  }

  const servers = input.servers.map(normalizeManifestServer);
  const seenNames = new Set<string>();
  for (const server of servers) {
    if (seenNames.has(server.name)) {
      throw new Error(`[MCP] Manifest contains duplicate server name "${server.name}"`);
    }
    seenNames.add(server.name);
  }

  return {
    kind: MCP_SERVER_MANIFEST_KIND,
    schemaVersion: MCP_SERVER_MANIFEST_SCHEMA_VERSION,
    servers,
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

  /** Token-redacted portable manifest for a user's HTTP MCP servers. */
  async exportUserServers(userId: string): Promise<McpServerManifest> {
    const servers = await this.listUserServers(userId);
    return {
      kind: MCP_SERVER_MANIFEST_KIND,
      schemaVersion: MCP_SERVER_MANIFEST_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      servers: servers.map((server) => ({
        name: server.name,
        transport: 'http',
        url: server.url ?? '',
        enabled: server.enabled,
        hasAuthToken: server.hasAuthToken,
      })),
    };
  }

  /**
   * Import a token-redacted or user-augmented manifest. Existing servers are
   * matched by name and updated in place; omitted authToken values preserve the
   * saved token on updates and create tokenless rows for new servers.
   */
  async importHttpServerManifest(userId: string, input: unknown): Promise<McpServerImportResult> {
    const manifest = normalizeMcpServerManifest(input);
    const existing = await this.listUserServers(userId);
    const existingByName = new Map(existing.map((server) => [server.name, server]));
    const created: McpServerSummary[] = [];
    const updated: McpServerSummary[] = [];

    for (const entry of manifest.servers) {
      const matchingServer = existingByName.get(entry.name);
      if (matchingServer) {
        const patch: UpdateHttpServerInput = {
          url: entry.url,
          enabled: entry.enabled,
        };
        if (entry.authToken) patch.authToken = entry.authToken;
        updated.push(await this.updateHttpServer(userId, matchingServer.id, patch));
      } else {
        created.push(await this.createHttpServer(userId, {
          name: entry.name,
          url: entry.url,
          enabled: entry.enabled,
          authToken: entry.authToken,
        }));
      }
    }

    return {
      created,
      updated,
      createdCount: created.length,
      updatedCount: updated.length,
    };
  }

  /** Create an http MCP server for a user. (No stdio path exists by design.) */
  async createHttpServer(userId: string, input: CreateHttpServerInput): Promise<McpServerSummary> {
    assertValidName(input.name);
    assertHostNamespaceAvailable(input.name);
    assertValidUrl(input.url);

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
    if (input.name !== undefined) {
      assertValidName(input.name);
      assertHostNamespaceAvailable(input.name);
    }
    if (input.url !== undefined) assertValidUrl(input.url);

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

    if (error) {
      if (isNoRowsError(error)) throw new McpServerNotFoundError(id);
      throw new Error(error.message);
    }
    if (!data) throw new McpServerNotFoundError(id);
    return rowToSummary(data as McpServerRow);
  }

  /** Delete an http MCP server the user owns. */
  async deleteServer(userId: string, id: string): Promise<void> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .single();

    if (error) {
      if (isNoRowsError(error)) throw new McpServerNotFoundError(id);
      throw new Error(error.message);
    }
    if (!data) throw new McpServerNotFoundError(id);
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
