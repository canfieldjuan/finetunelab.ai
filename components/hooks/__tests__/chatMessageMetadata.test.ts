import { describe, expect, it } from 'vitest';
import {
  buildAssistantMessageMetadata,
  buildAttachmentMessageMetadata,
  buildGeneratedImageFallbackContent,
  buildGeneratedImageMarkdown,
  buildGeneratedImageMessageMetadata,
  hydrateAttachmentMessageFields,
  hydrateGeneratedImageMessageFields,
  hydrateGraphRAGMessageFields,
} from '../chatMessageMetadata';

describe('chat message metadata helpers', () => {
  it('persists GraphRAG citations and retrieval stats for regular chat messages', () => {
    const metadata = buildAssistantMessageMetadata({
      modelId: 'model-1',
      modelName: 'Local 7B',
      provider: 'vllm',
      timestamp: '2026-06-29T01:10:00.000Z',
      attachmentIds: ['attachment-1'],
      attachments: [
        {
          id: 'attachment-1',
          filename: 'notes.ts',
          contentType: 'video/mp2t',
          sizeBytes: 42,
          kind: 'code',
          extractedChars: 30,
          status: 'attached',
        },
      ],
      graphRAG: {
        citations: [
          {
            source: 'kb.md',
            content: 'The answer came from the uploaded doc.',
            confidence: 0.82,
          },
        ],
        contextsUsed: 1,
        graphUsed: true,
        nodesRetrieved: 4,
        chunksUsed: 2,
        retrievalMs: 38,
        relevance: 0.91,
        grounded: true,
        method: 'hybrid',
      },
    });

    expect(metadata).toMatchObject({
      model_name: 'Local 7B',
      provider: 'vllm',
      model_id: 'model-1',
      timestamp: '2026-06-29T01:10:00.000Z',
      attachment_ids: ['attachment-1'],
      attachments: [
        {
          id: 'attachment-1',
          filename: 'notes.ts',
          contentType: 'video/mp2t',
          sizeBytes: 42,
          kind: 'code',
          extractedChars: 30,
          status: 'attached',
        },
      ],
      graphrag: {
        citations: [
          {
            source: 'kb.md',
            content: 'The answer came from the uploaded doc.',
            confidence: 0.82,
          },
        ],
        contexts_used: 1,
        graph_used: true,
        nodes_retrieved: 4,
        context_chunks_used: 2,
        retrieval_time_ms: 38,
        context_relevance_score: 0.91,
        answer_grounded_in_graph: true,
        retrieval_method: 'hybrid',
      },
    });
  });

  it('hydrates GraphRAG display fields without requiring persisted model metadata', () => {
    const fields = hydrateGraphRAGMessageFields({
      graphrag: {
        citations: [
          {
            source: 'notes.txt',
            content: 'Reloaded evidence',
            confidence: 1.2,
          },
        ],
        graph_used: true,
        nodes_retrieved: 3,
        context_chunks_used: 2,
        retrieval_time_ms: 19,
        context_relevance_score: 0.77,
        answer_grounded_in_graph: false,
        retrieval_method: 'vector',
      },
    });

    expect(fields).toEqual({
      citations: [
        {
          source: 'notes.txt',
          content: 'Reloaded evidence',
          confidence: 1,
        },
      ],
      contextsUsed: 2,
      graphrag_used: true,
      graphrag_nodes: 3,
      graphrag_chunks: 2,
      graphrag_retrieval_ms: 19,
      graphrag_relevance: 0.77,
      graphrag_grounded: false,
      graphrag_method: 'vector',
    });
  });

  it('drops malformed citations while keeping valid GraphRAG stats', () => {
    const fields = hydrateGraphRAGMessageFields({
      graphrag: {
        citations: [
          { source: '', content: 'missing source', confidence: 0.5 },
          { source: 'valid.md', content: 'Valid fact', confidence: 0.4 },
          null,
        ],
        contexts_used: 3,
        graph_used: true,
      },
    });

    expect(fields).toEqual({
      citations: [
        {
          source: 'valid.md',
          content: 'Valid fact',
          confidence: 0.4,
        },
      ],
      contextsUsed: 3,
      graphrag_used: true,
    });
  });

  it('persists and hydrates compact attachment metadata for user messages', () => {
    const metadata = buildAttachmentMessageMetadata({
      timestamp: '2026-06-30T18:45:00.000Z',
      attachmentIds: ['attachment-1'],
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

    expect(metadata).toEqual({
      timestamp: '2026-06-30T18:45:00.000Z',
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
    expect(hydrateAttachmentMessageFields(metadata)).toEqual({
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

  it('persists generated-image storage paths without the expiring signed URL', () => {
    const metadata = buildGeneratedImageMessageMetadata({
      jobId: 'img-job-1',
      prompt: 'a flux test',
      source: 'comfyui',
      url: 'https://signed.example/generated.png',
      storagePath: 'user-1/img-job-1.png',
      timestamp: '2026-07-01T18:45:00.000Z',
    });

    expect(metadata).toEqual({
      timestamp: '2026-07-01T18:45:00.000Z',
      generated_image: {
        job_id: 'img-job-1',
        prompt: 'a flux test',
        source: 'comfyui',
        storage_path: 'user-1/img-job-1.png',
      },
    });
    expect(hydrateGeneratedImageMessageFields(metadata)).toEqual({
      generatedImage: {
        jobId: 'img-job-1',
        prompt: 'a flux test',
        source: 'comfyui',
        storagePath: 'user-1/img-job-1.png',
      },
    });
  });

  it('keeps permanent generated-image URLs for sources without storage paths', () => {
    const metadata = buildGeneratedImageMessageMetadata({
      jobId: 'img-job-2',
      prompt: 'a mountain',
      source: 'unsplash',
      url: 'https://images.unsplash.com/photo.jpg',
      attribution: {
        authorName: 'Jane',
        authorUrl: 'https://example.com/jane',
        sourceName: 'Unsplash',
        sourceUrl: 'https://unsplash.com',
      },
      timestamp: '2026-07-01T18:45:00.000Z',
    });

    expect(metadata).toMatchObject({
      generated_image: {
        job_id: 'img-job-2',
        prompt: 'a mountain',
        source: 'unsplash',
        url: 'https://images.unsplash.com/photo.jpg',
        attribution: {
          authorName: 'Jane',
          sourceName: 'Unsplash',
        },
      },
    });
  });

  it('builds generated-image display markdown and durable fallback content', () => {
    expect(buildGeneratedImageMarkdown({
      prompt: 'a [flux] test',
      url: 'https://signed.example/generated.png',
    })).toBe('![a \\[flux\\] test](https://signed.example/generated.png)');
    expect(buildGeneratedImageFallbackContent('a flux test')).toBe('Generated image: a flux test');
  });
});
