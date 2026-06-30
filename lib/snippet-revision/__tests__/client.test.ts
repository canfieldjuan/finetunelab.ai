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

  it('returns apply successes when the response matches the request action', async () => {
    const applyRequest: SnippetRevisionApiRequest = {
      ...request,
      action: 'apply',
    };
    const fetcher = vi.fn(async () => jsonResponse({
      result: {
        ok: true,
        applied: true,
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

    await expect(requestSnippetRevision(applyRequest, { fetcher })).resolves.toMatchObject({
      ok: true,
      applied: true,
      updatedText: 'Keep the point. Lose the polish.',
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

  it('returns engine target failures instead of throwing', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      result: {
        ok: false,
        applied: false,
        code: 'target_mismatch',
        message: 'Range text no longer matches the originally selected text.',
      },
    }));

    await expect(requestSnippetRevision(request, { fetcher })).resolves.toEqual({
      ok: false,
      applied: false,
      code: 'target_mismatch',
      message: 'Range text no longer matches the originally selected text.',
    });
  });

  it('rejects successful responses with unknown engine failure codes', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      result: {
        ok: false,
        applied: false,
        code: 'stale_custom_endpoint_code',
        message: 'Custom endpoint returned a code this client does not understand.',
      },
    }));

    await expect(requestSnippetRevision(request, { fetcher })).rejects.toMatchObject({
      name: 'SnippetRevisionApiError',
      code: 'invalid_response',
      status: 200,
    });
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

  it('surfaces request aborts separately from network failures', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetcher = vi.fn(async () => {
      throw abortError;
    });

    await expect(requestSnippetRevision(request, { fetcher })).rejects.toMatchObject({
      name: 'SnippetRevisionApiError',
      code: 'request_aborted',
      details: abortError,
    });
  });

  it('surfaces custom signal abort reasons separately from network failures', async () => {
    const controller = new AbortController();
    const abortReason = new Error('caller cancelled preview');
    controller.abort(abortReason);
    const fetcher = vi.fn(async () => {
      throw abortReason;
    });

    await expect(requestSnippetRevision(request, {
      fetcher,
      signal: controller.signal,
    })).rejects.toMatchObject({
      name: 'SnippetRevisionApiError',
      code: 'request_aborted',
      details: abortReason,
    });
  });

  it('surfaces response body aborts separately from JSON parse failures', async () => {
    const abortError = Object.assign(new Error('body aborted'), { name: 'AbortError' });
    const response = new Response('{}', { status: 200 });
    vi.spyOn(response, 'json').mockRejectedValue(abortError);
    const fetcher = vi.fn(async () => response);

    await expect(requestSnippetRevision(request, { fetcher })).rejects.toMatchObject({
      name: 'SnippetRevisionApiError',
      code: 'request_aborted',
      status: 200,
      details: abortError,
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

  it('rejects malformed successful change payloads', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      result: {
        ok: true,
        applied: false,
        updatedText: 'Keep the point. Lose the polish.',
        unchanged: false,
        change: {
          mode: 'replace_text',
        },
      },
    }));

    await expect(requestSnippetRevision(request, { fetcher })).rejects.toMatchObject({
      name: 'SnippetRevisionApiError',
      code: 'invalid_response',
      status: 200,
    });
  });

  it.each([
    { label: 'negative start', start: -1, end: 31 },
    { label: 'negative end', start: 16, end: -1 },
    { label: 'end before start', start: 31, end: 16 },
    { label: 'end beyond source text', start: 16, end: 32 },
  ])('rejects malformed successful change payload offsets: $label', async ({ start, end }) => {
    const fetcher = vi.fn(async () => jsonResponse({
      result: {
        ok: true,
        applied: false,
        updatedText: 'Keep the point. Lose the polish.',
        unchanged: false,
        change: {
          mode: 'replace_text',
          start,
          end,
          original: 'Cut the polish.',
          replacement: 'Lose the polish.',
        },
      },
    }));

    await expect(requestSnippetRevision(request, { fetcher })).rejects.toMatchObject({
      name: 'SnippetRevisionApiError',
      code: 'invalid_response',
      status: 200,
    });
  });

  it.each([
    { label: 'preview response marked applied', clientRequest: request, applied: true },
    {
      label: 'apply response marked unapplied',
      clientRequest: { ...request, action: 'apply' as const },
      applied: false,
    },
  ])('rejects successful responses for the wrong action: $label', async ({ clientRequest, applied }) => {
    const fetcher = vi.fn(async () => jsonResponse({
      result: {
        ok: true,
        applied,
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

    await expect(requestSnippetRevision(clientRequest, { fetcher })).rejects.toMatchObject({
      name: 'SnippetRevisionApiError',
      code: 'invalid_response',
      status: 200,
    });
  });

  it('rejects successful responses whose change does not match the request source', async () => {
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
          original: 'Different source text.',
          replacement: 'Lose the polish.',
        },
      },
    }));

    await expect(requestSnippetRevision(request, { fetcher })).rejects.toMatchObject({
      name: 'SnippetRevisionApiError',
      code: 'invalid_response',
      status: 200,
    });
  });

  it('rejects successful replace_text responses that do not match the submitted find/replace', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      result: {
        ok: true,
        applied: false,
        updatedText: 'Lose the polish. Cut the polish.',
        unchanged: false,
        change: {
          mode: 'replace_text',
          start: 0,
          end: 15,
          original: 'Keep the point.',
          replacement: 'Lose the polish.',
        },
      },
    }));

    await expect(requestSnippetRevision(request, { fetcher })).rejects.toMatchObject({
      name: 'SnippetRevisionApiError',
      code: 'invalid_response',
      status: 200,
    });
  });

  it('rejects successful replace_range responses that do not match the submitted range revision', async () => {
    const rangeRequest: SnippetRevisionApiRequest = {
      action: 'preview',
      sourceText: 'Keep the point. Cut the polish.',
      revision: {
        mode: 'replace_range',
        start: 5,
        end: 14,
        expectedText: 'the point',
        replace: 'that idea',
      },
    };
    const fetcher = vi.fn(async () => jsonResponse({
      result: {
        ok: true,
        applied: false,
        updatedText: 'Keep the point. Drop the polish.',
        unchanged: false,
        change: {
          mode: 'replace_range',
          start: 16,
          end: 31,
          original: 'Cut the polish.',
          replacement: 'Drop the polish.',
        },
      },
    }));

    await expect(requestSnippetRevision(rangeRequest, { fetcher })).rejects.toMatchObject({
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
