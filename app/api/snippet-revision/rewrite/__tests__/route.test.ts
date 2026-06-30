import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const unifiedChat = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser,
    },
  })),
}));

vi.mock('@/lib/llm/unified-client', () => ({
  unifiedLLMClient: {
    chat: unifiedChat,
  },
}));

vi.mock('@/lib/config/llmConfig', () => ({
  loadLLMConfig: vi.fn(() => ({
    provider: 'openai',
    openai: {
      model: 'gpt-4o-mini',
    },
  })),
}));

vi.mock('@/lib/llm/openai', () => ({
  getOpenAIResponse: vi.fn(async () => '<replacement>fallback replacement</replacement>'),
}));

vi.mock('@/lib/llm/anthropic', () => ({
  runAnthropicWithToolCalls: vi.fn(async () => ({
    content: '<replacement>anthropic replacement</replacement>',
    usage: { input_tokens: 1, output_tokens: 1 },
  })),
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

describe('POST /api/snippet-revision/rewrite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('generates replacement text with the selected model', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      sourceText: 'Opening. Soft middle. Closing.',
      selection: {
        start: 9,
        end: 21,
        expectedText: 'Soft middle.',
      },
      instruction: 'Make it sharper.',
      modelId: 'model-123',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      replacement: 'Sharper middle.',
      modelId: 'model-123',
    });
    expect(unifiedChat).toHaveBeenCalledWith(
      'model-123',
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Soft middle.'),
        }),
      ]),
      expect.objectContaining({
        userId: 'user-1',
        temperature: 0.2,
      }),
    );
  });

  it('rejects a stale selected range before calling the model', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      sourceText: 'Opening. Soft middle. Closing.',
      selection: {
        start: 9,
        end: 21,
        expectedText: 'Hard middle.',
      },
      instruction: 'Make it sharper.',
      modelId: 'model-123',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'target_mismatch',
        message: 'Selection text no longer matches the source text.',
      },
    });
    expect(unifiedChat).not.toHaveBeenCalled();
  });

  it('requires an authenticated portal request', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      sourceText: 'Opening. Soft middle. Closing.',
      selection: {
        start: 9,
        end: 21,
        expectedText: 'Soft middle.',
      },
      instruction: 'Make it sharper.',
      modelId: 'model-123',
    }, {}));

    expect(response.status).toBe(401);
    expect(unifiedChat).not.toHaveBeenCalled();
  });
});
