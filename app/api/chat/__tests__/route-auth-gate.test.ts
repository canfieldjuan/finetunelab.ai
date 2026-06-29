import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import type { ModelConfig } from '@/lib/models/llm-model.types';

const unifiedChat = vi.hoisted(() => vi.fn());
const getModelConfig = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
const sessionGetUser = vi.hoisted(() => vi.fn());
const buildUserMcpToolset = vi.hoisted(() => vi.fn());
const getSharedMcpClientManager = vi.hoisted(() => vi.fn(() => ({ id: 'manager' })));
const executePortalChatTool = vi.hoisted(() => vi.fn());

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
  metadata: {},
};

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return {
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    json: async () => body,
  } as unknown as NextRequest;
}

function chatBody(userId = 'body-user') {
  return {
    modelId: 'model-vllm-qwen',
    contextInjectionEnabled: false,
    forceNonStreaming: true,
    userId,
    messages: [{ role: 'user', content: 'hello' }],
    tools: [],
  };
}

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

vi.mock('@supabase/supabase-js', () => ({
  createClient,
}));

vi.mock('@/lib/tools/mcp/user-toolset', () => ({
  buildUserMcpToolset,
}));

vi.mock('@/lib/tools/mcp/client', () => ({
  getSharedMcpClientManager,
}));

vi.mock('@/lib/tools/toolManager', () => ({
  executePortalChatTool,
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

describe('POST /api/chat normal-mode auth gate', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.CHAT_STREAMING_CHUNK_DELAY_MS = '0';

    const serviceClient = {
      from: vi.fn(),
      auth: {
        admin: {
          getUserById: vi.fn(),
        },
      },
    };
    const sessionClient = {
      auth: {
        getUser: sessionGetUser,
      },
    };
    createClient.mockImplementation((_url: string, _key: string, options?: { global?: { headers?: Record<string, string> } }) => {
      return options?.global?.headers?.Authorization ? sessionClient : serviceClient;
    });
    getModelConfig.mockResolvedValue(vllmModelConfig);
    unifiedChat.mockResolvedValue({
      content: 'ok',
      usage: {
        input_tokens: 1,
        output_tokens: 1,
      },
      toolsCalled: [],
    });
    buildUserMcpToolset.mockResolvedValue({
      definitions: vi.fn(() => []),
      has: vi.fn(() => false),
      execute: vi.fn(),
    });
  });

  it('uses the verified session user instead of a body-supplied userId for MCP and model access', async () => {
    sessionGetUser.mockResolvedValue({
      data: { user: { id: 'session-user-A' } },
      error: null,
    });
    const { POST } = await import('../route');

    const response = await POST(makeRequest(chatBody('victim-user-B'), {
      Authorization: 'Bearer valid-token',
    }));

    expect(response.status).toBe(200);
    await response.text();
    expect(buildUserMcpToolset).toHaveBeenCalledWith('session-user-A', expect.any(Object), expect.any(Object));
    expect(getModelConfig).toHaveBeenCalledWith('model-vllm-qwen', 'session-user-A', expect.any(Object));
  });

  it('treats an invalid bearer as unauthenticated and does not load MCP tools', async () => {
    sessionGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'expired' },
    });
    const { POST } = await import('../route');

    const response = await POST(makeRequest(chatBody('body-user'), {
      Authorization: 'Bearer expired-token',
    }));

    expect(response.status).toBe(200);
    await response.text();
    expect(buildUserMcpToolset).not.toHaveBeenCalled();
    expect(getModelConfig).toHaveBeenCalledWith('model-vllm-qwen', 'body-user', expect.any(Object));
  });

  it('preserves no-Authorization body fallback and does not load MCP tools', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest(chatBody('body-user')));

    expect(response.status).toBe(200);
    await response.text();
    expect(sessionGetUser).not.toHaveBeenCalled();
    expect(buildUserMcpToolset).not.toHaveBeenCalled();
    expect(getModelConfig).toHaveBeenCalledWith('model-vllm-qwen', 'body-user', expect.any(Object));
  });
});
