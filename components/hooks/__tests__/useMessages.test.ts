import { describe, expect, it } from 'vitest';
import { validateConversations } from '@/lib/validation/conversation-validator';
import {
  MESSAGE_CONTENT_TRUNCATION_LIMIT,
  buildValidationMessageProjection,
  truncateMessageContentForDisplay,
} from '../useMessages';
import type { Message } from '@/components/chat/types';

describe('useMessages validation projection', () => {
  it('preserves hydrated GraphRAG fields through the validation path', () => {
    const [projected] = buildValidationMessageProjection([
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Answer from docs',
        metadata: {
          attachment_ids: ['attachment-1'],
          attachments: [
            {
              id: 'attachment-1',
              filename: 'brief.md',
              contentType: 'text/markdown',
              sizeBytes: 2048,
              kind: 'text',
              extractedChars: 120,
              status: 'attached',
            },
          ],
          graphrag: {
            graph_used: true,
            context_chunks_used: 7,
          },
        },
        attachment_ids: ['attachment-1'],
        attachments: [
          {
            id: 'attachment-1',
            filename: 'brief.md',
            contentType: 'text/markdown',
            sizeBytes: 2048,
            kind: 'text',
            extractedChars: 120,
            status: 'attached',
          },
        ],
        citations: [
          {
            source: 'handbook.md',
            content: 'Important fact',
            confidence: 0.88,
          },
        ],
        contextsUsed: 7,
        graphrag_used: true,
        graphrag_nodes: 5,
        graphrag_chunks: 7,
        graphrag_retrieval_ms: 31,
        graphrag_relevance: 0.92,
        graphrag_grounded: true,
        graphrag_method: 'hybrid',
      } satisfies Message,
    ]);

    const validationResult = validateConversations([
      {
        id: 'conv-1',
        user_id: 'user-1',
        created_at: '2026-06-29T01:20:00.000Z',
        messages: [projected],
      },
    ]);

    expect(validationResult.valid[0].messages?.[0]).toMatchObject({
      citations: [
        {
          source: 'handbook.md',
          content: 'Important fact',
          confidence: 0.88,
        },
      ],
      contextsUsed: 7,
      graphrag_used: true,
      graphrag_nodes: 5,
      graphrag_chunks: 7,
      graphrag_retrieval_ms: 31,
      graphrag_relevance: 0.92,
      graphrag_grounded: true,
      graphrag_method: 'hybrid',
      attachment_ids: ['attachment-1'],
      attachments: [
        {
          id: 'attachment-1',
          filename: 'brief.md',
          contentType: 'text/markdown',
          sizeBytes: 2048,
          kind: 'text',
          extractedChars: 120,
          status: 'attached',
        },
      ],
    });
  });

  it('preserves structured local truncation fields through the validation path', () => {
    const originalContent = 'x'.repeat(MESSAGE_CONTENT_TRUNCATION_LIMIT + 5);
    const truncated = truncateMessageContentForDisplay({
      id: 'msg-1',
      role: 'assistant',
      content: originalContent,
    });
    const [projected] = buildValidationMessageProjection([truncated]);

    expect(truncated.content).toContain('Message truncated due to size');
    expect(truncated.contentTruncated).toBe(true);
    expect(truncated.originalContentLength).toBe(originalContent.length);
    expect(projected).toMatchObject({
      contentTruncated: true,
      originalContentLength: originalContent.length,
    });
  });
});
