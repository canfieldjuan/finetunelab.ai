import { describe, expect, it } from 'vitest';
import { loadHostStdioServers } from '../host-config';

describe('loadHostStdioServers', () => {
  it('returns [] for empty/undefined config', () => {
    expect(loadHostStdioServers(undefined)).toEqual([]);
    expect(loadHostStdioServers('')).toEqual([]);
    expect(loadHostStdioServers('   ')).toEqual([]);
  });

  it('parses valid stdio entries into stdio McpServerConfigs', () => {
    const servers = loadHostStdioServers(
      JSON.stringify([
        { name: 'fs', command: 'npx', args: ['-y', 'mcp-fs'], env: { ROOT: '/data' } },
      ]),
    );
    expect(servers).toEqual([
      {
        id: 'host-stdio:fs',
        name: 'fs',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'mcp-fs'],
        env: { ROOT: '/data' },
        enabled: true,
      },
    ]);
  });

  it('defaults enabled to true and honors enabled:false', () => {
    const servers = loadHostStdioServers(
      JSON.stringify([
        { name: 'a', command: 'a' },
        { name: 'b', command: 'b', enabled: false },
      ]),
    );
    expect(servers.map((s) => [s.name, s.enabled])).toEqual([
      ['a', true],
      ['b', false],
    ]);
  });

  it('skips entries missing name or command', () => {
    const servers = loadHostStdioServers(
      JSON.stringify([{ name: 'ok', command: 'run' }, { name: 'no-cmd' }, { command: 'no-name' }]),
    );
    expect(servers.map((s) => s.name)).toEqual(['ok']);
  });

  it('drops non-string args and non-string env values', () => {
    const servers = loadHostStdioServers(
      JSON.stringify([{ name: 'x', command: 'c', args: ['a', 1, null], env: { A: 'a', B: 2 } }]),
    );
    expect(servers[0].args).toEqual(['a']);
    expect(servers[0].env).toEqual({ A: 'a' });
  });

  it('ignores invalid JSON and non-array config', () => {
    expect(loadHostStdioServers('{not json')).toEqual([]);
    expect(loadHostStdioServers('{"name":"x"}')).toEqual([]);
  });
});
