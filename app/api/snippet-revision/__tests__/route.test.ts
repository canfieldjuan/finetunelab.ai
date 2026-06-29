import { describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/snippet-revision', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('POST /api/snippet-revision', () => {
  it('previews an exact text replacement without marking it applied', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      action: 'preview',
      sourceText: 'Keep the point. Cut the polish.',
      revision: {
        mode: 'replace_text',
        find: 'Cut the polish.',
        replace: 'Lose the polish.',
      },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      result: expect.objectContaining({
        ok: true,
        applied: false,
        updatedText: 'Keep the point. Lose the polish.',
        change: expect.objectContaining({
          mode: 'replace_text',
          original: 'Cut the polish.',
          replacement: 'Lose the polish.',
        }),
      }),
    });
  });

  it('applies a range replacement with expected selected text', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      action: 'apply',
      sourceText: 'The cat sat.',
      revision: {
        mode: 'replace_range',
        start: 4,
        end: 7,
        expectedText: 'cat',
        replace: 'dog',
      },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      result: expect.objectContaining({
        ok: true,
        applied: true,
        updatedText: 'The dog sat.',
        change: expect.objectContaining({
          mode: 'replace_range',
          original: 'cat',
          replacement: 'dog',
        }),
      }),
    });
  });

  it('returns engine rejections as normal result state', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      action: 'apply',
      sourceText: 'The dog sat.',
      revision: {
        mode: 'replace_range',
        start: 4,
        end: 7,
        expectedText: 'cat',
        replace: 'fox',
      },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      result: {
        ok: false,
        applied: false,
        code: 'target_mismatch',
        message: 'Range text no longer matches the originally selected text.',
      },
    });
  });

  it('rejects malformed request payloads', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      action: 'revise',
      sourceText: 'Anything',
      revision: {
        mode: 'replace_text',
        find: 'Anything',
        replace: 'Something',
      },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'invalid_action',
        message: 'action must be "preview" or "apply".',
      },
    });
  });

  it('rejects oversized source text before calling the engine', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      action: 'preview',
      sourceText: 'x'.repeat(200_001),
      revision: {
        mode: 'replace_text',
        find: 'x',
        replace: 'y',
      },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'source_text_too_large',
        message: 'sourceText must be 200000 characters or fewer.',
      },
    });
  });
});
