import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolDefinition } from '../types';

const registryMock = vi.hoisted(() => ({
  getToolByName: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => ({
  rows: [] as Array<{
    id: string;
    name: string;
    description: string;
    parameters: unknown;
    is_enabled: boolean;
    is_builtin: boolean;
  }>,
  executionRows: [] as unknown[],
}));

vi.mock('../registry', () => registryMock);

vi.mock('../../supabaseClient', () => ({
  supabase: {
    from(table: string) {
      if (table === 'tools') {
        return {
          select() {
            return this;
          },
          eq(column: string, value: unknown) {
            if (column === 'is_enabled') {
              const data = supabaseMock.rows.filter((row) => row.is_enabled === value);
              return {
                order: async () => ({ data, error: null }),
              };
            }
            if (column === 'name') {
              const row = supabaseMock.rows.find((item) => item.name === value);
              return {
                single: async () => ({
                  data: row ? { id: row.id, is_enabled: row.is_enabled } : null,
                  error: row ? null : { message: 'not found' },
                }),
              };
            }
            return this;
          },
        };
      }

      if (table === 'tool_executions') {
        return {
          insert: async (row: unknown) => {
            supabaseMock.executionRows.push(row);
            return { data: null, error: null };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  },
  supabaseAdmin: null,
}));

function tool(name: string, enabled = true): ToolDefinition {
  return {
    name,
    description: `${name} description`,
    version: '1.0.0',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Action to run',
        },
      },
      required: ['action'],
    },
    config: { enabled },
    execute: vi.fn(async () => ({ ok: true, name })),
  };
}

describe('toolManager registry boundaries', () => {
  beforeEach(() => {
    const tools = new Map([
      ['calculator', tool('calculator')],
      ['web_search', tool('web_search')],
      ['read_url', tool('read_url', false)],
      ['evaluation_metrics', tool('evaluation_metrics')],
    ]);
    registryMock.getToolByName.mockImplementation((name: string) => tools.get(name));
    supabaseMock.rows = [
      {
        id: 'tool-calculator',
        name: 'calculator',
        description: 'db calculator',
        parameters: {},
        is_enabled: true,
        is_builtin: true,
      },
      {
        id: 'tool-evaluation-metrics',
        name: 'evaluation_metrics',
        description: 'db evaluation metrics',
        parameters: {},
        is_enabled: true,
        is_builtin: true,
      },
      {
        id: 'tool-read-url',
        name: 'read_url',
        description: 'db read url',
        parameters: {},
        is_enabled: true,
        is_builtin: true,
      },
    ];
    supabaseMock.executionRows = [];
  });

  it('keeps shared enabled-tool listing broader than the portal listing', async () => {
    const { getEnabledPortalChatTools, getEnabledTools } = await import('../toolManager');

    await expect(getEnabledTools()).resolves.toMatchObject({
      data: [
        { name: 'calculator' },
        { name: 'evaluation_metrics' },
      ],
      error: null,
    });

    await expect(getEnabledPortalChatTools()).resolves.toMatchObject({
      data: [
        { name: 'calculator' },
      ],
      error: null,
    });
  });

  it('does not list DB-enabled tools that are disabled by registry config', async () => {
    const { getEnabledPortalChatTools, getEnabledTools } = await import('../toolManager');

    await expect(getEnabledTools()).resolves.toMatchObject({
      data: [
        { name: 'calculator' },
        { name: 'evaluation_metrics' },
      ],
      error: null,
    });

    await expect(getEnabledPortalChatTools()).resolves.toMatchObject({
      data: [
        { name: 'calculator' },
      ],
      error: null,
    });
  });

  it('lets shared executeTool run non-portal registered tools for analytics callers', async () => {
    const { executeTool } = await import('../toolManager');

    const result = await executeTool('evaluation_metrics', { action: 'run' }, 'conversation-id');

    expect(result).toMatchObject({
      data: { ok: true, name: 'evaluation_metrics' },
      error: null,
    });
    expect(supabaseMock.executionRows).toHaveLength(1);
  });

  it('blocks non-portal registered tools only through the portal wrapper', async () => {
    const { executePortalChatTool } = await import('../toolManager');

    const result = await executePortalChatTool('evaluation_metrics', { action: 'run' }, 'conversation-id');

    expect(result).toMatchObject({
      data: null,
      error: 'Tool is not available in chat portal: evaluation_metrics',
      executionTimeMs: 0,
    });
    expect(supabaseMock.executionRows).toHaveLength(0);
  });

  it('blocks portal tool calls that were not offered in the current request', async () => {
    const { executePortalChatTool } = await import('../toolManager');

    const result = await executePortalChatTool(
      'calculator',
      { action: 'calculate' },
      'conversation-id',
      undefined,
      undefined,
      undefined,
      undefined,
      { allowedToolNames: new Set(['web_search']) }
    );

    expect(result).toMatchObject({
      data: null,
      error: 'Tool was not offered for this request: calculator',
      executionTimeMs: 0,
    });
    expect(supabaseMock.executionRows).toHaveLength(0);
  });

  it('executes portal tool calls that were offered in the current request', async () => {
    const { executePortalChatTool } = await import('../toolManager');

    const result = await executePortalChatTool(
      'calculator',
      { action: 'calculate' },
      'conversation-id',
      undefined,
      undefined,
      undefined,
      undefined,
      { allowedToolNames: ['calculator'] }
    );

    expect(result).toMatchObject({
      data: { ok: true, name: 'calculator' },
      error: null,
    });
    expect(supabaseMock.executionRows).toHaveLength(1);
  });

  it('records MCP tool executions without a global tool id', async () => {
    const { recordToolExecution } = await import('../toolManager');

    await recordToolExecution({
      conversationId: 'conversation-id',
      toolId: null,
      toolName: 'mcp__docs__lookup',
      toolSource: 'mcp',
      inputParams: { query: 'deflection audit' },
      outputResult: { answer: 'MCP doc result' },
      errorMessage: null,
      executionTimeMs: 12,
      metadata: { scoped: true },
    });

    expect(supabaseMock.executionRows).toEqual([
      {
        conversation_id: 'conversation-id',
        message_id: null,
        tool_id: null,
        tool_name: 'mcp__docs__lookup',
        tool_source: 'mcp',
        input_params: { query: 'deflection audit' },
        output_result: { answer: 'MCP doc result' },
        error_message: null,
        execution_time_ms: 12,
        metadata: { scoped: true },
      },
    ]);
  });

  it('checks database availability before portal parameter validation', async () => {
    supabaseMock.rows = [];
    const { executePortalChatTool } = await import('../toolManager');

    const result = await executePortalChatTool('calculator', {}, 'conversation-id');

    expect(result).toMatchObject({
      data: null,
      error: 'Tool not found in database: calculator',
      executionTimeMs: 0,
    });
  });
});
