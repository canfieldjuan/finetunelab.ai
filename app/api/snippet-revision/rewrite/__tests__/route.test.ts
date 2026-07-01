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

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('@/lib/llm/unified-client', () => ({
  unifiedLLMClient: {
    chat: unifiedChat,
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
  });

  it('generates replacement text with an authorized selected model', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      replacement: 'Sharper middle.',
      modelId: MODEL_ID,
    });
    expect(fromMock).toHaveBeenCalledWith('llm_models');
    expect(modelSelect).toHaveBeenCalledWith('id, max_output_tokens');
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
        maxTokens: 516,
        skipGuardrails: false,
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
