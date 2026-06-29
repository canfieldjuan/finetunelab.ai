// MCP Client - Per-user toolset (Slice 3b)
//
// Resolves a user's enabled MCP servers into an in-memory set of neutral tool
// definitions + a scoped dispatcher, at request time. Per the multi-tenancy
// decision, MCP tools are NEVER written to the global `tools` table or the global
// ToolRegistry — they are built per user and injected by the chat route (3c), so
// one user's tools (and their server auth) are never offered or dispatchable to
// another user. Dispatch is scoped to the names in *this* toolset.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ToolDefinition } from '../types';
import type { McpServerConfig } from './types';
import { McpClientManager } from './client';
import { mcpToolToDefinition } from './adapter';
import { McpServerConfigService } from './server-config.service';

interface ResolvedTool {
  definition: ToolDefinition;
  serverId: string;
  serverName: string;
  toolName: string;
}

export class McpUserToolset {
  private readonly tools = new Map<string, ResolvedTool>(); // keyed by namespaced tool name

  constructor(private readonly manager: McpClientManager) {}

  /**
   * Connect each server, list its tools, and adapt them. Per-server failures are
   * logged and skipped so one unreachable server doesn't break the rest.
   */
  async load(servers: McpServerConfig[]): Promise<void> {
    for (const server of servers) {
      try {
        await this.manager.connect(server);
        const descriptors = await this.manager.listTools(server.id);
        for (const descriptor of descriptors) {
          const definition = mcpToolToDefinition(server, descriptor, this.manager);
          this.tools.set(definition.name, {
            definition,
            serverId: server.id,
            serverName: server.name,
            toolName: descriptor.name,
          });
        }
      } catch (error) {
        console.error(`[MCP] Failed to load tools from server "${server.name}":`, error);
      }
    }
  }

  /** Neutral tool definitions to offer the model (request-time injection in 3c). */
  definitions(): ToolDefinition[] {
    return [...this.tools.values()].map((tool) => tool.definition);
  }

  /** Namespaced names of the tools in this toolset. */
  toolNames(): string[] {
    return [...this.tools.keys()];
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** Execute one of THIS user's MCP tools by its namespaced name (scoped dispatch). */
  async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`[MCP] Tool "${name}" is not in this user's MCP toolset`);
    }
    return tool.definition.execute(args ?? {});
  }
}

/**
 * Build the requesting user's MCP toolset: their enabled DB http servers + the host
 * stdio servers (via `McpServerConfigService.listEnabledServers`), connected and
 * listed through the shared id-keyed manager.
 */
export async function buildUserMcpToolset(
  userId: string,
  supabase: SupabaseClient,
  manager: McpClientManager,
): Promise<McpUserToolset> {
  const servers = await new McpServerConfigService(supabase).listEnabledServers(userId);
  const toolset = new McpUserToolset(manager);
  await toolset.load(servers);
  return toolset;
}
