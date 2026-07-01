export interface PersistAssistantSnippetRevisionParams {
  messageId: string;
  conversationId: string;
  expectedContent: string;
  updatedText: string;
  authToken: string;
  endpoint?: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}

export async function persistAssistantSnippetRevision({
  messageId,
  conversationId,
  expectedContent,
  updatedText,
  authToken,
  endpoint = '/api/snippet-revision/persist',
  fetcher = globalThis.fetch,
  signal,
}: PersistAssistantSnippetRevisionParams): Promise<void> {
  if (!fetcher) {
    throw new Error('No fetch implementation is available.');
  }

  let response: Response;
  try {
    response = await fetcher(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        messageId,
        conversationId,
        expectedContent,
        updatedText,
      }),
      signal,
    });
  } catch (error) {
    console.error('[SnippetRevisionPersistence] Save request failed:', error);
    throw new Error('Snippet revision save request failed.');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    console.error('[SnippetRevisionPersistence] Save response was invalid JSON:', error);
    throw new Error('Snippet revision save returned invalid JSON.');
  }

  if (!response.ok) {
    throw new Error(parseApiError(payload));
  }

  if (!isRecord(payload) || payload.ok !== true || payload.messageId !== messageId) {
    throw new Error('Snippet revision save returned an invalid response.');
  }
}

function parseApiError(payload: unknown): string {
  if (
    isRecord(payload) &&
    isRecord(payload.error) &&
    typeof payload.error.message === 'string'
  ) {
    return payload.error.message;
  }

  return 'Failed to save revised message.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
