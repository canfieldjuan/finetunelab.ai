import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { McpServerConfigService } from '../server-config.service';

// Encryption -> visible, reversible markers so tests can assert it's applied.
vi.mock('@/lib/models/encryption', () => ({
  encrypt: (s: string) => `ENC(${s})`,
  decrypt: (s: string) => s.replace(/^ENC\(|\)$/g, ''),
}));

// Host stdio source -> one fixed server, so we can assert listEnabledServers merges it.
const hostMock = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../host-config', () => ({ loadHostStdioServers: hostMock.load }));

interface QueryResult {
  data: unknown;
  error: unknown;
}

// Chainable Supabase query mock that is both awaitable (for .eq() chains) and
// supports a terminal .single() (for insert/update).
function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.delete = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.single = vi.fn(async () => result);
  builder.then = (resolve: (v: QueryResult) => unknown) => resolve(result);
  return builder;
}

function makeSupabase(result: QueryResult) {
  const builder = makeBuilder(result);
  const from = vi.fn(() => builder);
  return { supabase: { from } as unknown as SupabaseClient, from, builder };
}

const httpRow = {
  id: 'srv-1',
  user_id: 'u1',
  name: 'github',
  transport: 'http',
  url: 'https://api.example.com/mcp',
  auth_token_encrypted: 'ENC(tok)',
  enabled: true,
};

describe('McpServerConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostMock.load.mockReturnValue([]);
  });

  it('createHttpServer hardcodes transport=http and encrypts the auth token', async () => {
    const { supabase, builder } = makeSupabase({ data: httpRow, error: null });
    const service = new McpServerConfigService(supabase);

    const config = await service.createHttpServer('u1', {
      name: 'github',
      url: 'https://api.example.com/mcp',
      authToken: 'tok',
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        transport: 'http',
        url: 'https://api.example.com/mcp',
        auth_token_encrypted: 'ENC(tok)',
        enabled: true,
      }),
    );
    // Returned shape is the token-redacted summary (never the decrypted token).
    expect(config).toEqual({
      id: 'srv-1',
      name: 'github',
      transport: 'http',
      url: 'https://api.example.com/mcp',
      enabled: true,
      hasAuthToken: true,
    });
    expect(config).not.toHaveProperty('authToken');
  });

  it('createHttpServer rejects invalid (collision-prone) names before the DB', async () => {
    const { supabase, builder } = makeSupabase({ data: null, error: null });
    const service = new McpServerConfigService(supabase);

    for (const name of ['my server', '!!!', '', 'a'.repeat(101)]) {
      await expect(
        service.createHttpServer('u1', { name, url: 'https://api.example.com/mcp' }),
      ).rejects.toThrow(/Server name must be/);
    }
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it('createHttpServer rejects internal/private urls before touching the DB', async () => {
    const { supabase, builder } = makeSupabase({ data: null, error: null });
    const service = new McpServerConfigService(supabase);

    await expect(
      service.createHttpServer('u1', { name: 'evil', url: 'http://169.254.169.254/' }),
    ).rejects.toThrow(/not allowed/);
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it('listEnabledServers merges enabled DB http servers with host stdio servers', async () => {
    hostMock.load.mockReturnValue([
      { id: 'host-stdio:fs', name: 'fs', transport: 'stdio', command: 'npx', enabled: true },
    ]);
    const { supabase } = makeSupabase({ data: [httpRow], error: null });
    const service = new McpServerConfigService(supabase);

    const servers = await service.listEnabledServers('u1');
    expect(servers.map((s) => [s.name, s.transport])).toEqual([
      ['github', 'http'],
      ['fs', 'stdio'],
    ]);
    // http auth token is decrypted for the client manager.
    expect(servers[0].authToken).toBe('tok');
  });

  it('listEnabledServers excludes disabled host stdio servers', async () => {
    hostMock.load.mockReturnValue([
      { id: 'host-stdio:fs', name: 'fs', transport: 'stdio', command: 'npx', enabled: false },
    ]);
    const { supabase } = makeSupabase({ data: [], error: null });
    const service = new McpServerConfigService(supabase);

    expect(await service.listEnabledServers('u1')).toEqual([]);
  });

  it('throws when the DB returns an error', async () => {
    const { supabase } = makeSupabase({ data: null, error: { message: 'boom' } });
    const service = new McpServerConfigService(supabase);
    await expect(service.listUserServers('u1')).rejects.toThrow('boom');
  });
});
