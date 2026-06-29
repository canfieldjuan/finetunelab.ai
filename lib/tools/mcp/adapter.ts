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

/** Sanitize a name segment so the composed tool name is safe for providers. */
function sanitizeSegment(segment: string): string {
  return segment.trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
}

/** Namespaced tool name: `mcp__<server>__<tool>`. */
export function mcpToolName(serverName: string, toolName: string): string {
  return `${MCP_TOOL_PREFIX}__${sanitizeSegment(serverName)}__${sanitizeSegment(toolName)}`;
}

interface JsonSchemaObject {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
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
      type: prop.type ?? 'string',
      description: typeof prop.description === 'string' ? prop.description : '',
      ...(Array.isArray(prop.enum) ? { enum: prop.enum.map((v) => String(v)) } : {}),
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

  // Prefer flattened text; fall back to the raw blocks for structured content.
  return text || blocks;
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
      const result = await manager.callTool(server.name, mcpTool.name, params ?? {});
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
