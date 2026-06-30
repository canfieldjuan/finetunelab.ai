import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import type { ModelConfig } from '@/lib/models/llm-model.types';

const unifiedChat = vi.hoisted(() => vi.fn());
const unifiedStream = vi.hoisted(() => vi.fn());
const getModelConfig = vi.hoisted(() => vi.fn());
const executePortalChatTool = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());

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

  return {
    client: {
      from,
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

vi.mock('@/lib/llm/openai', () => ({
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
  traceService: {
    startTrace: vi.fn(async () => ({ traceId: 'trace-1', spanId: 'span-1' })),
    createChildSpan: vi.fn(async () => ({ traceId: 'trace-1', spanId: 'tool-span-1' })),
    endTrace: vi.fn(async () => undefined),
    captureError: vi.fn(async () => undefined),
  },
  startTrace: vi.fn(async () => ({ traceId: 'trace-1', spanId: 'span-1' })),
  endTrace: vi.fn(async () => undefined),
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

  it('caps image generation to one job per chat turn (re-calls are short-circuited)', async () => {
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
    executePortalChatTool.mockResolvedValueOnce({
      data: { status: 'image_generation_started', jobId: 'img-job-1' },
      error: null,
      executionTimeMs: 1,
    });
    let secondCallResult: unknown;
    unifiedChat.mockImplementationOnce(async (_modelId, _messages, options) => {
      await options.toolCallHandler('generate_image', { prompt: 'first image' });
      secondCallResult = await options.toolCallHandler('generate_image', { prompt: 'second image' });
      return {
        content: 'Image is generating.',
        usage: {
          input_tokens: 12,
          output_tokens: 6,
        },
        toolsCalled: [
          { name: 'generate_image', success: true },
          { name: 'generate_image', success: true },
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

    // Only the first call queues a job + emits one event; the re-call is capped.
    expect(imageEvents).toHaveLength(1);
    expect(imageEvents[0]).toEqual(
      expect.objectContaining({ jobId: 'img-job-1', prompt: 'first image', streamToken: expect.any(String) }),
    );
    expect(executePortalChatTool).toHaveBeenCalledTimes(1);
    // The second generate_image call was short-circuited, not executed again.
    expect(secondCallResult).toEqual(
      expect.objectContaining({ status: 'image_generation_already_started', jobId: 'img-job-1' }),
    );
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
