import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpClientManager } from '../client';
import type { McpServerConfig } from '../types';

// Shared mock for the underlying SDK Client. Hoisted so the vi.mock factory below
// can reference it.
const sdk = vi.hoisted(() => ({
  connect: vi.fn(),
  listTools: vi.fn(),
  callTool: vi.fn(),
  close: vi.fn(),
  ClientCtor: vi.fn(),
  HttpTransportCtor: vi.fn(),
  StdioTransportCtor: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    connect = sdk.connect;
    listTools = sdk.listTools;
    callTool = sdk.callTool;
    close = sdk.close;
    constructor() {
      sdk.ClientCtor();
    }
  },
}));
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class {
    constructor(url: URL, opts?: unknown) {
      sdk.HttpTransportCtor(url, opts);
    }
  },
}));
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class {
    constructor(params: unknown) {
      sdk.StdioTransportCtor(params);
    }
  },
}));

const httpServer: McpServerConfig = {
  id: 'srv-http',
  name: 'http-server',
  transport: 'http',
  url: 'https://example.com/mcp',
  authToken: 'secret-token',
  enabled: true,
};

const stdioServer: McpServerConfig = {
  id: 'srv-stdio',
  name: 'stdio-server',
  transport: 'stdio',
  command: 'node',
  args: ['server.js'],
  env: { FOO: 'bar' },
  enabled: true,
};

describe('McpClientManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.connect.mockResolvedValue(undefined);
    sdk.close.mockResolvedValue(undefined);
    sdk.listTools.mockResolvedValue({
      tools: [{ name: 'echo', description: 'echoes', inputSchema: { type: 'object', properties: {} } }],
    });
    sdk.callTool.mockResolvedValue({ content: [{ type: 'text', text: 'pong' }], isError: false });
  });

  it('connects over HTTP with a bearer auth header and is idempotent', async () => {
    const manager = new McpClientManager();
    await manager.connect(httpServer);
    await manager.connect(httpServer); // second call is a no-op

    expect(manager.isConnected('http-server')).toBe(true);
    expect(sdk.ClientCtor).toHaveBeenCalledTimes(1);
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    expect(sdk.HttpTransportCtor).toHaveBeenCalledWith(
      new URL('https://example.com/mcp'),
      { requestInit: { headers: { Authorization: 'Bearer secret-token' } } },
    );
  });

  it('connects over stdio with command/args/env', async () => {
    const manager = new McpClientManager();
    await manager.connect(stdioServer);

    expect(sdk.StdioTransportCtor).toHaveBeenCalledWith({
      command: 'node',
      args: ['server.js'],
      env: { FOO: 'bar' },
    });
  });

  it('rejects http transport without a url and stdio without a command', async () => {
    const manager = new McpClientManager();
    await expect(manager.connect({ id: 'x', name: 'bad-http', transport: 'http', enabled: true })).rejects.toThrow(
      /no url/,
    );
    await expect(manager.connect({ id: 'y', name: 'bad-stdio', transport: 'stdio', enabled: true })).rejects.toThrow(
      /no command/,
    );
  });

  it('lists tools mapped to descriptors', async () => {
    const manager = new McpClientManager();
    await manager.connect(httpServer);
    const tools = await manager.listTools('http-server');
    expect(tools).toEqual([
      { name: 'echo', description: 'echoes', inputSchema: { type: 'object', properties: {} } },
    ]);
  });

  it('calls a tool with name + arguments and normalizes isError', async () => {
    const manager = new McpClientManager();
    await manager.connect(httpServer);
    const result = await manager.callTool('http-server', 'echo', { msg: 'hi' });

    expect(sdk.callTool).toHaveBeenCalledWith(
      { name: 'echo', arguments: { msg: 'hi' } },
      undefined,
      { timeout: 30000 },
    );
    expect(result).toEqual({ content: [{ type: 'text', text: 'pong' }], isError: false });
  });

  it('throws when listing/calling an unconnected server', async () => {
    const manager = new McpClientManager();
    await expect(manager.listTools('nope')).rejects.toThrow(/Not connected/);
    await expect(manager.callTool('nope', 'echo', {})).rejects.toThrow(/Not connected/);
  });

  it('disconnect closes the client and removes the connection', async () => {
    const manager = new McpClientManager();
    await manager.connect(httpServer);
    await manager.disconnect('http-server');

    expect(sdk.close).toHaveBeenCalledTimes(1);
    expect(manager.isConnected('http-server')).toBe(false);
    await manager.disconnect('http-server'); // no-op, no throw
  });
});
