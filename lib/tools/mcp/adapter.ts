// MCP Client - Adapter
//
// Turns an MCP tool descriptor into the *neutral* registry ToolDefinition (for
// executeTool dispatch) and a DB `tools` row shape (so the client offers it like
// any other tool, Slice 3). No provider-specific code lives here — MCP tools ride
// the exact same path as built-in tools and the LLM adapters decide usage.

import type { ToolDefinition, ToolParameter } from '../types';
import type { McpClientManager } from './client';
import type { McpServerConfig, McpToolCallResult, McpToolDescriptor } from './types';

const MCP_TOOL_PREFIX = 'mcp';
// Provider tool-name constraint: OpenAI requires names to match
// ^[a-zA-Z0-9_-]{1,64}$ (NO dot, max 64 chars); Anthropic is similar. We sanitize
// to that character set and clamp the *composed* name to 64 so declaring MCP tools
// to OpenAI (slice 3) doesn't 400.
const MAX_TOOL_NAME_LENGTH = 64;
const NAME_HASH_LENGTH = 8;

/** Sanitize a name segment to provider-safe characters: [a-zA-Z0-9_-]. */
function sanitizeSegment(segment: string): string {
  return segment.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** Deterministic FNV-1a short hash (for collision-avoidance, not security). */
function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(NAME_HASH_LENGTH, '0');
}

/**
 * Namespaced tool name: `mcp__<server>__<tool>`, bounded to {@link MAX_TOOL_NAME_LENGTH}
 * (OpenAI requires `^[a-zA-Z0-9_-]{1,64}$`). When the composed name exceeds the limit
 * it is truncated AND suffixed with a hash of the full name, so a long server/tool name
 * can't make distinct tools collapse to the same provider name (a plain clamp could
 * drop the `__<tool>` suffix entirely).
 */
export function mcpToolName(serverName: string, toolName: string): string {
  const name = `${MCP_TOOL_PREFIX}__${sanitizeSegment(serverName)}__${sanitizeSegment(toolName)}`;
  if (name.length <= MAX_TOOL_NAME_LENGTH) return name;
  const head = name.slice(0, MAX_TOOL_NAME_LENGTH - NAME_HASH_LENGTH - 1);
  return `${head}_${shortHash(name)}`;
}

interface JsonSchemaObject {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

// JSON Schema 'integer' has no JS typeof equivalent; the repo's tool validator
// checks `typeof value`, so map 'integer' -> 'number' to keep numeric args valid.
function normalizeSchemaType(type: string | string[] | undefined): string | string[] {
  if (Array.isArray(type)) return type.map((entry) => (entry === 'integer' ? 'number' : entry));
  if (type === 'integer') return 'number';
  return type ?? 'string';
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/** Normalize an MCP `inputSchema` into the registry ToolDefinition.parameters shape. */
export function normalizeInputSchema(inputSchema: unknown): ToolDefinition['parameters'] {
  const schema = (inputSchema && typeof inputSchema === 'object' ? inputSchema : {}) as JsonSchemaObject;
  const rawProps =
    schema.properties && typeof schema.properties === 'object'
      ? (schema.properties as Record<string, unknown>)
      : {};

  const properties: Record<string, ToolParameter> = {};
  for (const [key, value] of Object.entries(rawProps)) {
    const prop = (value && typeof value === 'object' ? value : {}) as {
      type?: string | string[];
      description?: string;
      enum?: unknown;
    };
    properties[key] = {
      type: normalizeSchemaType(prop.type),
      description: typeof prop.description === 'string' ? prop.description : '',
      // Keep enum values in their original JSON types (numeric/boolean enums must
      // not be stringified or the provider contract + validator break).
      ...(Array.isArray(prop.enum) ? { enum: prop.enum.filter(isPrimitive) } : {}),
    };
  }

  return {
    type: 'object',
    properties,
    required: Array.isArray(schema.required)
      ? schema.required.filter((entry): entry is string => typeof entry === 'string')
      : [],
  };
}

interface McpTextBlock {
  type: 'text';
  text: string;
}

function isTextBlock(block: unknown): block is McpTextBlock {
  return (
    !!block &&
    typeof block === 'object' &&
    (block as { type?: unknown }).type === 'text' &&
    typeof (block as { text?: unknown }).text === 'string'
  );
}

/**
 * Normalize an MCP call result into a plain value for the chat tool result.
 * Flattens text content blocks; throws on `isError` so executeTool surfaces it.
 */
export function normalizeMcpResult(result: McpToolCallResult): unknown {
  const blocks = Array.isArray(result.content) ? result.content : [];
  const text = blocks
    .filter(isTextBlock)
    .map((block) => block.text)
    .join('\n');

  if (result.isError) {
    throw new Error(text || 'MCP tool call failed');
  }

  // Prefer flattened text; then structuredContent (tools with an outputSchema may
  // return only structuredContent with empty content); else the raw blocks.
  if (text) return text;
  if (result.structuredContent !== undefined) return result.structuredContent;
  return blocks;
}

function describe(server: McpServerConfig, mcpTool: McpToolDescriptor): string {
  return mcpTool.description?.trim() || `MCP tool "${mcpTool.name}" from server "${server.name}".`;
}

/** Adapt an MCP tool into a provider-agnostic registry ToolDefinition. */
export function mcpToolToDefinition(
  server: McpServerConfig,
  mcpTool: McpToolDescriptor,
  manager: McpClientManager,
): ToolDefinition {
  return {
    name: mcpToolName(server.name, mcpTool.name),
    description: describe(server, mcpTool),
    version: '1.0.0',
    parameters: normalizeInputSchema(mcpTool.inputSchema),
    config: { enabled: server.enabled },
    async execute(params: Record<string, unknown>) {
      // Dispatch by server id (connections are id-keyed); the display name is only
      // used for the tool namespace above.
      const result = await manager.callTool(server.id, mcpTool.name, params ?? {});
      return normalizeMcpResult(result);
    },
  };
}

/** Row shape for upserting an MCP tool into the DB `tools` table (used in Slice 3). */
export interface McpToolDbRow {
  name: string;
  description: string;
  parameters: ToolDefinition['parameters'];
  is_builtin: false;
  is_enabled: boolean;
}

export function mcpToolToDbRow(server: McpServerConfig, mcpTool: McpToolDescriptor): McpToolDbRow {
  return {
    name: mcpToolName(server.name, mcpTool.name),
    description: describe(server, mcpTool),
    parameters: normalizeInputSchema(mcpTool.inputSchema),
    is_builtin: false,
    is_enabled: server.enabled,
  };
}
