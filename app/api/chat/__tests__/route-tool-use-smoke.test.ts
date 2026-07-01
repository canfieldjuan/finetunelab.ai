import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import type { ModelConfig } from '@/lib/models/llm-model.types';

const unifiedChat = vi.hoisted(() => vi.fn());
const unifiedStream = vi.hoisted(() => vi.fn());
const getModelConfig = vi.hoisted(() => vi.fn());
const executePortalChatTool = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
const traceServiceMocks = vi.hoisted(() => ({
  startTrace: vi.fn(async () => ({ traceId: 'trace-1', spanId: 'span-1' })),
  createChildSpan: vi.fn(async () => ({ traceId: 'trace-1', spanId: 'tool-span-1' })),
  endTrace: vi.fn(async () => undefined),
  captureError: vi.fn(async () => undefined),
}));
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const vllmModelConfig: ModelConfig = {
  id: 'model-vllm-qwen',
  name: 'Local Qwen',
  provider: 'vllm',
  base_url: 'http://localhost:8000/v1',
  model_id: 'qwen3',
  served_model_name: 'qwen3',
  auth_type: 'none',
  auth_headers: {},
  supports_streaming: true,
  supports_functions: true,
  supports_vision: false,
  context_length: 32768,
  max_output_tokens: 1024,
  default_temperature: 0,
  default_top_p: 1,
  metadata: {
    vllm_runtime: {
      parse_qwen_xml_tool_calls: true,
    },
  },
};

function makeRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return {
    headers: new Headers({ 'content-type': 'application/json', ...(headers ?? {}) }),
    json: async () => body,
  } as unknown as NextRequest;
}

function parseSseEvents(text: string): unknown[] {
  return text
    .split('\n\n')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => chunk.slice('data: '.length))
    .filter((payload) => payload !== '[DONE]')
    .map((payload) => JSON.parse(payload));
}

function makeAuthenticatedSessionClient(userId = 'user-1') {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: userId } },
        error: null,
      })),
    },
  };
}

function makeChatAdminClient(options?: {
  attachments?: unknown[];
  attachmentLoadError?: { message: string } | null;
  attachmentUpdateError?: { message: string } | null;
  finalizeUpdateError?: { message: string } | null;
  claimUpdatedIds?: string[];
  imageDownloadBody?: BlobPart;
  imageDownloadError?: { message: string } | null;
}) {
  type QueryFilter = { column: string; value: unknown };
  const attachmentRows = (options?.attachments ?? []).map((row) => ({
    ...(row as Record<string, unknown>),
  }));
  const matchesFilters = (row: Record<string, unknown>, filters: QueryFilter[]) =>
    filters.every((filter) => row[filter.column] === filter.value);

  const attachmentSelectFilters: QueryFilter[] = [];
  const attachmentSelectQuery = {
    eq: vi.fn((column: string, value: unknown) => {
      attachmentSelectFilters.push({ column, value });
      return attachmentSelectQuery;
    }),
    in: vi.fn(async (column: string, values: unknown[]) => ({
      data: attachmentRows.filter(
        (row) => values.includes(row[column]) && matchesFilters(row, attachmentSelectFilters),
      ),
      error: options?.attachmentLoadError ?? null,
    })),
  };
  const attachmentUpdateFilters: QueryFilter[] = [];
  let attachmentUpdatePayload: Record<string, unknown> = {};
  let attachmentUpdatedIds: string[] = [];
  const attachmentUpdateQuery = {
    eq: vi.fn((column: string, value: unknown) => {
      attachmentUpdateFilters.push({ column, value });
      return attachmentUpdateQuery;
    }),
    in: vi.fn((column: string, values: unknown[]) => {
      attachmentUpdatedIds = [];
      const updateError = attachmentUpdatePayload.status === 'attached'
        ? options?.finalizeUpdateError ?? options?.attachmentUpdateError ?? null
        : options?.attachmentUpdateError ?? null;
      if (!updateError) {
        const forcedClaimIds = attachmentUpdatePayload.status === 'attaching'
          ? options?.claimUpdatedIds
          : undefined;
        for (const row of attachmentRows) {
          const forcedClaimMatch = forcedClaimIds === undefined || forcedClaimIds.includes(String(row.id));
          if (values.includes(row[column]) && forcedClaimMatch && matchesFilters(row, attachmentUpdateFilters)) {
            Object.assign(row, attachmentUpdatePayload);
            attachmentUpdatedIds.push(String(row.id));
          }
        }
      }
      return attachmentUpdateQuery;
    }),
    select: vi.fn(async () => ({
      data: attachmentUpdatedIds.map((id) => ({ id })),
      error: attachmentUpdatePayload.status === 'attached'
        ? options?.finalizeUpdateError ?? options?.attachmentUpdateError ?? null
        : options?.attachmentUpdateError ?? null,
    })),
    then: undefined,
  };
  const releaseUpdateQuery = {
    eq: vi.fn((column: string, value: unknown) => {
      attachmentUpdateFilters.push({ column, value });
      return releaseUpdateQuery;
    }),
    in: vi.fn(async (column: string, values: unknown[]) => {
      if (!options?.attachmentUpdateError) {
        for (const row of attachmentRows) {
          if (values.includes(row[column]) && matchesFilters(row, attachmentUpdateFilters)) {
            Object.assign(row, attachmentUpdatePayload);
          }
        }
      }
      return {
        error: options?.attachmentUpdateError ?? null,
      };
    }),
  };
  const chatAttachmentsTable = {
    select: vi.fn(() => attachmentSelectQuery),
    update: vi.fn((payload: Record<string, unknown>) => {
      attachmentUpdateFilters.length = 0;
      attachmentUpdatePayload = payload;
      return payload.status === 'uploaded' ? releaseUpdateQuery : attachmentUpdateQuery;
    }),
  };

  const conversationsQuery = {
    select: vi.fn(() => conversationsQuery),
    eq: vi.fn(() => conversationsQuery),
    single: vi.fn(async () => ({
      data: { llm_model_id: null, session_id: 'session-1' },
      error: null,
    })),
  };

  const from = vi.fn((table: string) => {
    if (table === 'chat_attachments') return chatAttachmentsTable;
    if (table === 'conversations') return conversationsQuery;
    return {
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })),
      insert: vi.fn(),
      update: vi.fn(),
    };
  });
  const download = vi.fn(async () => ({
    data: options?.imageDownloadBody === undefined
      ? new Blob([PNG_BYTES], { type: 'image/png' })
      : new Blob([options.imageDownloadBody], { type: 'image/png' }),
    error: options?.imageDownloadError ?? null,
  }));
  const storageFrom = vi.fn(() => ({ download }));

  return {
    client: {
      from,
      storage: {
        from: storageFrom,
      },
      auth: {
        admin: {
          getUserById: vi.fn(),
        },
      },
    },
    from,
    chatAttachmentsTable,
    attachmentSelectQuery,
    attachmentUpdateQuery,
    releaseUpdateQuery,
    attachmentRows,
    storageFrom,
    download,
  };
}

vi.mock('@/lib/llm/unified-client', () => ({
  unifiedLLMClient: {
    chat: unifiedChat,
    stream: unifiedStream,
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

vi.mock('@supabase/supabase-js', () => ({
  createClient,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/llm/openai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/llm/openai')>()),
  streamOpenAIResponse: vi.fn(),
  runOpenAIWithToolCalls: vi.fn(),
}));

vi.mock('@/lib/llm/anthropic', () => ({
  streamAnthropicResponse: vi.fn(),
  runAnthropicWithToolCalls: vi.fn(),
}));

vi.mock('@/lib/config/llmConfig', () => ({
  loadLLMConfig: vi.fn(() => ({
    provider: 'openai',
    openai: {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 2000,
    },
  })),
}));

vi.mock('@/lib/graphrag', () => ({
  graphragConfig: {
    search: {
      threshold: 0.7,
    },
  },
  graphragService: {
    enhancePrompt: vi.fn(),
    formatCitations: vi.fn(() => []),
  },
}));

vi.mock('@/lib/context', () => ({
  estimateGraphRAGTokens: vi.fn(() => 0),
}));

vi.mock('@/lib/context/context-provider.service', () => ({
  gatherConversationContext: vi.fn(),
}));

vi.mock('@/lib/auth/api-key-validator', () => ({
  validateApiKey: vi.fn(),
}));

vi.mock('@/lib/session-tagging/generator', () => ({
  generateSessionTag: vi.fn(async () => null),
}));

vi.mock('@/lib/tracing/trace.service', () => ({
  traceService: traceServiceMocks,
  startTrace: traceServiceMocks.startTrace,
  endTrace: traceServiceMocks.endTrace,
}));

vi.mock('@/lib/batch-testing/error-categorizer', () => ({
  categorizeError: vi.fn(() => ({ category: 'unknown' })),
}));

vi.mock('@/lib/tracing/error-categorizer', () => ({
  categorizeError: vi.fn(() => ({ category: 'unknown' })),
}));

vi.mock('@/lib/batch-testing/evaluation-integration', () => ({
  saveBasicJudgment: vi.fn(),
  calculateBasicQualityScore: vi.fn(() => 0),
}));

vi.mock('@/lib/evaluation/llm-judge-integration', () => ({
  evaluateWithLLMJudge: vi.fn(),
  shouldEvaluateMessage: vi.fn(() => false),
}));

describe('POST /api/chat tool-use smoke', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.CHAT_STREAMING_CHUNK_DELAY_MS = '0';

    createClient.mockReturnValue({
      from: vi.fn(),
      auth: {
        admin: {
          getUserById: vi.fn(),
        },
      },
    });
    getModelConfig.mockResolvedValue(vllmModelConfig);
    executePortalChatTool.mockResolvedValue({
      data: { result: 4 },
      error: null,
      executionTimeMs: 1,
    });
    unifiedChat.mockImplementation(async (_modelId, _messages, options) => {
      await options.toolCallHandler('calculator', { expression: '2+2' });
      return {
        content: 'The answer is 4.',
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
        toolsCalled: [{ name: 'calculator', success: true }],
      };
    });
    unifiedStream.mockImplementation(async function* () {
      yield 'The answer is 4.';
    });
  });

  it('routes registry-model tool requests through route-level tool execution and emits SSE metadata', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      generationSettings: {
        temperature: 0,
        maxOutputTokens: 256,
      },
      messages: [
        {
          role: 'user',
          content: 'Use the calculator tool for 2+2.',
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'calculator',
            description: 'Calculate arithmetic expressions.',
            parameters: {
              type: 'object',
              properties: {
                expression: { type: 'string' },
              },
              required: ['expression'],
            },
          },
        },
      ],
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');

    const streamText = await response.text();
    expect(streamText).toContain('data: [DONE]');
    expect(streamText).toContain('The answer is 4.');

    const events = parseSseEvents(streamText);
    expect(events).toContainEqual(expect.objectContaining({
      type: 'model_metadata',
      model_id: 'model-vllm-qwen',
      model_name: 'Local Qwen',
      provider: 'vllm',
    }));
    expect(events).toContainEqual(expect.objectContaining({
      type: 'token_usage',
      input_tokens: 10,
      output_tokens: 5,
    }));
    expect(events).toContainEqual(expect.objectContaining({
      type: 'tools_metadata',
      tools_called: [expect.objectContaining({ name: 'calculator', success: true })],
    }));

    expect(getModelConfig).toHaveBeenCalledWith(
      'model-vllm-qwen',
      undefined,
      expect.any(Object)
    );
    expect(unifiedChat).toHaveBeenCalledWith(
      'model-vllm-qwen',
      expect.any(Array),
      expect.objectContaining({
        tools: [expect.objectContaining({ function: expect.objectContaining({ name: 'calculator' }) })],
        toolCallHandler: expect.any(Function),
      })
    );
    expect(executePortalChatTool).toHaveBeenCalledTimes(1);
    expect(executePortalChatTool.mock.calls[0]?.slice(0, 2)).toEqual([
      'calculator',
      { expression: '2+2' },
    ]);
  });

  it('rejects malformed chat attachment ids before querying the attachment store', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Read this file.',
        },
      ],
      attachmentIds: ['not-a-uuid'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'attachmentIds must contain valid UUIDs' });
    expect(unifiedChat).not.toHaveBeenCalled();
  });

  it('rejects malformed chat attachment conversation ids before querying the attachment store', async () => {
    const admin = makeChatAdminClient();
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: 'not-a-uuid',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Read this file.',
        },
      ],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'conversationId must be a valid UUID' });
    expect(admin.chatAttachmentsTable.select).not.toHaveBeenCalled();
    expect(unifiedChat).not.toHaveBeenCalled();
  });

  it('removes generate_image from later tool rounds after one image job starts', async () => {
    createClient.mockReturnValueOnce({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1' } },
          error: null,
        })),
      },
    });
    createClient.mockReturnValueOnce({
      from: vi.fn(),
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { id: 'user-1' } },
            error: null,
          })),
        },
      },
    });
    executePortalChatTool.mockImplementation(async (toolName: string) => {
      if (toolName === 'generate_image') {
        return {
          data: { status: 'image_generation_started', jobId: 'img-job-1' },
          error: null,
          executionTimeMs: 1,
        };
      }

      return {
        data: { result: 4 },
        error: null,
        executionTimeMs: 1,
      };
    });
    let nextRoundToolNames: string[] = [];
    let attemptedSecondImageCall = false;
    unifiedChat.mockImplementationOnce(async (_modelId, _messages, options) => {
      await options.toolCallHandler('generate_image', { prompt: 'first image' });
      nextRoundToolNames = (options.tools ?? []).map((tool: { function: { name: string } }) => tool.function.name);

      if (nextRoundToolNames.includes('generate_image')) {
        attemptedSecondImageCall = true;
        await options.toolCallHandler('generate_image', { prompt: 'second image' });
      }

      await options.toolCallHandler('calculator', { expression: '2+2' });

      return {
        content: 'Image is generating.',
        usage: {
          input_tokens: 12,
          output_tokens: 6,
        },
        toolsCalled: [
          { name: 'generate_image', success: true },
          { name: 'calculator', success: true },
        ],
      };
    });

    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      messages: [
        {
          role: 'user',
          content: 'Generate two images.',
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'generate_image',
            description: 'Generate an image.',
            parameters: {
              type: 'object',
              properties: {
                prompt: { type: 'string' },
              },
              required: ['prompt'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'calculator',
            description: 'Calculate arithmetic expressions.',
            parameters: {
              type: 'object',
              properties: {
                expression: { type: 'string' },
              },
              required: ['expression'],
            },
          },
        },
      ],
    }, { Authorization: 'Bearer session-token' }));

    const streamText = await response.text();
    expect(response.status, streamText).toBe(200);
    const events = parseSseEvents(streamText);
    const imageEvents = events.filter(
      (event): event is { type: string; jobId: string; prompt: string; streamToken: string } =>
        typeof event === 'object' &&
        event !== null &&
        (event as { type?: unknown }).type === 'image_generation_started',
    );

    // The next model round cannot choose generate_image again, while other tools stay available.
    expect(nextRoundToolNames).toEqual(['calculator']);
    expect(attemptedSecondImageCall).toBe(false);

    const calculatorCall = executePortalChatTool.mock.calls.find((call) => call[0] === 'calculator');
    const allowedToolNames = calculatorCall?.[7]?.allowedToolNames as Set<string> | undefined;
    expect(allowedToolNames).toBeInstanceOf(Set);
    expect([...(allowedToolNames ?? [])]).toEqual(['calculator']);

    expect(imageEvents).toHaveLength(1);
    expect(imageEvents[0]).toEqual(
      expect.objectContaining({ jobId: 'img-job-1', prompt: 'first image', streamToken: expect.any(String) }),
    );
    const traceEndCalls = traceServiceMocks.endTrace.mock.calls as unknown as Array<[
      unknown,
      { inputData?: { toolDefinitions?: Array<{ name: string }> } },
    ]>;
    const completedTrace = traceEndCalls.find(
      (call) => call[1]?.inputData?.toolDefinitions,
    );
    expect(completedTrace?.[1]?.inputData?.toolDefinitions).toEqual([
      expect.objectContaining({ name: 'generate_image' }),
      expect.objectContaining({ name: 'calculator' }),
    ]);
    expect(executePortalChatTool).toHaveBeenCalledTimes(2);
    expect(executePortalChatTool.mock.calls.map((call) => call[0])).toEqual(['generate_image', 'calculator']);
  });

  it('keeps trace tool definitions aligned after unauthenticated generate_image pruning', async () => {
    let offeredToolNames: string[] = [];
    unifiedChat.mockImplementationOnce(async (_modelId, _messages, options) => {
      offeredToolNames = (options.tools ?? []).map((tool: { function: { name: string } }) => tool.function.name);
      await options.toolCallHandler('calculator', { expression: '2+2' });

      return {
        content: 'The answer is 4.',
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
        toolsCalled: [{ name: 'calculator', success: true }],
      };
    });

    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      messages: [
        {
          role: 'user',
          content: 'Use a tool.',
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'generate_image',
            description: 'Generate an image.',
            parameters: {
              type: 'object',
              properties: {
                prompt: { type: 'string' },
              },
              required: ['prompt'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'calculator',
            description: 'Calculate arithmetic expressions.',
            parameters: {
              type: 'object',
              properties: {
                expression: { type: 'string' },
              },
              required: ['expression'],
            },
          },
        },
      ],
    }));

    const streamText = await response.text();
    expect(response.status, streamText).toBe(200);
    expect(offeredToolNames).toEqual(['calculator']);

    const calculatorCall = executePortalChatTool.mock.calls.find((call) => call[0] === 'calculator');
    const allowedToolNames = calculatorCall?.[7]?.allowedToolNames as Set<string> | undefined;
    expect(allowedToolNames).toBeInstanceOf(Set);
    expect([...(allowedToolNames ?? [])]).toEqual(['calculator']);

    const traceEndCalls = traceServiceMocks.endTrace.mock.calls as unknown as Array<[
      unknown,
      { inputData?: { toolDefinitions?: Array<{ name: string }> } },
    ]>;
    const completedTrace = traceEndCalls.find(
      (call) => call[1]?.inputData?.toolDefinitions,
    );
    expect(completedTrace?.[1]?.inputData?.toolDefinitions).toEqual([
      expect.objectContaining({ name: 'calculator' }),
    ]);
    expect(executePortalChatTool.mock.calls.map((call) => call[0])).toEqual(['calculator']);
  });

  it('keeps standard web_search available after a deep-research job starts', async () => {
    executePortalChatTool.mockImplementation(async (toolName: string, args: Record<string, unknown>) => {
      if (toolName === 'web_search' && args.research === true) {
        return {
          data: { status: 'deep_research_started', jobId: 'research-job-1' },
          error: null,
          executionTimeMs: 1,
        };
      }
      if (toolName === 'web_search') {
        return {
          data: {
            status: 'completed',
            results: [
              {
                title: 'Training news',
                url: 'https://example.com/training',
                snippet: 'A current training update.',
              },
            ],
          },
          error: null,
          executionTimeMs: 1,
        };
      }

      return {
        data: { result: 4 },
        error: null,
        executionTimeMs: 1,
      };
    });

    let nextRoundToolNames: string[] = [];
    let attemptedSecondResearchCall = false;
    unifiedChat.mockImplementationOnce(async (_modelId, _messages, options) => {
      await options.toolCallHandler('web_search', { query: 'current training news', research: true });
      nextRoundToolNames = (options.tools ?? []).map((tool: { function: { name: string } }) => tool.function.name);

      if (nextRoundToolNames.includes('web_search')) {
        attemptedSecondResearchCall = true;
        await options.toolCallHandler('web_search', { query: 'current training news', research: true });
      }

      await options.toolCallHandler('calculator', { expression: '2+2' });

      return {
        content: 'Deep research has started.',
        usage: {
          input_tokens: 12,
          output_tokens: 6,
        },
        toolsCalled: [
          { name: 'web_search', success: true },
          { name: 'calculator', success: true },
        ],
      };
    });

    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      enableDeepResearch: true,
      forceNonStreaming: true,
      messages: [
        {
          role: 'user',
          content: 'Start deep research, then calculate 2+2.',
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web.',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                research: { type: 'boolean' },
              },
              required: ['query'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'calculator',
            description: 'Calculate arithmetic expressions.',
            parameters: {
              type: 'object',
              properties: {
                expression: { type: 'string' },
              },
              required: ['expression'],
            },
          },
        },
      ],
    }));

    const streamText = await response.text();
    expect(response.status, streamText).toBe(200);
    expect(nextRoundToolNames).toEqual(['web_search', 'calculator']);
    expect(attemptedSecondResearchCall).toBe(true);

    const webSearchCalls = executePortalChatTool.mock.calls.filter((call) => call[0] === 'web_search');
    expect(webSearchCalls).toHaveLength(2);
    expect(webSearchCalls[0]?.[1]).toEqual({ query: 'current training news', research: true });
    expect(webSearchCalls[1]?.[1]).toEqual({
      query: 'current training news',
      research: false,
      deepResearchConfirmed: false,
    });

    const secondSearchAllowedToolNames = webSearchCalls[1]?.[7]?.allowedToolNames as Set<string> | undefined;
    expect(secondSearchAllowedToolNames).toBeInstanceOf(Set);
    expect([...(secondSearchAllowedToolNames ?? [])]).toEqual(['web_search', 'calculator']);

    const calculatorCall = executePortalChatTool.mock.calls.find((call) => call[0] === 'calculator');
    const allowedToolNames = calculatorCall?.[7]?.allowedToolNames as Set<string> | undefined;
    expect(allowedToolNames).toBeInstanceOf(Set);
    expect([...(allowedToolNames ?? [])]).toEqual(['web_search', 'calculator']);
    expect(executePortalChatTool).toHaveBeenCalledTimes(3);
    expect(executePortalChatTool.mock.calls.map((call) => call[0])).toEqual(['web_search', 'web_search', 'calculator']);
  });

  it('injects verified chat attachment text into the model turn and marks it attached', async () => {
    const admin = makeChatAdminClient({
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: null,
          filename: 'notes.txt',
          content_type: 'text/plain',
          size_bytes: 28,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/notes.txt',
          kind: 'text',
          extracted_text: 'hello from the attached notes',
          extracted_chars: 29,
          status: 'uploaded',
          metadata: {},
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);

    let modelMessages: Array<{ role: string; content: string }> = [];
    unifiedChat.mockImplementationOnce(async (_modelId, messages) => {
      modelMessages = messages as Array<{ role: string; content: string }>;
      return {
        content: 'I read the attachment.',
        usage: {
          input_tokens: 20,
          output_tokens: 8,
        },
      };
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Summarize this file.',
        },
      ],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    const streamText = await response.text();
    expect(response.status, streamText).toBe(200);
    const events = parseSseEvents(streamText);
    expect(events).toContainEqual(expect.objectContaining({
      type: 'attachment_metadata',
      attachment_ids: ['11111111-1111-4111-8111-111111111111'],
      attachments: [
        expect.objectContaining({
          id: '11111111-1111-4111-8111-111111111111',
          filename: 'notes.txt',
          status: 'uploaded',
        }),
      ],
    }));
    expect(modelMessages.length).toBeGreaterThan(0);
    const latestUserMessage = modelMessages.filter((message) => message.role === 'user').at(-1);
    expect(latestUserMessage?.content).toContain('Summarize this file.');
    expect(latestUserMessage?.content).toContain('Attached files for this turn');
    expect(latestUserMessage?.content).toContain('hello from the attached notes');
    expect(latestUserMessage?.content).toContain('<attachment filename="notes.txt"');
    expect(admin.chatAttachmentsTable.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'attaching',
      updated_at: expect.any(String),
    }));
    expect(admin.chatAttachmentsTable.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'attached',
      updated_at: expect.any(String),
    }));
    expect(admin.attachmentRows[0].status).toBe('attached');
    expect(admin.attachmentSelectQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(admin.attachmentSelectQuery.eq).toHaveBeenCalledWith('conversation_id', '22222222-2222-4222-8222-222222222222');
    expect(admin.attachmentUpdateQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(admin.attachmentUpdateQuery.eq).toHaveBeenCalledWith('conversation_id', '22222222-2222-4222-8222-222222222222');
    expect(admin.attachmentUpdateQuery.eq).toHaveBeenCalledWith('status', 'uploaded');
    expect(admin.attachmentUpdateQuery.eq).toHaveBeenCalledWith('status', 'attaching');
    expect(admin.attachmentUpdateQuery.in).toHaveBeenCalledWith('id', ['11111111-1111-4111-8111-111111111111']);
  });

  it('ignores image payloads for non-vision models while still completing the turn', async () => {
    const admin = makeChatAdminClient({
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: null,
          filename: 'diagram.png',
          content_type: 'image/png',
          size_bytes: 4,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/diagram.png',
          kind: 'image',
          extracted_text: '',
          extracted_chars: 0,
          status: 'uploaded',
          metadata: { visionInput: true },
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);

    let modelMessages: Array<{ role: string; content: unknown }> = [];
    unifiedChat.mockImplementationOnce(async (_modelId, messages) => {
      modelMessages = messages as Array<{ role: string; content: unknown }>;
      return {
        content: 'I can answer without processing the image.',
        usage: {
          input_tokens: 12,
          output_tokens: 8,
        },
      };
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'What can you do with this prompt?',
        },
      ],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    const streamText = await response.text();
    expect(response.status, streamText).toBe(200);
    const latestUserMessage = modelMessages.filter((message) => message.role === 'user').at(-1);
    expect(latestUserMessage?.content).toBe('What can you do with this prompt?');
    expect(admin.download).not.toHaveBeenCalled();
    expect(admin.attachmentRows[0].status).toBe('attached');
  });

  it('adds image attachment data parts for vision-capable models', async () => {
    const admin = makeChatAdminClient({
      imageDownloadBody: PNG_BYTES,
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: null,
          filename: 'diagram.png',
          content_type: 'image/png',
          size_bytes: 4,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/diagram.png',
          kind: 'image',
          extracted_text: '',
          extracted_chars: 0,
          status: 'uploaded',
          metadata: { visionInput: true },
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);
    getModelConfig.mockResolvedValueOnce({
      ...vllmModelConfig,
      supports_vision: true,
    });

    let modelMessages: Array<{ role: string; content: unknown }> = [];
    unifiedChat.mockImplementationOnce(async (_modelId, messages) => {
      modelMessages = messages as Array<{ role: string; content: unknown }>;
      return {
        content: 'I can see the image.',
        usage: {
          input_tokens: 12,
          output_tokens: 8,
        },
      };
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Describe this image.',
        },
      ],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    const streamText = await response.text();
    expect(response.status, streamText).toBe(200);
    const latestUserMessage = modelMessages.filter((message) => message.role === 'user').at(-1);
    expect(latestUserMessage?.content).toEqual([
      { type: 'text', text: 'Describe this image.' },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${Buffer.from(PNG_BYTES).toString('base64')}`,
          detail: 'auto',
        },
      },
    ]);
    expect(admin.storageFrom).toHaveBeenCalledWith('chat-attachments');
    expect(admin.download).toHaveBeenCalledWith('user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/diagram.png');
    expect(admin.attachmentRows[0].status).toBe('attached');
  });

  it('rejects vision requests whose image token estimate exceeds the model context window', async () => {
    const admin = makeChatAdminClient({
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: null,
          filename: 'diagram.png',
          content_type: 'image/png',
          size_bytes: 1024 * 1024,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/diagram.png',
          kind: 'image',
          extracted_text: '',
          extracted_chars: 0,
          status: 'uploaded',
          metadata: { visionInput: true, imageMediaType: 'image/png' },
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);
    getModelConfig.mockResolvedValueOnce({
      ...vllmModelConfig,
      supports_vision: true,
      context_length: 900,
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [{ role: 'user', content: 'Describe this image.' }],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual(expect.objectContaining({
      error: 'Attachment context is too large for the selected model context window',
      details: expect.objectContaining({
        estimatedVisionTokens: 1024,
        imageBytes: 1024 * 1024,
        contextLength: 900,
      }),
    }));
    expect(admin.download).not.toHaveBeenCalled();
    expect(admin.attachmentRows[0].status).toBe('uploaded');
  });

  it('rejects vision requests above the per-turn image byte cap before download', async () => {
    const attachmentIds = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    ];
    const admin = makeChatAdminClient({
      attachments: attachmentIds.map((id, index) => ({
        id,
        user_id: 'user-1',
        conversation_id: '55555555-5555-4555-8555-555555555555',
        message_id: null,
        filename: `diagram-${index}.png`,
        content_type: 'image/png',
        size_bytes: 4 * 1024 * 1024,
        storage_bucket: 'chat-attachments',
        storage_path: `user-1/55555555-5555-4555-8555-555555555555/${id}/diagram-${index}.png`,
        kind: 'image',
        extracted_text: '',
        extracted_chars: 0,
        status: 'uploaded',
        metadata: { visionInput: true, imageMediaType: 'image/png' },
      })),
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);
    getModelConfig.mockResolvedValueOnce({
      ...vllmModelConfig,
      supports_vision: true,
      context_length: 32768,
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: '55555555-5555-4555-8555-555555555555',
      userId: 'user-1',
      messages: [{ role: 'user', content: 'Compare these images.' }],
      attachmentIds,
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual(expect.objectContaining({
      error: 'Image attachments exceed the 12 MB per-turn vision input limit',
      details: expect.objectContaining({
        imageCount: 4,
        imageBytes: 16 * 1024 * 1024,
      }),
    }));
    expect(admin.download).not.toHaveBeenCalled();
    expect(admin.attachmentRows.every((row) => row.status === 'uploaded')).toBe(true);
  });

  it('skips unavailable image bytes for vision models and still completes the text turn', async () => {
    const admin = makeChatAdminClient({
      imageDownloadError: { message: 'object temporarily unavailable' },
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: null,
          filename: 'diagram.png',
          content_type: 'image/png',
          size_bytes: 8,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/diagram.png',
          kind: 'image',
          extracted_text: '',
          extracted_chars: 0,
          status: 'uploaded',
          metadata: { visionInput: true, imageMediaType: 'image/png' },
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);
    getModelConfig.mockResolvedValueOnce({
      ...vllmModelConfig,
      supports_vision: true,
    });

    let modelMessages: Array<{ role: string; content: unknown }> = [];
    unifiedChat.mockImplementationOnce(async (_modelId, messages) => {
      modelMessages = messages as Array<{ role: string; content: unknown }>;
      return {
        content: 'I can answer from the text.',
        usage: { input_tokens: 10, output_tokens: 7 },
      };
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [{ role: 'user', content: 'Try this prompt even if the image is unavailable.' }],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    const streamText = await response.text();
    expect(response.status, streamText).toBe(200);
    expect(admin.download).toHaveBeenCalled();
    const latestUserMessage = modelMessages.filter((message) => message.role === 'user').at(-1);
    expect(latestUserMessage?.content).toBe('Try this prompt even if the image is unavailable.');
    expect(admin.attachmentRows[0].status).toBe('attached');
  });

  it('replays already-attached chat attachment context without claiming it again', async () => {
    const admin = makeChatAdminClient({
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: '33333333-3333-4333-8333-333333333333',
          filename: 'notes.txt',
          content_type: 'text/plain',
          size_bytes: 28,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/notes.txt',
          kind: 'text',
          extracted_text: 'historical attached note text',
          extracted_chars: 29,
          status: 'attached',
          metadata: {},
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);

    let modelMessages: Array<{ role: string; content: string }> = [];
    unifiedChat.mockImplementationOnce(async (_modelId, messages) => {
      modelMessages = messages as Array<{ role: string; content: string }>;
      return {
        content: 'Regenerated with the attachment.',
        usage: {
          input_tokens: 20,
          output_tokens: 8,
        },
      };
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Regenerate this file summary.',
        },
      ],
      replayAttachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    const streamText = await response.text();
    expect(response.status, streamText).toBe(200);
    const events = parseSseEvents(streamText);
    expect(events).toContainEqual(expect.objectContaining({
      type: 'attachment_metadata',
      attachment_ids: ['11111111-1111-4111-8111-111111111111'],
      attachments: [
        expect.objectContaining({
          id: '11111111-1111-4111-8111-111111111111',
          filename: 'notes.txt',
          status: 'attached',
        }),
      ],
    }));
    const latestUserMessage = modelMessages.filter((message) => message.role === 'user').at(-1);
    expect(latestUserMessage?.content).toContain('Regenerate this file summary.');
    expect(latestUserMessage?.content).toContain('historical attached note text');
    expect(admin.chatAttachmentsTable.update).not.toHaveBeenCalled();
    expect(admin.attachmentRows[0].status).toBe('attached');
  });

  it('emits streaming attachment metadata only after successful output and finalization', async () => {
    const admin = makeChatAdminClient({
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: null,
          filename: 'notes.txt',
          content_type: 'text/plain',
          size_bytes: 28,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/notes.txt',
          kind: 'text',
          extracted_text: 'hello from the attached notes',
          extracted_chars: 29,
          status: 'uploaded',
          metadata: {},
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);
    unifiedStream.mockImplementationOnce(async function* () {
      yield 'I read the attachment.';
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Summarize this file.',
        },
      ],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    const streamText = await response.text();
    expect(response.status, streamText).toBe(200);
    const events = parseSseEvents(streamText);
    const firstContentIndex = events.findIndex(
      (event) => typeof event === 'object' && event !== null && 'content' in event,
    );
    const attachmentMetadataIndex = events.findIndex(
      (event) =>
        typeof event === 'object' &&
        event !== null &&
        (event as { type?: unknown }).type === 'attachment_metadata',
    );

    expect(firstContentIndex).toBeGreaterThanOrEqual(0);
    expect(attachmentMetadataIndex).toBeGreaterThan(firstContentIndex);
    expect(admin.attachmentRows[0].status).toBe('attached');
  });

  it('releases a streaming attachment claim when finalization fails after output starts', async () => {
    const admin = makeChatAdminClient({
      finalizeUpdateError: { message: 'finalize failed' },
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: null,
          filename: 'notes.txt',
          content_type: 'text/plain',
          size_bytes: 28,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/notes.txt',
          kind: 'text',
          extracted_text: 'hello from the attached notes',
          extracted_chars: 29,
          status: 'uploaded',
          metadata: {},
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);
    unifiedStream.mockImplementationOnce(async function* () {
      yield 'Partial answer before finalize failure.';
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Summarize this file.',
        },
      ],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    const streamText = await response.text();
    expect(response.status, streamText).toBe(200);
    const events = parseSseEvents(streamText);
    expect(events).toContainEqual(expect.objectContaining({ content: 'Partial answer before finalize failure.' }));
    expect(events).toContainEqual(expect.objectContaining({ error: 'Stream error' }));
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'attachment_metadata' }));
    expect(admin.chatAttachmentsTable.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'uploaded',
      updated_at: expect.any(String),
    }));
    expect(admin.attachmentRows[0].status).toBe('uploaded');
  });

  it('releases a streaming attachment claim when finalization fails after an empty model stream', async () => {
    const admin = makeChatAdminClient({
      finalizeUpdateError: { message: 'finalize failed' },
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: null,
          filename: 'notes.txt',
          content_type: 'text/plain',
          size_bytes: 28,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/notes.txt',
          kind: 'text',
          extracted_text: 'hello from the attached notes',
          extracted_chars: 29,
          status: 'uploaded',
          metadata: {},
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);
    unifiedStream.mockImplementationOnce(async function* () {
      yield '';
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Summarize this file.',
        },
      ],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    const streamText = await response.text();
    expect(response.status, streamText).toBe(200);
    const events = parseSseEvents(streamText);
    expect(events).toContainEqual(expect.objectContaining({ error: 'Stream error' }));
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'attachment_metadata' }));
    expect(admin.attachmentRows[0].status).toBe('uploaded');
  });

  it('releases a streaming attachment claim and withholds metadata when the model fails before output', async () => {
    const admin = makeChatAdminClient({
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: null,
          filename: 'notes.txt',
          content_type: 'text/plain',
          size_bytes: 28,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/notes.txt',
          kind: 'text',
          extracted_text: 'hello from the attached notes',
          extracted_chars: 29,
          status: 'uploaded',
          metadata: {},
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);
    unifiedStream.mockImplementationOnce(async function* () {
      throw new Error('provider unavailable');
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Summarize this file.',
        },
      ],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    const streamText = await response.text();
    expect(response.status, streamText).toBe(200);
    const events = parseSseEvents(streamText);
    expect(events).toContainEqual(expect.objectContaining({ error: 'Stream error' }));
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'attachment_metadata' }));
    expect(admin.attachmentRows[0].status).toBe('uploaded');
  });

  it('releases a claimed chat attachment when model execution fails', async () => {
    const admin = makeChatAdminClient({
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: null,
          filename: 'notes.txt',
          content_type: 'text/plain',
          size_bytes: 28,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/notes.txt',
          kind: 'text',
          extracted_text: 'hello from the attached notes',
          extracted_chars: 29,
          status: 'uploaded',
          metadata: {},
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);
    unifiedChat.mockRejectedValueOnce(new Error('provider unavailable'));

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Summarize this file.',
        },
      ],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Internal server error');
    expect(admin.chatAttachmentsTable.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'attaching',
      updated_at: expect.any(String),
    }));
    expect(admin.chatAttachmentsTable.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'uploaded',
      updated_at: expect.any(String),
    }));
    expect(admin.attachmentRows[0].status).toBe('uploaded');
  });

  it('rejects oversized attachment context for the selected model window and releases the claim', async () => {
    const admin = makeChatAdminClient({
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: null,
          filename: 'large-notes.txt',
          content_type: 'text/plain',
          size_bytes: 4096,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/large-notes.txt',
          kind: 'text',
          extracted_text: 'x'.repeat(2000),
          extracted_chars: 2000,
          status: 'uploaded',
          metadata: {},
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);
    getModelConfig.mockResolvedValueOnce({
      ...vllmModelConfig,
      context_length: 128,
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Summarize this file.',
        },
      ],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual(expect.objectContaining({
      error: 'Attachment context is too large for the selected model context window',
      details: expect.objectContaining({
        contextLength: 128,
        attachmentCount: 1,
      }),
    }));
    expect(unifiedChat).not.toHaveBeenCalled();
    expect(admin.attachmentRows[0].status).toBe('uploaded');
  });

  it('rejects a same-turn attachment race when the atomic claim changes no rows', async () => {
    const admin = makeChatAdminClient({
      claimUpdatedIds: [],
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: null,
          filename: 'notes.txt',
          content_type: 'text/plain',
          size_bytes: 28,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/notes.txt',
          kind: 'text',
          extracted_text: 'hello from the attached notes',
          extracted_chars: 29,
          status: 'uploaded',
          metadata: {},
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);
    unifiedChat.mockResolvedValueOnce({
      content: 'Should not run.',
      usage: {
        input_tokens: 1,
        output_tokens: 1,
      },
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Read this file.',
        },
      ],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Attachment has already been used in a chat turn' });
    expect(unifiedChat).not.toHaveBeenCalled();
    expect(admin.attachmentRows[0].status).toBe('uploaded');
  });

  it('rejects chat attachment ids from another conversation before calling the model', async () => {
    const admin = makeChatAdminClient({
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '33333333-3333-4333-8333-333333333333',
          message_id: null,
          filename: 'notes.txt',
          content_type: 'text/plain',
          size_bytes: 28,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/33333333-3333-4333-8333-333333333333/11111111-1111-4111-8111-111111111111/notes.txt',
          kind: 'text',
          extracted_text: 'wrong conversation',
          extracted_chars: 18,
          status: 'uploaded',
          metadata: {},
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);
    unifiedChat.mockResolvedValueOnce({
      content: 'Should not run.',
      usage: {
        input_tokens: 1,
        output_tokens: 1,
      },
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Read this file.',
        },
      ],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Attachment does not belong to this conversation' });
    expect(unifiedChat).not.toHaveBeenCalled();
    expect(admin.chatAttachmentsTable.update).not.toHaveBeenCalled();
  });

  it('rejects chat attachment ids from another user before calling the model', async () => {
    const admin = makeChatAdminClient({
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-2',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: null,
          filename: 'notes.txt',
          content_type: 'text/plain',
          size_bytes: 28,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-2/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/notes.txt',
          kind: 'text',
          extracted_text: 'wrong user',
          extracted_chars: 10,
          status: 'uploaded',
          metadata: {},
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);
    unifiedChat.mockResolvedValueOnce({
      content: 'Should not run.',
      usage: {
        input_tokens: 1,
        output_tokens: 1,
      },
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Read this file.',
        },
      ],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Attachment does not belong to this conversation' });
    expect(admin.attachmentSelectQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(admin.attachmentSelectQuery.eq).toHaveBeenCalledWith('conversation_id', '22222222-2222-4222-8222-222222222222');
    expect(unifiedChat).not.toHaveBeenCalled();
    expect(admin.chatAttachmentsTable.update).not.toHaveBeenCalled();
  });

  it('rejects already-attached chat attachment ids before calling the model', async () => {
    const admin = makeChatAdminClient({
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          message_id: null,
          filename: 'notes.txt',
          content_type: 'text/plain',
          size_bytes: 28,
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/notes.txt',
          kind: 'text',
          extracted_text: 'already used',
          extracted_chars: 12,
          status: 'attached',
          metadata: {},
        },
      ],
    });
    createClient
      .mockReturnValueOnce(makeAuthenticatedSessionClient('user-1'))
      .mockReturnValueOnce(admin.client);
    unifiedChat.mockResolvedValueOnce({
      content: 'Should not run.',
      usage: {
        input_tokens: 1,
        output_tokens: 1,
      },
    });

    const { POST } = await import('../route');
    const response = await POST(makeRequest({
      modelId: 'model-vllm-qwen',
      contextInjectionEnabled: false,
      forceNonStreaming: true,
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      messages: [
        {
          role: 'user',
          content: 'Read this file again.',
        },
      ],
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      tools: [],
    }, { Authorization: 'Bearer session-token' }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Attachment has already been used in a chat turn' });
    expect(unifiedChat).not.toHaveBeenCalled();
    expect(admin.chatAttachmentsTable.update).not.toHaveBeenCalled();
  });
});
