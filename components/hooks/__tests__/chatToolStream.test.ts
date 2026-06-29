import { describe, expect, it } from 'vitest';
import { getRenderableToolCalls, normalizeToolCalls } from '../chatToolStream';

describe('chat tool stream helpers', () => {
  it('normalizes valid tool call metadata and drops malformed rows', () => {
    expect(normalizeToolCalls([
      { name: 'query_knowledge_graph', success: true },
      { name: 'email_security', success: false, error: 'Mailbox not connected' },
      { name: '', success: true },
      { success: true },
      null,
    ])).toEqual([
      { name: 'query_knowledge_graph', success: true },
      { name: 'email_security', success: false, error: 'Mailbox not connected' },
    ]);
  });

  it('returns undefined for payloads without renderable tool calls', () => {
    expect(normalizeToolCalls(undefined)).toBeUndefined();
    expect(normalizeToolCalls([{ name: '  ' }])).toBeUndefined();
  });

  it('suppresses successful web search activity when result cards are already present', () => {
    expect(getRenderableToolCalls({
      tools_called: [
        { name: 'web_search', success: true },
        { name: 'query_knowledge_graph', success: true },
      ],
      webSearchResults: [{ title: 'Result' }],
    })).toEqual([
      { name: 'query_knowledge_graph', success: true },
    ]);
  });

  it('keeps failed web search activity visible even when cards are absent', () => {
    expect(getRenderableToolCalls({
      tools_called: [{ name: 'web_search', success: false, error: 'Search unavailable' }],
    })).toEqual([
      { name: 'web_search', success: false, error: 'Search unavailable' },
    ]);
  });
});
