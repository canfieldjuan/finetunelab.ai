// MCP Client - Host (operator) config for stdio servers
//
// stdio MCP servers run arbitrary host commands (= host RCE), so they are NEVER
// user-configurable / DB-backed. They come ONLY from this trusted host config —
// an env var the operator controls — which closes the DB -> command -> RCE path by
// construction. See PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md.

import type { McpServerConfig } from './types';

export const HOST_STDIO_ENV = 'MCP_STDIO_SERVERS';

interface RawStdioEntry {
  name?: unknown;
  command?: unknown;
  args?: unknown;
  env?: unknown;
  enabled?: unknown;
}

function sanitizeEnv(env: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

/**
 * Parse stdio MCP servers from the trusted host config (env JSON array of
 * `{ name, command, args?, env?, enabled? }`). Malformed input is logged and
 * skipped rather than throwing, so one bad entry can't break server startup.
 */
export function loadHostStdioServers(
  raw: string | undefined = process.env[HOST_STDIO_ENV],
): McpServerConfig[] {
  if (!raw || !raw.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`[MCP] ${HOST_STDIO_ENV} is not valid JSON; ignoring all host stdio servers`);
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.error(`[MCP] ${HOST_STDIO_ENV} must be a JSON array; ignoring`);
    return [];
  }

  const servers: McpServerConfig[] = [];
  parsed.forEach((entry, index) => {
    const e = (entry && typeof entry === 'object' ? entry : {}) as RawStdioEntry;
    const name = typeof e.name === 'string' ? e.name.trim() : '';
    const command = typeof e.command === 'string' ? e.command.trim() : '';

    if (!name || !command) {
      console.error(`[MCP] ${HOST_STDIO_ENV}[${index}] is missing name/command; skipping`);
      return;
    }

    servers.push({
      id: `host-stdio:${name}`,
      name,
      transport: 'stdio',
      command,
      args: Array.isArray(e.args) ? e.args.filter((a): a is string => typeof a === 'string') : undefined,
      env: e.env && typeof e.env === 'object' ? sanitizeEnv(e.env as Record<string, unknown>) : undefined,
      enabled: e.enabled !== false, // default enabled
    });
  });

  return servers;
}
