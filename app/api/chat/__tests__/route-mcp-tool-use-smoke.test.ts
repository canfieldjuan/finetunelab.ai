import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import type { ToolDefinition } from '@/lib/llm/openai';

const unifiedChat = vi.hoisted(() => vi.fn());
const getModelConfig = vi.hoisted(() => vi.fn());
const executePortalChatTool = vi.hoisted(() => vi.fn());
const buildUserMcpToolset = vi.hoisted(() => vi.fn());
const getSharedMcpClientManager = vi.hoisted(() => vi.fn(() => ({ kind: 'shared-mcp-manager' })));
const mcpExecute = vi.hoisted(() => vi.fn());
const mcpToolset = vi.hoisted(() => ({
  definitions: vi.fn(() => [
    {
      name: 'mcp__docs__lookup',
      description: 'Look up user docs through MCP.',
      version: '1.0.0',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
      config: { enabled: true },
      execute: mcpExecute,
    },
  ]),
  toolNames: vi.fn(() => ['mcp__docs__lookup']),
  has: vi.fn((name: string) => name === 'mcp__docs__lookup'),
  execute: mcpExecute,
}));

const createClientMock = vi.hoisted(() => vi.fn());
const startTrace = vi.hoisted(() => vi.fn());
const createChildSpan = vi.hoisted(() => vi.fn());
const endTrace = vi.hoisted(() => vi.fn());
const completeTraceWithFullData = vi.hoisted(() => vi.fn());
const completeTraceBasic = vi.hoisted(() => vi.fn());

vi.mock('@/lib/llm/unified-client', () => ({
  unifiedLLMClient: {
    chat: unifiedChat,
  },
}));

vi.mock('@/lib/models/model-manager.service', () => ({
  modelManager: {
    getModelConfig,
  },
}));

vi.mock('@/lib/tools/toolManager', () => ({
  executePortalChatTool,
}));

vi.mock('@/lib/tools/mcp/user-toolset', () => ({
  buildUserMcpToolset,
}));

vi.mock('@/lib/tools/mcp/client', () => ({
  getSharedMcpClientManager,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: makeSupabaseClient(),
}));

vi.mock('@/lib/llm/openai', () => ({
  streamOpenAIResponse: vi.fn(),
  runOpenAIWithToolCalls: vi.fn(),
}));

vi.mock('@/lib/llm/anthropic', () => ({
  streamAnthropicResponse: vi.fn(),
  runAnthropicWithToolCalls: vi.fn(),
}));

vi.mock('@/lib/config/llmConfig', () => ({
  loadLLMConfig: () => ({
    provider: 'openai',
    openai: {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 2000,
    },
  }),
}));

vi.mock('@/lib/context', () => ({
  estimateGraphRAGTokens: vi.fn(() => 0),
}));

vi.mock('@/lib/context/context-provider.service', () => ({
  gatherConversationContext: vi.fn(),
}));

vi.mock('@/lib/graphrag', () => ({
  graphragConfig: {
    search: {
      threshold: 0.5,
    },
  },
  graphragService: {
    enhancePrompt: vi.fn(),
    formatCitations: vi.fn(() => []),
  },
}));

vi.mock('@/lib/auth/api-key-validator', () => ({
  validateApiKey: vi.fn(),
}));

vi.mock('@/lib/session-tagging/generator', () => ({
  generateSessionTag: vi.fn(async () => null),
}));

vi.mock('@/lib/tracing/trace.service', () => ({
  traceService: {
    startTrace,
    createChildSpan,
    endTrace,
    captureError: vi.fn(),
  },
  startTrace,
  createChildSpan,
  endTrace,
}));

vi.mock('../trace-completion-helper', () => ({
  completeTraceWithFullData,
  completeTraceBasic,
}));

vi.mock('@/lib/batch-testing/error-categorizer', () => ({
  categorizeError: vi.fn(() => ({ category: 'test' })),
}));

vi.mock('@/lib/tracing/error-categorizer', () => ({
  categorizeError: vi.fn(() => ({ category: 'test' })),
}));

vi.mock('@/lib/batch-testing/evaluation-integration', () => ({
  saveBasicJudgment: vi.fn(() => Promise.resolve()),
  calculateBasicQualityScore: vi.fn(() => 1),
}));

vi.mock('@/lib/evaluation/llm-judge-integration', () => ({
  evaluateWithLLMJudge: vi.fn(() => Promise.resolve()),
  shouldEvaluateMessage: vi.fn(() => false),
}));

function makeRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return {
    headers: new Headers({
      'content-type': 'application/json',
      ...(headers ?? {}),
    }),
    json: async () => body,
  } as unknown as NextRequest;
}

function makeSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
      })),
      admin: {
        getUserById: vi.fn(async () => ({
          data: { user: { id: 'user-1' } },
          error: null,
        })),
      },
    },
    from: vi.fn((table: string) => makeTableQuery(table)),
  };
}

function makeTableQuery(table: string) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    update: vi.fn(() => query),
    maybeSingle: vi.fn(async () => {
      if (table === 'conversations') {
        return { data: { id: 'conv-1', session_id: 'session-1' }, error: null };
      }
      return { data: null, error: null };
    }),
    single: vi.fn(async () => {
      if (table === 'conversations') {
        return {
          data: {
            id: 'conv-1',
            llm_model_id: 'model-vllm-qwen',
            session_id: 'session-1',
          },
          error: null,
        };
      }
      if (table === 'messages') {
        return { data: { id: 'msg-1' }, error: null };
      }
      return { data: null, error: null };
    }),
    insert: vi.fn(() => ({
      error: null,
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: table === 'messages' ? 'msg-1' : 'row-1' }, error: null })),
      })),
    })),
  };
  return query;
}

function parseSseEvents(text: string): Array<Record<string, unknown> | '[DONE]'> {
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((event) => event.replace(/^data: /, ''))
    .map((data) => (data === '[DONE]' ? data : JSON.parse(data)));
}

describe('POST /api/chat MCP tool use smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.CHAT_STREAMING_CHUNK_DELAY_MS = '0';

    createClientMock.mockImplementation(() => makeSupabaseClient());
    buildUserMcpToolset.mockResolvedValue(mcpToolset);
    mcpExecute.mockResolvedValue({ answer: 'MCP doc result' });
    getModelConfig.mockResolvedValue({
      id: 'model-vllm-qwen',
      name: 'Local Qwen',
      provider: 'vllm',
      model_id: 'qwen3',
      served_model_name: 'qwen3',
      context_length: 32768,
      max_output_tokens: 2000,
      default_temperature: 0.7,
      supports_functions: true,
      supports_streaming: true,
    });
    startTrace.mockResolvedValue({
      traceId: 'trace-1',
      spanId: 'span-1',
      userId: 'user-1',
      startTime: new Date(),
      spanName: 'llm.completion',
      operationType: 'llm_call',
    });
    createChildSpan.mockResolvedValue({
      traceId: 'trace-1',
      spanId: 'span-tool-1',
      parentSpanId: 'span-1',
      userId: 'user-1',
      startTime: new Date(),
      spanName: 'tool.mcp__docs__lookup',
      operationType: 'tool_call',
    });
    endTrace.mockResolvedValue(undefined);
    completeTraceWithFullData.mockResolvedValue(undefined);
    completeTraceBasic.mockResolvedValue(undefined);
  });

  it('offers authenticated-user MCP tools and dispatches MCP calls through the scoped toolset', async () => {
    unifiedChat.mockImplementationOnce(
      async (_modelId: string, _messages: unknown, options: { tools?: ToolDefinition[]; toolCallHandler?: (name: string, args: Record<string, unknown>) => Promise<unknown> }) => {
        expect(options.tools?.map((tool) => tool.function.name)).toContain('mcp__docs__lookup');

        const toolResult = await options.toolCallHandler?.('mcp__docs__lookup', {
          query: 'deflection audit',
        });

        expect(toolResult).toEqual({ answer: 'MCP doc result' });

        return {
          content: 'Found the MCP-backed document.',
          usage: { input_tokens: 10, output_tokens: 6 },
          toolsCalled: [{ name: 'mcp__docs__lookup', success: true }],
        };
      },
    );

    const { POST } = await import('../route');

    const response = await POST(makeRequest(
      {
        messages: [{ role: 'user', content: 'Look up the deflection audit docs.' }],
        modelId: 'model-vllm-qwen',
        widgetSessionId: 'widget-session-1',
        forceNonStreaming: true,
        contextInjectionEnabled: false,
      },
      { Authorization: 'Bearer session-token' },
    ));

    expect(response.status).toBe(200);
    const events = parseSseEvents(await response.text());

    expect(buildUserMcpToolset).toHaveBeenCalledWith(
      'user-1',
      expect.any(Object),
      { kind: 'shared-mcp-manager' },
    );
    expect(mcpExecute).toHaveBeenCalledWith('mcp__docs__lookup', { query: 'deflection audit' });
    expect(executePortalChatTool).not.toHaveBeenCalled();

    expect(events).toContainEqual(expect.objectContaining({
      type: 'tools_metadata',
      tools_called: [{ name: 'mcp__docs__lookup', success: true }],
    }));
    expect(events).toContainEqual(expect.objectContaining({
      content: 'Found the MCP-backed document.',
    }));
    expect(events).toContain('[DONE]');
  });

  it('does not offer MCP tools for an unauthenticated body-claimed user', async () => {
    unifiedChat.mockImplementationOnce(
      async (_modelId: string, _messages: unknown, options: { tools?: ToolDefinition[] }) => {
        expect(options.tools?.map((tool) => tool.function.name) ?? []).not.toContain('mcp__docs__lookup');

        return {
          content: 'No MCP tools were offered.',
          usage: { input_tokens: 8, output_tokens: 5 },
          toolsCalled: [],
        };
      },
    );

    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      messages: [{ role: 'user', content: 'Look up the deflection audit docs.' }],
      modelId: 'model-vllm-qwen',
      userId: 'user-1',
      forceNonStreaming: true,
      contextInjectionEnabled: false,
    }));

    expect(response.status).toBe(200);
    const events = parseSseEvents(await response.text());

    expect(buildUserMcpToolset).not.toHaveBeenCalled();
    expect(mcpExecute).not.toHaveBeenCalled();
    expect(executePortalChatTool).not.toHaveBeenCalled();
    expect(events).toContainEqual(expect.objectContaining({
      content: 'No MCP tools were offered.',
    }));
  });
});
