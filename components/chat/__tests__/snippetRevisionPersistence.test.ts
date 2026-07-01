import { describe, expect, it, vi } from 'vitest';
import { persistAssistantSnippetRevision } from '../snippetRevisionPersistence';

describe('persistAssistantSnippetRevision', () => {
  it('posts the expected content in the request body instead of a Supabase URL filter', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      messageId: '11111111-1111-1111-1111-111111111111',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await persistAssistantSnippetRevision({
      messageId: '11111111-1111-1111-1111-111111111111',
      conversationId: '22222222-2222-2222-2222-222222222222',
      expectedContent: 'Original answer.',
      updatedText: 'Revised answer.',
      authToken: 'session-token',
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith('/api/snippet-revision/persist', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer session-token',
      },
      body: JSON.stringify({
        messageId: '11111111-1111-1111-1111-111111111111',
        conversationId: '22222222-2222-2222-2222-222222222222',
        expectedContent: 'Original answer.',
        updatedText: 'Revised answer.',
      }),
      signal: undefined,
    });
  });

  it('surfaces stale-save errors from the persistence endpoint', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      error: {
        code: 'message_changed',
        message: 'Message changed before the revision could be saved. Reload and try again.',
      },
    }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(persistAssistantSnippetRevision({
      messageId: '11111111-1111-1111-1111-111111111111',
      conversationId: '22222222-2222-2222-2222-222222222222',
      expectedContent: 'Original answer.',
      updatedText: 'Revised answer.',
      authToken: 'session-token',
      fetcher,
    })).rejects.toThrow('Message changed before the revision could be saved. Reload and try again.');
  });

  it('rejects invalid success responses', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      messageId: '33333333-3333-3333-3333-333333333333',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(persistAssistantSnippetRevision({
      messageId: '11111111-1111-1111-1111-111111111111',
      conversationId: '22222222-2222-2222-2222-222222222222',
      expectedContent: 'Original answer.',
      updatedText: 'Revised answer.',
      authToken: 'session-token',
      fetcher,
    })).rejects.toThrow('Snippet revision save returned an invalid response.');
  });
});
