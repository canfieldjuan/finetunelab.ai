interface SupabaseMutationResult {
  data: unknown;
  error: { message?: string } | null;
}

interface SupabaseUpdateBuilder {
  eq(column: string, value: unknown): SupabaseUpdateBuilder;
  select(columns: string): PromiseLike<SupabaseMutationResult>;
}

export interface SnippetRevisionPersistenceClient {
  from(table: 'messages'): {
    update(values: { content: string }): SupabaseUpdateBuilder;
  };
}

export interface PersistAssistantSnippetRevisionParams {
  client: SnippetRevisionPersistenceClient;
  messageId: string;
  conversationId: string;
  expectedContent: string;
  updatedText: string;
}

export async function persistAssistantSnippetRevision({
  client,
  messageId,
  conversationId,
  expectedContent,
  updatedText,
}: PersistAssistantSnippetRevisionParams): Promise<void> {
  const { data, error } = await client
    .from('messages')
    .update({ content: updatedText })
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .eq('content', expectedContent)
    .select('id');

  if (error) {
    throw new Error(error.message || 'Failed to save revised message.');
  }

  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error('Message changed before the revision could be saved. Reload and try again.');
  }
}
