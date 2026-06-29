import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('SearchService provider ordering', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.TOOL_WEBSEARCH_ENABLED = 'true';
    process.env.SEARCH_CACHE_ENABLED = 'false';
    process.env.SEARCH_PRIMARY_PROVIDER = 'duckduckgo';
    process.env.SEARCH_FALLBACK_PROVIDER = 'duckduckgo';
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.SERPER_API_KEY;
    delete process.env.GOOGLE_SEARCH_API_KEY;
    delete process.env.GOOGLE_SEARCH_CX;
    delete process.env.BING_SEARCH_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it('honors configured provider order before trying missing-key providers', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      RelatedTopics: [
        {
          Result: 'OpenAI API documentation - official platform docs',
          FirstURL: 'https://platform.openai.com/docs',
          Text: 'OpenAI API documentation - official platform docs',
        },
      ],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { SearchService } = await import('../search.service');
    const service = new SearchService();

    const result = await service.search('OpenAI API documentation', 3, { skipCache: true });

    expect(result.metadata.provider).toBe('duckduckgo');
    expect(result.results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.duckduckgo.com');
  });
});
