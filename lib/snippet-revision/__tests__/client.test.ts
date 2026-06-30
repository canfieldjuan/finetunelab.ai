import { describe, expect, it, vi } from 'vitest';
import {
  requestSnippetRevision,
  SnippetRevisionApiError,
  type SnippetRevisionApiRequest,
} from '../client';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

const request: SnippetRevisionApiRequest = {
  action: 'preview',
  sourceText: 'Keep the point. Cut the polish.',
  revision: {
    mode: 'replace_text',
    find: 'Cut the polish.',
    replace: 'Lose the polish.',
  },
};

describe('requestSnippetRevision', () => {
  it('posts a snippet revision request and returns the engine result', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      result: {
        ok: true,
        applied: false,
        updatedText: 'Keep the point. Lose the polish.',
        unchanged: false,
        change: {
          mode: 'replace_text',
          start: 16,
          end: 31,
          original: 'Cut the polish.',
          replacement: 'Lose the polish.',
        },
      },
    }));

    await expect(requestSnippetRevision(request, { fetcher })).resolves.toEqual({
      ok: true,
      applied: false,
      updatedText: 'Keep the point. Lose the polish.',
      unchanged: false,
      change: {
        mode: 'replace_text',
        start: 16,
        end: 31,
        original: 'Cut the polish.',
        replacement: 'Lose the polish.',
      },
    });

    expect(fetcher).toHaveBeenCalledWith('/api/snippet-revision', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: undefined,
    });
  });

  it('supports custom endpoints and abort signals', async () => {
    const signal = new AbortController().signal;
    const fetcher = vi.fn(async () => jsonResponse({
      result: {
        ok: false,
        applied: false,
        code: 'target_ambiguous',
        message: 'Search text appears more than once. Use a more specific snippet.',
      },
    }));

    const result = await requestSnippetRevision(request, {
      endpoint: '/custom/snippet',
      fetcher,
      signal,
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'target_ambiguous',
    });
    expect(fetcher).toHaveBeenCalledWith('/custom/snippet', expect.objectContaining({ signal }));
  });

  it('normalizes API validation errors', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      error: {
        code: 'invalid_action',
        message: 'action must be "preview" or "apply".',
      },
    }, { status: 400 }));

    await expect(requestSnippetRevision(request, { fetcher })).rejects.toMatchObject({
      name: 'SnippetRevisionApiError',
      code: 'invalid_action',
      status: 400,
      message: 'action must be "preview" or "apply".',
    });
  });

  it('wraps network failures', async () => {
    const networkError = new Error('offline');
    const fetcher = vi.fn(async () => {
      throw networkError;
    });

    await expect(requestSnippetRevision(request, { fetcher })).rejects.toMatchObject({
      name: 'SnippetRevisionApiError',
      code: 'request_failed',
      details: networkError,
    });
  });

  it('rejects malformed success payloads', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ nope: true }));

    await expect(requestSnippetRevision(request, { fetcher })).rejects.toMatchObject({
      name: 'SnippetRevisionApiError',
      code: 'invalid_response',
      status: 200,
    });
  });

  it('exports a concrete API error class for callers', () => {
    const error = new SnippetRevisionApiError('Bad request', {
      code: 'bad_request',
      status: 400,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'SnippetRevisionApiError',
      message: 'Bad request',
      code: 'bad_request',
      status: 400,
    });
  });
});
