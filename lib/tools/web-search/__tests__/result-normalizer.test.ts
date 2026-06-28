import { describe, expect, it } from 'vitest';
import { normalizeWebSearchResults } from '../result-normalizer';

describe('normalizeWebSearchResults', () => {
  it('keeps renderable web results and strips remote image URLs', () => {
    const results = normalizeWebSearchResults([
      {
        title: 'Example',
        url: 'https://example.com/page',
        snippet: 'Useful source',
        source: 'example.com',
        imageUrl: 'https://cdn.example.com/thumb.jpg',
      },
    ]);

    expect(results).toEqual([
      {
        title: 'Example',
        url: 'https://example.com/page',
        snippet: 'Useful source',
        source: 'example.com',
      },
    ]);
  });

  it('drops missing or invalid URLs before they reach SearchResultCard', () => {
    const results = normalizeWebSearchResults([
      { title: 'Missing URL', snippet: 'Nope' },
      { title: 'Empty URL', url: '', snippet: 'Nope' },
      { title: 'Relative URL', url: '/relative', snippet: 'Nope' },
      { title: 'Unsafe URL', url: 'javascript:alert(1)', snippet: 'Nope' },
    ]);

    expect(results).toBeUndefined();
  });

  it('returns undefined for non-array values', () => {
    expect(normalizeWebSearchResults({ title: 'Nope' })).toBeUndefined();
  });
});
