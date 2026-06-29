import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { McpClientManager } from '../client';
import { McpUserToolset, buildUserMcpToolset } from '../user-toolset';
import type { McpServerConfig } from '../types';

// Mock the config service so buildUserMcpToolset doesn't hit the DB.
const svc = vi.hoisted(() => ({ listEnabledServers: vi.fn() }));
vi.mock('../server-config.service', () => ({
  McpServerConfigService: class {
    listEnabledServers = svc.listEnabledServers;
  },
}));

const httpServer: McpServerConfig = {
  id: 'srv-http',
  name: 'github',
  transport: 'http',
  url: 'https://api.example.com/mcp',
  enabled: true,
};
const stdioServer: McpServerConfig = {
  id: 'host-stdio:fs',
  name: 'fs',
  transport: 'stdio',
  command: 'npx',
  enabled: true,
};

function fakeManager(overrides: Partial<Record<'connect' | 'listTools' | 'callTool', ReturnType<typeof vi.fn>>> = {}) {
  return {
    connect: overrides.connect ?? vi.fn().mockResolvedValue(undefined),
    listTools: overrides.listTools ?? vi.fn(async (id: string) => [
      { name: 'do_thing', description: `from ${id}`, inputSchema: { type: 'object', properties: {} } },
    ]),
    callTool: overrides.callTool ?? vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }], isError: false }),
  } as unknown as McpClientManager;
}

describe('McpUserToolset', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads tools from each server and exposes namespaced definitions', async () => {
    const manager = fakeManager();
    const toolset = new McpUserToolset(manager);
    await toolset.load([httpServer, stdioServer]);

    expect(toolset.toolNames().sort()).toEqual(['mcp__fs__do_thing', 'mcp__github__do_thing']);
    expect(manager.connect).toHaveBeenCalledTimes(2);
    expect(manager.listTools).toHaveBeenCalledWith('srv-http');
    expect(manager.listTools).toHaveBeenCalledWith('host-stdio:fs');
    expect(toolset.definitions().every((d) => d.name.startsWith('mcp__'))).toBe(true);
  });

  it('execute() dispatches the scoped tool by server id', async () => {
    const callTool = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'done' }], isError: false });
    const manager = fakeManager({ callTool });
    const toolset = new McpUserToolset(manager);
    await toolset.load([httpServer]);

    const out = await toolset.execute('mcp__github__do_thing', { a: 1 });
    expect(callTool).toHaveBeenCalledWith('srv-http', 'do_thing', { a: 1 });
    expect(out).toBe('done');
  });

  it('execute() rejects a tool not in this user\'s toolset (no cross-user dispatch)', async () => {
    const toolset = new McpUserToolset(fakeManager());
    await toolset.load([httpServer]);
    await expect(toolset.execute('mcp__other__tool', {})).rejects.toThrow(/not in this user's MCP toolset/);
  });

  it('skips a server that fails to connect/list and keeps the others', async () => {
    const listTools = vi.fn(async (id: string) => {
      if (id === 'srv-http') throw new Error('unreachable');
      return [{ name: 'ok', description: '', inputSchema: { type: 'object', properties: {} } }];
    });
    const toolset = new McpUserToolset(fakeManager({ listTools }));
    await toolset.load([httpServer, stdioServer]);

    expect(toolset.toolNames()).toEqual(['mcp__fs__ok']);
  });
});

describe('buildUserMcpToolset', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves the user\'s enabled servers and loads their tools', async () => {
    svc.listEnabledServers.mockResolvedValue([httpServer]);
    const manager = fakeManager();

    const toolset = await buildUserMcpToolset('user-1', {} as SupabaseClient, manager);
    expect(svc.listEnabledServers).toHaveBeenCalledWith('user-1');
    expect(toolset.toolNames()).toEqual(['mcp__github__do_thing']);
  });
});
