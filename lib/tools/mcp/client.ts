// MCP Client - Connection manager
//
// Wraps the official @modelcontextprotocol/sdk Client to connect to MCP servers
// over HTTP (Streamable HTTP) or local stdio, list their tools, and call them.
// Provider-agnostic: this knows nothing about LLMs.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpServerConfig, McpToolCallResult, McpToolDescriptor } from './types';

const CLIENT_INFO = { name: 'finetunelab-mcp-client', version: '0.1.0' };
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

type McpTransport = StreamableHTTPClientTransport | StdioClientTransport;

interface Connection {
  client: Client;
  config: McpServerConfig;
}

/**
 * Manages live connections to MCP servers, keyed by server name.
 * One instance can hold many server connections.
 */
export class McpClientManager {
  private readonly connections = new Map<string, Connection>();
  // In-flight connects, so concurrent connect() calls for the same server share
  // one attempt (avoids spawning duplicate clients / orphan stdio processes).
  private readonly pending = new Map<string, Promise<void>>();
  private readonly requestTimeoutMs: number;

  constructor(opts?: { requestTimeoutMs?: number }) {
    this.requestTimeoutMs = opts?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  private buildTransport(config: McpServerConfig): McpTransport {
    if (config.transport === 'http') {
      if (!config.url) {
        throw new Error(`[MCP] Server "${config.name}" uses http transport but has no url`);
      }
      const parsed = new URL(config.url);
      // Constrain the transport to web protocols. The config layer (slices 2-3)
      // must additionally allowlist/block internal targets to prevent SSRF once
      // non-admins can configure http servers — see the gap log.
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(
          `[MCP] Server "${config.name}" url must use http(s), got: ${parsed.protocol}`,
        );
      }
      const opts = config.authToken
        ? { requestInit: { headers: { Authorization: `Bearer ${config.authToken}` } } }
        : undefined;
      return new StreamableHTTPClientTransport(parsed, opts);
    }

    if (config.transport === 'stdio') {
      if (!config.command) {
        throw new Error(`[MCP] Server "${config.name}" uses stdio transport but has no command`);
      }
      return new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      });
    }

    throw new Error(`[MCP] Server "${config.name}" has unknown transport: ${String(config.transport)}`);
  }

  /** Connect to a server. No-op if already connected; concurrent calls are deduped. */
  async connect(config: McpServerConfig): Promise<void> {
    if (this.connections.has(config.name)) return;

    const inFlight = this.pending.get(config.name);
    if (inFlight) return inFlight;

    const attempt = (async () => {
      const client = new Client(CLIENT_INFO);
      const transport = this.buildTransport(config);
      try {
        await client.connect(transport, { timeout: this.requestTimeoutMs });
      } catch (error) {
        // Don't leak a half-open transport / spawned stdio process on failure.
        await client.close().catch(() => {});
        throw error;
      }
      // If the server later closes the transport (stdio crash, HTTP session end),
      // drop the entry so isConnected() doesn't go stale and connect() can re-establish.
      client.onclose = () => {
        this.connections.delete(config.name);
      };
      this.connections.set(config.name, { client, config });
    })();

    this.pending.set(config.name, attempt);
    try {
      await attempt;
    } finally {
      this.pending.delete(config.name);
    }
  }

  isConnected(serverName: string): boolean {
    return this.connections.has(serverName);
  }

  connectedServers(): string[] {
    return [...this.connections.keys()];
  }

  private getClient(serverName: string): Client {
    const conn = this.connections.get(serverName);
    if (!conn) {
      throw new Error(`[MCP] Not connected to server "${serverName}"`);
    }
    return conn.client;
  }

  /** List every tool a connected server exposes, following pagination cursors. */
  async listTools(serverName: string): Promise<McpToolDescriptor[]> {
    const client = this.getClient(serverName);
    const tools: McpToolDescriptor[] = [];
    let cursor: string | undefined;

    do {
      const result = await client.listTools(
        cursor ? { cursor } : undefined,
        { timeout: this.requestTimeoutMs },
      );
      for (const tool of result.tools ?? []) {
        tools.push({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema });
      }
      cursor = result.nextCursor;
    } while (cursor);

    return tools;
  }

  /** Call a tool on a connected server. */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<McpToolCallResult> {
    const client = this.getClient(serverName);
    const result = await client.callTool(
      { name: toolName, arguments: args },
      undefined,
      { timeout: this.requestTimeoutMs },
    );
    return {
      content: result.content,
      structuredContent: result.structuredContent as Record<string, unknown> | undefined,
      isError: result.isError === true,
    };
  }

  /** Disconnect a single server. No-op if not connected. */
  async disconnect(serverName: string): Promise<void> {
    const conn = this.connections.get(serverName);
    if (!conn) return;
    this.connections.delete(serverName);
    try {
      await conn.client.close();
    } catch (error) {
      console.error(`[MCP] Error closing connection to "${serverName}":`, error);
    }
  }

  /** Disconnect every server. */
  async disconnectAll(): Promise<void> {
    await Promise.all(this.connectedServers().map((name) => this.disconnect(name)));
  }
}
