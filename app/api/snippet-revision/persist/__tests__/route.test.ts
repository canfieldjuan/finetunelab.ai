import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const MESSAGE_ID = '11111111-1111-1111-1111-111111111111';
const CONVERSATION_ID = '22222222-2222-2222-2222-222222222222';

const getUser = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

function makeRequest(body: unknown, headers: Record<string, string> = { authorization: 'Bearer token' }): NextRequest {
  return new Request('http://localhost/api/snippet-revision/persist', {
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
    messageId: MESSAGE_ID,
    conversationId: CONVERSATION_ID,
    expectedContent: 'Original answer.',
    updatedText: 'Revised answer.',
    ...overrides,
  };
}

describe('POST /api/snippet-revision/persist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
        },
      },
      error: null,
    });
    rpcMock.mockResolvedValue({
      data: [{ id: MESSAGE_ID }],
      error: null,
    });
    createClientMock.mockReturnValue({
      auth: {
        getUser,
      },
      rpc: rpcMock,
    });
  });

  it('saves through the atomic RPC with expected content in the request body', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      messageId: MESSAGE_ID,
    });
    expect(rpcMock).toHaveBeenCalledWith('update_assistant_message_content_if_current', {
      p_message_id: MESSAGE_ID,
      p_conversation_id: CONVERSATION_ID,
      p_expected_content: 'Original answer.',
      p_updated_content: 'Revised answer.',
    });
  });

  it('requires authentication before attempting persistence', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody(), {}));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'unauthorized',
        message: 'Authorization header is required.',
      },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects unsaved temp message ids before hitting the database', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody({
      messageId: 'temp-123',
    })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'invalid_message_id',
        message: 'messageId must be a saved message UUID.',
      },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('reports stale or unauthorized saves without mutating local state', async () => {
    rpcMock.mockResolvedValue({
      data: [],
      error: null,
    });
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'message_changed',
        message: 'Message changed before the revision could be saved. Reload and try again.',
      },
    });
  });

  it('returns a generic error when the RPC fails', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: 'permission denied for table messages',
      },
    });
    const { POST } = await import('../route');

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'save_failed',
        message: 'Failed to save revised message.',
      },
    });
  });
});
