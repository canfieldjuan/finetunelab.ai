import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as GETCatalog } from '../catalog/route';
import { GET as GETExport } from '../export/route';
import { POST as POSTImport } from '../import/route';
import { GET as GETServers, POST as POSTServer } from '../route';
import { DELETE, PATCH } from '../[id]/route';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  loadHostStdioServers: vi.fn(),
  disconnectMcpServer: vi.fn(),
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

vi.mock('@/lib/tools/mcp/client', () => ({
  getSharedMcpClientManager: () => ({
    disconnect: mocks.disconnectMcpServer,
  }),
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

function makeSupabaseSequence(results: QueryResult[]) {
  const builders = results.map(makeBuilder);
  let index = 0;
  const getUser = vi.fn(async () => ({
    data: { user: { id: 'user-1', email: 'user@example.com' } },
    error: null,
  }));
  const supabase = {
    auth: { getUser },
    from: vi.fn(() => builders[Math.min(index++, builders.length - 1)]),
  };
  return { supabase, builders, getUser };
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

const noRowsError = {
  code: 'PGRST116',
  message: 'JSON object requested, multiple (or no) rows returned',
};

describe('/api/mcp/servers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadHostStdioServers.mockReturnValue([]);
  });

  it('requires a Supabase bearer session', async () => {
    const { supabase } = makeSupabase({ data: [], error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await GETServers(new NextRequest('http://localhost/api/mcp/servers'));

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

    const response = await GETServers(request('/api/mcp/servers'));
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

  it('exports a versioned token-redacted HTTP server manifest', async () => {
    const { supabase } = makeSupabase({ data: [httpRow], error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await GETExport(request('/api/mcp/servers/export'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.manifest).toEqual({
      kind: 'finetunelab.mcp_servers',
      schemaVersion: 1,
      exportedAt: expect.any(String),
      servers: [
        {
          name: 'github_docs',
          transport: 'http',
          url: 'https://api.example.com/mcp',
          enabled: true,
          hasAuthToken: true,
        },
      ],
    });
    expect(JSON.stringify(body.manifest)).not.toContain('secret-token');
    expect(JSON.stringify(body.manifest)).not.toContain('auth_token_encrypted');
  });

  it('imports HTTP server manifests by updating matching names and creating missing servers', async () => {
    const updatedRow = {
      ...httpRow,
      url: 'https://new.example.com/mcp',
      enabled: false,
    };
    const newRow = {
      id: 'srv-2',
      user_id: 'user-1',
      name: 'learn_docs',
      transport: 'http',
      url: 'https://learn.microsoft.com/api/mcp',
      auth_token_encrypted: 'ENC(new-token)',
      enabled: true,
    };
    const { supabase, builders } = makeSupabaseSequence([
      { data: [httpRow], error: null },
      { data: updatedRow, error: null },
      { data: newRow, error: null },
    ]);
    mocks.createClient.mockReturnValue(supabase);

    const response = await POSTImport(
      jsonRequest('/api/mcp/servers/import', 'POST', {
        kind: 'finetunelab.mcp_servers',
        schemaVersion: 1,
        servers: [
          {
            name: 'github_docs',
            transport: 'http',
            url: 'https://new.example.com/mcp',
            enabled: false,
          },
          {
            name: 'learn_docs',
            transport: 'http',
            url: 'https://learn.microsoft.com/api/mcp',
            enabled: true,
            authToken: 'new-token',
          },
        ],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(builders[1].update).toHaveBeenCalledWith({
      url: 'https://new.example.com/mcp',
      enabled: false,
    });
    expect(builders[1].eq).toHaveBeenCalledWith('id', 'srv-1');
    expect(builders[1].eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builders[2].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        name: 'learn_docs',
        transport: 'http',
        url: 'https://learn.microsoft.com/api/mcp',
        auth_token_encrypted: 'ENC(new-token)',
        enabled: true,
      }),
    );
    expect(body.result.createdCount).toBe(1);
    expect(body.result.updatedCount).toBe(1);
    expect(JSON.stringify(body)).not.toContain('new-token');
    expect(mocks.disconnectMcpServer).toHaveBeenCalledWith('srv-1');
    expect(mocks.disconnectMcpServer).toHaveBeenCalledWith('srv-2');
  });

  it('rejects executable stdio-shaped imports before touching server rows', async () => {
    const { supabase } = makeSupabase({ data: [], error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await POSTImport(
      jsonRequest('/api/mcp/servers/import', 'POST', {
        kind: 'finetunelab.mcp_servers',
        schemaVersion: 1,
        servers: [
          {
            name: 'shell',
            transport: 'stdio',
            command: 'npx',
            args: ['danger'],
            env: { SECRET: 'nope' },
          },
        ],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toMatch(/HTTP servers|host-config-only/);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(mocks.disconnectMcpServer).not.toHaveBeenCalled();
  });

  it('lists a safe HTTP MCP catalog without executable config fields', async () => {
    const { supabase } = makeSupabase({ data: [], error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await GETCatalog(request('/api/mcp/servers/catalog'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.catalog.map((entry: { id: string }) => entry.id)).toEqual(['microsoft-learn', 'deepwiki']);
    expect(body.catalog[0].manifest.servers[0]).toMatchObject({
      name: 'microsoft_learn',
      transport: 'http',
      url: 'https://learn.microsoft.com/api/mcp',
      enabled: true,
    });
    expect(JSON.stringify(body.catalog)).not.toContain('command');
    expect(JSON.stringify(body.catalog)).not.toContain('env');
    expect(JSON.stringify(body.catalog)).not.toContain('authToken');
  });

  it('creates HTTP MCP servers through the real config service', async () => {
    const { supabase, builder } = makeSupabase({ data: httpRow, error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await POSTServer(
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

  it('rejects route-level private create urls before touching the DB', async () => {
    const { supabase, builder } = makeSupabase({ data: httpRow, error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await POSTServer(
      jsonRequest('/api/mcp/servers', 'POST', {
        name: 'metadata',
        url: 'http://169.254.169.254/latest/meta-data',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toMatch(/not allowed/);
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it('rejects user server names reserved by enabled host stdio servers', async () => {
    const { supabase, builder } = makeSupabase({ data: httpRow, error: null });
    mocks.createClient.mockReturnValue(supabase);
    mocks.loadHostStdioServers.mockReturnValue([
      { id: 'host-stdio:docs', name: 'github docs', transport: 'stdio', command: 'npx', enabled: true },
    ]);

    const response = await POSTServer(
      jsonRequest('/api/mcp/servers', 'POST', {
        name: 'github_docs',
        url: 'https://api.example.com/mcp',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toMatch(/reserved by a host-managed MCP server/);
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it('rejects stdio-shaped create payloads before touching the DB', async () => {
    const { supabase, builder } = makeSupabase({ data: httpRow, error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await POSTServer(
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
    expect(mocks.disconnectMcpServer).toHaveBeenCalledWith('srv-1');
  });

  it('rejects route-level private update urls before touching the DB', async () => {
    const { supabase, builder } = makeSupabase({ data: httpRow, error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await PATCH(
      jsonRequest('/api/mcp/servers/srv-1', 'PATCH', {
        url: 'http://localhost:8080/mcp',
      }),
      { params: Promise.resolve({ id: 'srv-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toMatch(/not allowed/);
    expect(builder.update).not.toHaveBeenCalled();
  });

  it('rejects renames that collide with enabled host stdio namespaces', async () => {
    const { supabase, builder } = makeSupabase({ data: httpRow, error: null });
    mocks.createClient.mockReturnValue(supabase);
    mocks.loadHostStdioServers.mockReturnValue([
      { id: 'host-stdio:docs', name: 'github docs', transport: 'stdio', command: 'npx', enabled: true },
    ]);

    const response = await PATCH(
      jsonRequest('/api/mcp/servers/srv-1', 'PATCH', {
        name: 'github_docs',
      }),
      { params: Promise.resolve({ id: 'srv-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toMatch(/reserved by a host-managed MCP server/);
    expect(builder.update).not.toHaveBeenCalled();
  });

  it('returns 404 without raw DB details when update finds no owned row', async () => {
    const { supabase } = makeSupabase({ data: null, error: noRowsError });
    mocks.createClient.mockReturnValue(supabase);

    const response = await PATCH(
      jsonRequest('/api/mcp/servers/srv-other-user', 'PATCH', {
        enabled: false,
      }),
      { params: Promise.resolve({ id: 'srv-other-user' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ success: false, error: 'MCP server not found' });
    expect(JSON.stringify(body)).not.toContain(noRowsError.message);
    expect(mocks.disconnectMcpServer).not.toHaveBeenCalled();
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
    const { supabase, builder } = makeSupabase({ data: { id: 'srv-1' }, error: null });
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
    expect(builder.select).toHaveBeenCalledWith('id');
    expect(mocks.disconnectMcpServer).toHaveBeenCalledWith('srv-1');
  });

  it('returns 404 without raw DB details when delete finds no owned row', async () => {
    const { supabase, builder } = makeSupabase({ data: null, error: noRowsError });
    mocks.createClient.mockReturnValue(supabase);

    const response = await DELETE(request('/api/mcp/servers/srv-other-user', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'srv-other-user' }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ success: false, error: 'MCP server not found' });
    expect(JSON.stringify(body)).not.toContain(noRowsError.message);
    expect(builder.delete).toHaveBeenCalled();
    expect(mocks.disconnectMcpServer).not.toHaveBeenCalled();
  });
});
