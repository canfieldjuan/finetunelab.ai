import { describe, expect, it, vi } from 'vitest';
import {
  persistAssistantSnippetRevision,
  type SnippetRevisionPersistenceClient,
} from '../snippetRevisionPersistence';

function makeClient(result: { data: unknown; error: { message?: string } | null }) {
  const select = vi.fn(async () => result);
  const eq = vi.fn(() => builder);
  const update = vi.fn(() => builder);
  const from = vi.fn(() => ({ update }));
  const builder = {
    eq,
    select,
  };

  return {
    client: { from } as unknown as SnippetRevisionPersistenceClient,
    from,
    update,
    eq,
    select,
  };
}

describe('persistAssistantSnippetRevision', () => {
  it('updates a saved assistant message only when the expected content still matches', async () => {
    const { client, from, update, eq, select } = makeClient({
      data: [{ id: 'assistant-1' }],
      error: null,
    });

    await persistAssistantSnippetRevision({
      client,
      messageId: 'assistant-1',
      conversationId: 'conversation-1',
      expectedContent: 'Original answer.',
      updatedText: 'Revised answer.',
    });

    expect(from).toHaveBeenCalledWith('messages');
    expect(update).toHaveBeenCalledWith({ content: 'Revised answer.' });
    expect(eq).toHaveBeenCalledWith('id', 'assistant-1');
    expect(eq).toHaveBeenCalledWith('conversation_id', 'conversation-1');
    expect(eq).toHaveBeenCalledWith('role', 'assistant');
    expect(eq).toHaveBeenCalledWith('content', 'Original answer.');
    expect(select).toHaveBeenCalledWith('id');
  });

  it('rejects stale saves when no row still matches the expected content', async () => {
    const { client } = makeClient({
      data: [],
      error: null,
    });

    await expect(persistAssistantSnippetRevision({
      client,
      messageId: 'assistant-1',
      conversationId: 'conversation-1',
      expectedContent: 'Original answer.',
      updatedText: 'Revised answer.',
    })).rejects.toThrow('Message changed before the revision could be saved. Reload and try again.');
  });

  it('surfaces Supabase update errors', async () => {
    const { client } = makeClient({
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(persistAssistantSnippetRevision({
      client,
      messageId: 'assistant-1',
      conversationId: 'conversation-1',
      expectedContent: 'Original answer.',
      updatedText: 'Revised answer.',
    })).rejects.toThrow('permission denied');
  });
});
