import { describe, expect, it } from 'vitest';
import {
  buildAssistantMessageMetadata,
  hydrateGraphRAGMessageFields,
} from '../chatMessageMetadata';

describe('chat message metadata helpers', () => {
  it('persists GraphRAG citations and retrieval stats for regular chat messages', () => {
    const metadata = buildAssistantMessageMetadata({
      modelId: 'model-1',
      modelName: 'Local 7B',
      provider: 'vllm',
      timestamp: '2026-06-29T01:10:00.000Z',
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
});
