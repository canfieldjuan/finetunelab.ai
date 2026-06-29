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
  instances: [] as Array<{ onclose?: () => void }>,
}));

// Mock the URL/SSRF guard so connect() doesn't do real DNS; the guard's own logic is
// covered in url-guard.test.ts. Here we just verify connect wires it in.
const guard = vi.hoisted(() => ({
  assertSafeHttpUrl: vi.fn(),
  assertResolvedHostIsPublic: vi.fn(),
}));
vi.mock('../url-guard', () => ({
  assertSafeHttpUrl: guard.assertSafeHttpUrl,
  assertResolvedHostIsPublic: guard.assertResolvedHostIsPublic,
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    connect = sdk.connect;
    listTools = sdk.listTools;
    callTool = sdk.callTool;
    close = sdk.close;
    onclose?: () => void;
    constructor() {
      sdk.ClientCtor();
      sdk.instances.push(this);
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
    sdk.instances.length = 0;
    sdk.connect.mockResolvedValue(undefined);
    sdk.close.mockResolvedValue(undefined);
    sdk.listTools.mockResolvedValue({
      tools: [{ name: 'echo', description: 'echoes', inputSchema: { type: 'object', properties: {} } }],
    });
    sdk.callTool.mockResolvedValue({ content: [{ type: 'text', text: 'pong' }], isError: false });
    guard.assertSafeHttpUrl.mockReturnValue(undefined);
    guard.assertResolvedHostIsPublic.mockResolvedValue(undefined);
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
      expect.objectContaining({
        requestInit: { redirect: 'error', headers: { Authorization: 'Bearer secret-token' } },
        fetch: expect.any(Function),
      }),
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

  it('rejects non-http(s) urls (SSRF/egress hardening at the core)', async () => {
    const manager = new McpClientManager();
    await expect(
      manager.connect({ id: 'z', name: 'file-srv', transport: 'http', url: 'file:///etc/passwd', enabled: true }),
    ).rejects.toThrow(/http\(s\)/);
  });

  it('deduplicates concurrent connects to the same server', async () => {
    const manager = new McpClientManager();
    await Promise.all([manager.connect(httpServer), manager.connect(httpServer)]);
    expect(sdk.ClientCtor).toHaveBeenCalledTimes(1);
    expect(sdk.connect).toHaveBeenCalledTimes(1);
  });

  it('lists all tools across pagination cursors', async () => {
    sdk.listTools
      .mockResolvedValueOnce({
        tools: [{ name: 'a', description: '', inputSchema: { type: 'object', properties: {} } }],
        nextCursor: 'cursor-1',
      })
      .mockResolvedValueOnce({
        tools: [{ name: 'b', description: '', inputSchema: { type: 'object', properties: {} } }],
      });

    const manager = new McpClientManager();
    await manager.connect(httpServer);
    const tools = await manager.listTools('http-server');

    expect(tools.map((t) => t.name)).toEqual(['a', 'b']);
    expect(sdk.listTools).toHaveBeenCalledTimes(2);
    expect(sdk.listTools).toHaveBeenNthCalledWith(2, { cursor: 'cursor-1' }, { timeout: 30000 });
  });

  it('calls a tool with name + arguments and carries structuredContent', async () => {
    sdk.callTool.mockResolvedValue({ content: [], structuredContent: { answer: 42 }, isError: false });

    const manager = new McpClientManager();
    await manager.connect(httpServer);
    const result = await manager.callTool('http-server', 'echo', { msg: 'hi' });

    expect(sdk.callTool).toHaveBeenCalledWith(
      { name: 'echo', arguments: { msg: 'hi' } },
      undefined,
      { timeout: 30000 },
    );
    expect(result).toEqual({ content: [], structuredContent: { answer: 42 }, isError: false });
  });

  it('closes the client if connect fails (no leaked transport/process)', async () => {
    sdk.connect.mockRejectedValueOnce(new Error('handshake failed'));
    const manager = new McpClientManager();

    await expect(manager.connect(httpServer)).rejects.toThrow('handshake failed');
    expect(sdk.close).toHaveBeenCalledTimes(1);
    expect(manager.isConnected('http-server')).toBe(false);
  });

  it('refuses to connect when the host resolves to a private address (SSRF guard)', async () => {
    guard.assertResolvedHostIsPublic.mockRejectedValueOnce(new Error('resolves to a non-public address'));
    const manager = new McpClientManager();

    await expect(manager.connect(httpServer)).rejects.toThrow(/non-public address/);
    expect(sdk.connect).not.toHaveBeenCalled();
    expect(manager.isConnected('http-server')).toBe(false);
  });

  it('filters out task-required tools from listTools', async () => {
    sdk.listTools.mockResolvedValueOnce({
      tools: [
        { name: 'normal', description: '', inputSchema: { type: 'object', properties: {} } },
        {
          name: 'taskonly',
          description: '',
          inputSchema: { type: 'object', properties: {} },
          execution: { taskSupport: 'required' },
        },
      ],
    });
    const manager = new McpClientManager();
    await manager.connect(httpServer);

    const tools = await manager.listTools('http-server');
    expect(tools.map((t) => t.name)).toEqual(['normal']);
  });

  it('throws when listing/calling an unconnected server', async () => {
    const manager = new McpClientManager();
    await expect(manager.listTools('nope')).rejects.toThrow(/Not connected/);
    await expect(manager.callTool('nope', 'echo', {})).rejects.toThrow(/Not connected/);
  });

  it('drops the connection when the transport closes (onclose)', async () => {
    const manager = new McpClientManager();
    await manager.connect(httpServer);
    expect(manager.isConnected('http-server')).toBe(true);

    sdk.instances.at(-1)?.onclose?.();
    expect(manager.isConnected('http-server')).toBe(false);
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
