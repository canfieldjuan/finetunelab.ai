import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const MODEL_ID = '11111111-1111-1111-1111-111111111111';

const unifiedChat = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());
const modelSingle = vi.hoisted(() => vi.fn());
const modelEq = vi.hoisted(() => vi.fn());
const modelSelect = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const startTrace = vi.hoisted(() => vi.fn());
const endTrace = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('@/lib/llm/unified-client', () => ({
  unifiedLLMClient: {
    chat: unifiedChat,
  },
}));

vi.mock('@/lib/tracing/trace.service', () => ({
  traceService: {
    startTrace,
    endTrace,
  },
}));

function makeRequest(body: unknown, headers: Record<string, string> = { authorization: 'Bearer token' }): NextRequest {
  return new Request('http://localhost/api/snippet-revision/rewrite', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    sourceText: 'Opening. Soft middle. Closing.',
    selection: {
      start: 9,
      end: 21,
      expectedText: 'Soft middle.',
    },
    instruction: 'Make it sharper.',
    modelId: MODEL_ID,
    ...overrides,
  };
}

describe('POST /api/snippet-revision/rewrite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const modelQuery = {
      select: modelSelect,
      eq: modelEq,
      single: modelSingle,
    };
    modelSelect.mockReturnValue(modelQuery);
    modelEq.mockReturnValue(modelQuery);
    modelSingle.mockResolvedValue({
      data: {
        id: MODEL_ID,
        max_output_tokens: 4096,
        context_length: 8192,
        is_global: false,
        user_id: 'user-1',
      },
      error: null,
    });
    fromMock.mockReturnValue(modelQuery);
    createClientMock.mockReturnValue({
      auth: {
        getUser,
      },
      from: fromMock,
    });
    getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
        },
      },
      error: null,
    });
    unifiedChat.mockResolvedValue({
      content: '<replacement>Sharper middle.</replacement>',
      usage: {
        input_tokens: 10,
        output_tokens: 4,
      },
    });
    startTrace.mockResolvedValue({
      traceId: 'trace-1',
      spanId: 'span-1',
      userId: 'user-1',
      startTime: new Date('2026-07-01T00:00:00.000Z'),
      spanName: 'llm.snippet_rewrite',
      operationType: 'llm_call',
    });
    endTrace.mockResolvedValue(undefined);
  });

  it('generates replacement text with an authorized selected model', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      replacement: 'Sharper middle.',
      modelId: MODEL_ID,
    });
    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          persistSession: false,
        }),
      }),
    );
    expect(fromMock).toHaveBeenCalledWith('llm_models');
    expect(modelSelect).toHaveBeenCalledWith('id, max_output_tokens, context_length, is_global, user_id');
    expect(modelEq).toHaveBeenCalledWith('id', MODEL_ID);
    expect(modelEq).toHaveBeenCalledWith('enabled', true);
    expect(unifiedChat).toHaveBeenCalledWith(
      MODEL_ID,
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Output contract:'),
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Soft middle.'),
        }),
      ]),
      expect.objectContaining({
        userId: 'user-1',
        temperature: 0.2,
        maxTokens: 524,
        skipGuardrails: false,
      }),
    );
    expect(startTrace).toHaveBeenCalledWith(expect.objectContaining({
      spanName: 'llm.snippet_rewrite',
      operationType: 'llm_call',
      modelName: MODEL_ID,
      userId: 'user-1',
      metadata: expect.objectContaining({
        feature: 'snippet_revision',
      }),
    }));
    expect(endTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'trace-1',
        spanId: 'span-1',
      }),
      expect.objectContaining({
        status: 'completed',
        inputTokens: 10,
        outputTokens: 4,
        maxTokens: 524,
        outputData: {
          content: '<replacement>Sharper middle.</replacement>',
        },
      }),
    );
  });

  it('rejects a stale selected range before model authorization or generation', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody({
      selection: {
        start: 9,
        end: 21,
        expectedText: 'Hard middle.',
      },
    })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'target_mismatch',
        message: 'Selection text no longer matches the source text.',
      },
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(unifiedChat).not.toHaveBeenCalled();
  });

  it('requires an authenticated portal request', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody(), {}));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'unauthorized',
        message: 'Authorization header is required.',
      },
    });
    expect(unifiedChat).not.toHaveBeenCalled();
  });

  it('fails closed when Supabase public env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'server_config_error',
        message: 'Snippet rewrite is not configured.',
      },
    });
    expect(createClientMock).not.toHaveBeenCalled();
    expect(unifiedChat).not.toHaveBeenCalled();
  });

  it('requires an explicit selected model instead of default fallback providers', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody({ modelId: '__default__' })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'model_required',
        message: 'Select a portal model before generating a snippet rewrite.',
      },
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(unifiedChat).not.toHaveBeenCalled();
  });

  it('rejects inaccessible selected models before calling the LLM client', async () => {
    modelSingle.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST116',
        message: 'No rows found',
      },
    });
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'model_forbidden',
        message: 'Selected model is not available for this user.',
      },
    });
    expect(unifiedChat).not.toHaveBeenCalled();
  });

  it('authorizes enabled global models without selecting stored credentials', async () => {
    modelSingle.mockResolvedValue({
      data: {
        id: MODEL_ID,
        max_output_tokens: 4096,
        context_length: 8192,
        is_global: true,
        user_id: 'other-user',
      },
      error: null,
    });
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(200);
    expect(modelSelect).toHaveBeenCalledWith('id, max_output_tokens, context_length, is_global, user_id');
    expect(modelSelect).not.toHaveBeenCalledWith(expect.stringContaining('api_key'));
    expect(modelSelect).not.toHaveBeenCalledWith(expect.stringContaining('auth_headers'));
    expect(unifiedChat).toHaveBeenCalledTimes(1);
  });

  it('rejects enabled models that are neither global nor owned by the caller', async () => {
    modelSingle.mockResolvedValue({
      data: {
        id: MODEL_ID,
        max_output_tokens: 4096,
        context_length: 8192,
        is_global: false,
        user_id: 'other-user',
      },
      error: null,
    });
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'model_forbidden',
        message: 'Selected model is not available for this user.',
      },
    });
    expect(unifiedChat).not.toHaveBeenCalled();
  });

  it('rejects selections that exceed the selected model output budget', async () => {
    modelSingle.mockResolvedValue({
      data: {
        id: MODEL_ID,
        max_output_tokens: 128,
        context_length: 8192,
        is_global: false,
        user_id: 'user-1',
      },
      error: null,
    });
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'selection_exceeds_model_output',
        message: 'Selected text is too long for the selected model output limit.',
      },
    });
    expect(unifiedChat).not.toHaveBeenCalled();
  });

  it('rejects rewrite prompts that exceed the selected model context window', async () => {
    modelSingle.mockResolvedValue({
      data: {
        id: MODEL_ID,
        max_output_tokens: 4096,
        context_length: 700,
        is_global: false,
        user_id: 'user-1',
      },
      error: null,
    });
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'selection_exceeds_model_context',
        message: 'Selected text and instruction exceed the selected model context window.',
      },
    });
    expect(unifiedChat).not.toHaveBeenCalled();
  });

  it('trims surrounding context to fit the selected model context window', async () => {
    modelSingle.mockResolvedValue({
      data: {
        id: MODEL_ID,
        max_output_tokens: 4096,
        context_length: 4096,
        is_global: false,
        user_id: 'user-1',
      },
      error: null,
    });
    const before = 'b'.repeat(2_000);
    const after = 'a'.repeat(2_000);
    const selected = 'Target text.';
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody({
      sourceText: `${before}${selected}${after}`,
      selection: {
        start: before.length,
        end: before.length + selected.length,
        expectedText: selected,
      },
    })));

    expect(response.status).toBe(200);
    const messages = unifiedChat.mock.calls[0][1];
    const userPrompt = messages.find((message: { role: string }) => message.role === 'user')?.content;
    expect(userPrompt).toContain('Target text.');
    expect(userPrompt).not.toContain('b'.repeat(2_000));
    expect(userPrompt).not.toContain('a'.repeat(2_000));
  });

  it('returns a generic rewrite failure instead of leaking provider errors', async () => {
    unifiedChat.mockRejectedValue(new Error('provider secret: sk-live-sensitive'));
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'rewrite_failed',
        message: 'Failed to generate replacement text.',
      },
    });
    expect(endTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'trace-1',
        spanId: 'span-1',
      }),
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'provider secret: sk-live-sensitive',
        errorType: 'Error',
      }),
    );
  });

  it('rejects model output that omits the replacement wrapper', async () => {
    unifiedChat.mockResolvedValue({
      content: 'Sure, here is a rewrite: Sharper middle.',
      usage: {
        input_tokens: 10,
        output_tokens: 8,
      },
    });
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'replacement_tag_missing',
        message: 'The model did not return a replacement block.',
      },
    });
  });

  it('rejects model output with multiple replacement blocks', async () => {
    unifiedChat.mockResolvedValue({
      content: '<replacement>First.</replacement>\n<replacement>Second.</replacement>',
      usage: {
        input_tokens: 10,
        output_tokens: 8,
      },
    });
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'replacement_tag_multiple',
        message: 'The model returned multiple replacement blocks.',
      },
    });
  });

  it('allows an empty replacement block for deletion edits', async () => {
    unifiedChat.mockResolvedValue({
      content: '<replacement></replacement>',
      usage: {
        input_tokens: 10,
        output_tokens: 1,
      },
    });
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody({
      instruction: 'Delete the selected text.',
    })));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      replacement: '',
      modelId: MODEL_ID,
    });
  });

  it('caps selected text length before generation can truncate the replacement', async () => {
    const selected = 'a'.repeat(4_001);
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody({
      sourceText: selected,
      selection: {
        start: 0,
        end: selected.length,
        expectedText: selected,
      },
    })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'selected_text_too_large',
        message: 'Selected text must be 4000 characters or fewer.',
      },
    });
    expect(unifiedChat).not.toHaveBeenCalled();
  });
});
