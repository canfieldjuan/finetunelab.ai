import { describe, expect, it } from 'vitest';
import { buildToolUsageDataPointsFromMessages } from '../dataAggregator';

describe('buildToolUsageDataPointsFromMessages', () => {
  it('keeps legacy string tool rows and per-tool success flags', () => {
    const [first, second] = buildToolUsageDataPointsFromMessages([
      {
        id: 'msg-1',
        conversation_id: 'conv-1',
        created_at: '2026-06-29T00:00:00.000Z',
        tools_called: ['calculator', 'datetime'],
        tool_success: [true, false],
        error_type: 'tool_error',
        latency_ms: 42,
      },
    ]);

    expect(first).toMatchObject({
      messageId: 'msg-1',
      conversationId: 'conv-1',
      toolName: 'calculator',
      executionTimeMs: 42,
      success: true,
      errorType: 'tool_error',
    });
    expect(second).toMatchObject({
      toolName: 'datetime',
      success: false,
      errorType: 'tool_error',
    });
  });

  it('aggregates object tool rows by name and per-call success', () => {
    const points = buildToolUsageDataPointsFromMessages([
      {
        id: 'msg-2',
        conversation_id: 'conv-2',
        created_at: '2026-06-29T00:00:00.000Z',
        tools_called: [
          { name: 'query_knowledge_graph', success: true },
          { name: 'email_security', success: false, error: 'Mailbox not connected' },
        ],
        tool_success: false,
        error_type: null,
        latency_ms: null,
      },
    ]);

    expect(points).toEqual([
      {
        timestamp: new Date('2026-06-29T00:00:00.000Z'),
        messageId: 'msg-2',
        conversationId: 'conv-2',
        toolName: 'query_knowledge_graph',
        executionTimeMs: 0,
        success: true,
        errorType: undefined,
      },
      {
        timestamp: new Date('2026-06-29T00:00:00.000Z'),
        messageId: 'msg-2',
        conversationId: 'conv-2',
        toolName: 'email_security',
        executionTimeMs: 0,
        success: false,
        errorType: 'Mailbox not connected',
      },
    ]);
  });

  it('drops malformed tool rows instead of aggregating them under object strings', () => {
    const points = buildToolUsageDataPointsFromMessages([
      {
        id: 'msg-3',
        conversation_id: 'conv-3',
        created_at: '2026-06-29T00:00:00.000Z',
        tools_called: [{ success: true }, null, '', { name: 'web_search' }],
        tool_success: true,
      },
    ]);

    expect(points.map((point) => point.toolName)).toEqual(['web_search']);
    expect(points[0].success).toBe(true);
  });
});
