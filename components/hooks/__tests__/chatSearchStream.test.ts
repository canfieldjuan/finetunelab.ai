import { describe, expect, it } from 'vitest';
import {
  initialWebSearchStreamState,
  reduceWebSearchStreamEvent,
} from '../chatSearchStream';

describe('chat search stream helpers', () => {
  it('uses legacy doc summaries only before structured web search results arrive', () => {
    const legacyState = reduceWebSearchStreamEvent(initialWebSearchStreamState, {
      type: 'doc_summary',
      title: 'Legacy result',
      url: 'https://example.com/legacy',
      summary: 'Legacy summary',
    });

    expect(legacyState.results).toHaveLength(1);

    const structuredState = reduceWebSearchStreamEvent(legacyState, {
      type: 'web_search_results',
      results: [
        {
          title: 'Structured result',
          url: 'https://example.com/structured',
          snippet: 'Structured summary',
        },
      ],
    });

    const ignoredLegacyState = reduceWebSearchStreamEvent(structuredState, {
      type: 'doc_summary',
      title: 'Ignored legacy result',
      url: 'https://example.com/ignored',
      summary: 'Should not append',
    });

    expect(ignoredLegacyState.results).toEqual([
      {
        title: 'Structured result',
        url: 'https://example.com/structured',
        snippet: 'Structured summary',
      },
    ]);
  });

  it('ignores legacy doc summaries without usable URLs', () => {
    const state = reduceWebSearchStreamEvent(initialWebSearchStreamState, {
      type: 'doc_summary',
      title: 'Broken result',
      summary: 'No URL',
    });

    expect(state.results).toBeUndefined();
  });

});
