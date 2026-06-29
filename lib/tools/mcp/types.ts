// MCP Client - Shared types
//
// Provider-agnostic by design: nothing in this module (or the rest of lib/tools/mcp)
// knows about LLM providers. MCP tools are adapted into the neutral registry
// ToolDefinition; provider translation + capability gating happen only in the LLM
// adapters (see lib/llm/adapters/*). See PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md.

export type McpTransportKind = 'http' | 'stdio';

/**
 * Client-facing MCP server configuration.
 *
 * This is the resolved shape the client manager consumes. The persisted record
 * (DB row with an auth *secret reference*) and the resolution of that reference
 * into `authToken` are introduced in a later slice; the manager only ever sees a
 * already-resolved token.
 */
export interface McpServerConfig {
  /** Stable identifier (DB id later; any unique string for now). */
  id: string;
  /** Human-friendly name; becomes the tool namespace: `mcp__<name>__<tool>`. */
  name: string;
  transport: McpTransportKind;
  /** HTTP transport: the server endpoint URL. */
  url?: string;
  /** stdio transport: the command to spawn, plus optional args/env. */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** Resolved bearer token for HTTP transport (already pulled from secrets). */
  authToken?: string;
  enabled: boolean;
}

/** A tool as described by an MCP server (the subset we consume). */
export interface McpToolDescriptor {
  name: string;
  description?: string;
  /** JSON Schema object describing the tool's arguments. */
  inputSchema?: unknown;
}

/** Normalized result of an MCP `tools/call`. */
export interface McpToolCallResult {
  /** Raw MCP content blocks (e.g. `[{ type: 'text', text: '...' }]`). */
  content: unknown;
  isError: boolean;
}
