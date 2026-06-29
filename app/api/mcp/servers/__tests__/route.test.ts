import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { DELETE, PATCH } from '../[id]/route';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  loadHostStdioServers: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/models/encryption', () => ({
  encrypt: (s: string) => `ENC(${s})`,
  decrypt: (s: string) => s.replace(/^ENC\(|\)$/g, ''),
}));

vi.mock('@/lib/tools/mcp/host-config', () => ({
  loadHostStdioServers: mocks.loadHostStdioServers,
}));

interface QueryResult {
  data: unknown;
  error: unknown;
}

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.delete = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.single = vi.fn(async () => result);
  builder.then = (resolve: (value: QueryResult) => unknown) => resolve(result);
  return builder;
}

function makeSupabase(result: QueryResult) {
  const builder = makeBuilder(result);
  const getUser = vi.fn(async () => ({
    data: { user: { id: 'user-1', email: 'user@example.com' } },
    error: null,
  }));
  const supabase = {
    auth: { getUser },
    from: vi.fn(() => builder),
  };
  return { supabase, builder, getUser };
}

function request(path: string, init: RequestInit = {}) {
  return new NextRequest(`http://localhost${path}`, {
    method: init.method,
    body: init.body,
    headers: {
      Authorization: 'Bearer session-token',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
}

function jsonRequest(path: string, method: string, body: Record<string, unknown>) {
  return request(path, { method, body: JSON.stringify(body) });
}

const httpRow = {
  id: 'srv-1',
  user_id: 'user-1',
  name: 'github_docs',
  transport: 'http',
  url: 'https://api.example.com/mcp',
  auth_token_encrypted: 'ENC(secret-token)',
  enabled: true,
};

describe('/api/mcp/servers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadHostStdioServers.mockReturnValue([]);
  });

  it('requires a Supabase bearer session', async () => {
    const { supabase } = makeSupabase({ data: [], error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await GET(new NextRequest('http://localhost/api/mcp/servers'));

    expect(response.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('lists token-redacted HTTP servers and host stdio names without command details', async () => {
    const { supabase } = makeSupabase({ data: [httpRow], error: null });
    mocks.createClient.mockReturnValue(supabase);
    mocks.loadHostStdioServers.mockReturnValue([
      {
        id: 'host-stdio:filesystem',
        name: 'filesystem',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        env: { SECRET: 'do-not-return' },
        enabled: true,
      },
      {
        id: 'host-stdio:disabled',
        name: 'disabled',
        transport: 'stdio',
        command: 'node',
        enabled: false,
      },
    ]);

    const response = await GET(request('/api/mcp/servers'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.servers).toEqual([
      {
        id: 'srv-1',
        name: 'github_docs',
        transport: 'http',
        url: 'https://api.example.com/mcp',
        enabled: true,
        hasAuthToken: true,
      },
    ]);
    expect(JSON.stringify(body.servers)).not.toContain('secret-token');
    expect(JSON.stringify(body.servers)).not.toContain('auth_token_encrypted');
    expect(body.hostServers).toEqual([
      {
        id: 'host-stdio:filesystem',
        name: 'filesystem',
        transport: 'stdio',
        enabled: true,
        managedBy: 'host',
      },
    ]);
    expect(JSON.stringify(body.hostServers)).not.toContain('npx');
    expect(JSON.stringify(body.hostServers)).not.toContain('SECRET');
  });

  it('creates HTTP MCP servers through the real config service', async () => {
    const { supabase, builder } = makeSupabase({ data: httpRow, error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await POST(
      jsonRequest('/api/mcp/servers', 'POST', {
        name: ' github_docs ',
        url: ' https://api.example.com/mcp ',
        authToken: ' secret-token ',
        enabled: true,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        name: 'github_docs',
        transport: 'http',
        url: 'https://api.example.com/mcp',
        auth_token_encrypted: 'ENC(secret-token)',
        enabled: true,
      }),
    );
    expect(body.server).toEqual({
      id: 'srv-1',
      name: 'github_docs',
      transport: 'http',
      url: 'https://api.example.com/mcp',
      enabled: true,
      hasAuthToken: true,
    });
  });

  it('rejects stdio-shaped create payloads before touching the DB', async () => {
    const { supabase, builder } = makeSupabase({ data: httpRow, error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await POST(
      jsonRequest('/api/mcp/servers', 'POST', {
        name: 'shell',
        transport: 'stdio',
        command: 'npx',
        args: ['danger'],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/Only HTTP MCP servers|Stdio MCP servers/);
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it('updates enabled state and clears tokens through the real config service', async () => {
    const updatedRow = { ...httpRow, auth_token_encrypted: null, enabled: false };
    const { supabase, builder } = makeSupabase({ data: updatedRow, error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await PATCH(
      jsonRequest('/api/mcp/servers/srv-1', 'PATCH', {
        enabled: false,
        authToken: null,
      }),
      { params: Promise.resolve({ id: 'srv-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith({
      enabled: false,
      auth_token_encrypted: null,
    });
    expect(builder.eq).toHaveBeenCalledWith('id', 'srv-1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(body.server.hasAuthToken).toBe(false);
  });

  it('rejects stdio-shaped update payloads before touching the DB', async () => {
    const { supabase, builder } = makeSupabase({ data: httpRow, error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await PATCH(
      jsonRequest('/api/mcp/servers/srv-1', 'PATCH', {
        command: 'node',
        env: { SECRET: 'nope' },
      }),
      { params: Promise.resolve({ id: 'srv-1' }) },
    );

    expect(response.status).toBe(400);
    expect(builder.update).not.toHaveBeenCalled();
  });

  it('deletes a server scoped by id and authenticated user', async () => {
    const { supabase, builder } = makeSupabase({ data: null, error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await DELETE(request('/api/mcp/servers/srv-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'srv-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'srv-1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
