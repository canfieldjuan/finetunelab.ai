import { describe, expect, it, vi } from 'vitest';
import {
  mcpToolName,
  mcpToolToDbRow,
  mcpToolToDefinition,
  normalizeInputSchema,
  normalizeMcpResult,
} from '../adapter';
import type { McpClientManager } from '../client';
import type { McpServerConfig } from '../types';

const server: McpServerConfig = {
  id: 'srv-1',
  name: 'my server',
  transport: 'http',
  url: 'https://example.com/mcp',
  enabled: true,
};

describe('mcpToolName', () => {
  it('namespaces as mcp__<server>__<tool> and sanitizes unsafe chars', () => {
    expect(mcpToolName('github', 'create_issue')).toBe('mcp__github__create_issue');
    expect(mcpToolName('my server', 'do/thing')).toBe('mcp__my_server__do_thing');
  });

  it('drops dots (not allowed in OpenAI function names)', () => {
    const name = mcpToolName('srv', 'tools.list');
    expect(name).toBe('mcp__srv__tools_list');
    expect(name).not.toContain('.');
  });

  it('clamps the composed name to 64 provider-safe chars', () => {
    const name = mcpToolName('a'.repeat(60), 'b'.repeat(60));
    expect(name.length).toBe(64);
    expect(name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
  });

  it('keeps distinct long names distinct via a hash suffix (no clamp collision)', () => {
    // A long server name would otherwise truncate away the tool suffix and collide.
    const a = mcpToolName('s'.repeat(60), 'toolA');
    const b = mcpToolName('s'.repeat(60), 'toolB');
    const c = mcpToolName('s'.repeat(60), 'a-very-long-distinct-tool-name-here');
    expect(new Set([a, b, c]).size).toBe(3);
    for (const n of [a, b, c]) {
      expect(n.length).toBeLessThanOrEqual(64);
      expect(n).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    }
  });
});

describe('normalizeInputSchema', () => {
  it('maps properties (type, description, enum) and required', () => {
    const params = normalizeInputSchema({
      type: 'object',
      properties: {
        path: { type: 'string', description: 'A path' },
        mode: { type: 'string', enum: ['r', 'w'] },
        depth: { type: 'number' },
      },
      required: ['path'],
    });

    expect(params.type).toBe('object');
    expect(params.required).toEqual(['path']);
    expect(params.properties.path).toEqual({ type: 'string', description: 'A path' });
    expect(params.properties.mode).toEqual({ type: 'string', description: '', enum: ['r', 'w'] });
    expect(params.properties.depth).toEqual({ type: 'number', description: '' });
  });

  it('returns an empty object schema for missing/invalid input', () => {
    expect(normalizeInputSchema(undefined)).toEqual({ type: 'object', properties: {}, required: [] });
    expect(normalizeInputSchema('nope')).toEqual({ type: 'object', properties: {}, required: [] });
    expect(normalizeInputSchema({})).toEqual({ type: 'object', properties: {}, required: [] });
  });

  it('drops non-string entries from required', () => {
    const params = normalizeInputSchema({ properties: {}, required: ['ok', 5, null] });
    expect(params.required).toEqual(['ok']);
  });

  it('maps JSON Schema integer to number (validator checks typeof)', () => {
    const params = normalizeInputSchema({
      properties: { count: { type: 'integer' }, mixed: { type: ['integer', 'null'] } },
    });
    expect(params.properties.count.type).toBe('number');
    expect(params.properties.mixed.type).toEqual(['number', 'null']);
  });

  it('preserves enum values in their original JSON types', () => {
    const params = normalizeInputSchema({
      properties: {
        n: { type: 'number', enum: [1, 2] },
        b: { type: 'boolean', enum: [true, false] },
      },
    });
    expect(params.properties.n.enum).toEqual([1, 2]);
    expect(params.properties.b.enum).toEqual([true, false]);
  });
});

describe('normalizeMcpResult', () => {
  it('flattens text content blocks', () => {
    const value = normalizeMcpResult({
      content: [
        { type: 'text', text: 'line one' },
        { type: 'image', data: 'xxx' },
        { type: 'text', text: 'line two' },
      ],
      isError: false,
    });
    expect(value).toBe('line one\nline two');
  });

  it('returns raw blocks when there is no text content', () => {
    const blocks = [{ type: 'image', data: 'xxx' }];
    expect(normalizeMcpResult({ content: blocks, isError: false })).toEqual(blocks);
  });

  it('throws on isError, using the text content as the message', () => {
    expect(() =>
      normalizeMcpResult({ content: [{ type: 'text', text: 'boom' }], isError: true }),
    ).toThrow('boom');
  });

  it('throws a generic message on isError with no text', () => {
    expect(() => normalizeMcpResult({ content: [], isError: true })).toThrow('MCP tool call failed');
  });

  it('returns structuredContent when there is no text content', () => {
    const structured = { answer: 42 };
    expect(normalizeMcpResult({ content: [], structuredContent: structured, isError: false })).toEqual(
      structured,
    );
  });

  it('prefers text over structuredContent when both are present', () => {
    expect(
      normalizeMcpResult({
        content: [{ type: 'text', text: 'hello' }],
        structuredContent: { answer: 42 },
        isError: false,
      }),
    ).toBe('hello');
  });
});

describe('mcpToolToDefinition', () => {
  const mcpTool = {
    name: 'create_issue',
    description: 'Create an issue',
    inputSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
  };

  it('produces a neutral ToolDefinition with namespaced name and normalized params', () => {
    const manager = {} as McpClientManager;
    const def = mcpToolToDefinition(server, mcpTool, manager);

    expect(def.name).toBe('mcp__my_server__create_issue');
    expect(def.description).toBe('Create an issue');
    expect(def.config.enabled).toBe(true);
    expect(def.parameters.required).toEqual(['title']);
    expect(def.parameters.properties.title).toEqual({ type: 'string', description: '' });
  });

  it('execute() proxies to manager.callTool and normalizes the result', async () => {
    const callTool = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'created #1' }],
      isError: false,
    });
    const manager = { callTool } as unknown as McpClientManager;

    const def = mcpToolToDefinition(server, mcpTool, manager);
    const out = await def.execute({ title: 'Bug' });

    // Dispatch is by server id, not name.
    expect(callTool).toHaveBeenCalledWith('srv-1', 'create_issue', { title: 'Bug' });
    expect(out).toBe('created #1');
  });

  it('falls back to a generated description when none is provided', () => {
    const def = mcpToolToDefinition(server, { name: 'ping' }, {} as McpClientManager);
    expect(def.description).toContain('MCP tool "ping"');
  });
});

describe('mcpToolToDbRow', () => {
  it('produces a tools-table row (is_builtin false, enabled from server)', () => {
    const row = mcpToolToDbRow({ ...server, enabled: false }, {
      name: 'list_repos',
      description: 'List repos',
      inputSchema: { properties: {} },
    });
    expect(row).toEqual({
      name: 'mcp__my_server__list_repos',
      description: 'List repos',
      parameters: { type: 'object', properties: {}, required: [] },
      is_builtin: false,
      is_enabled: false,
    });
  });
});
