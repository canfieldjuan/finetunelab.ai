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
  private readonly requestTimeoutMs: number;

  constructor(opts?: { requestTimeoutMs?: number }) {
    this.requestTimeoutMs = opts?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  private buildTransport(config: McpServerConfig): McpTransport {
    if (config.transport === 'http') {
      if (!config.url) {
        throw new Error(`[MCP] Server "${config.name}" uses http transport but has no url`);
      }
      const opts = config.authToken
        ? { requestInit: { headers: { Authorization: `Bearer ${config.authToken}` } } }
        : undefined;
      return new StreamableHTTPClientTransport(new URL(config.url), opts);
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

  /** Connect to a server. No-op if already connected (idempotent). */
  async connect(config: McpServerConfig): Promise<void> {
    if (this.connections.has(config.name)) return;

    const client = new Client(CLIENT_INFO);
    const transport = this.buildTransport(config);
    await client.connect(transport, { timeout: this.requestTimeoutMs });
    this.connections.set(config.name, { client, config });
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

  /** List the tools a connected server exposes. */
  async listTools(serverName: string): Promise<McpToolDescriptor[]> {
    const client = this.getClient(serverName);
    const result = await client.listTools(undefined, { timeout: this.requestTimeoutMs });
    return (result.tools ?? []).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
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
