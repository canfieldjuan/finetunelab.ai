
import { searchConfig } from '../search.config';
import type { ProviderResult, ProviderSearchParams, WebSearchDocument, WebSearchProvider } from '../types';

// This is a placeholder for the actual DuckDuckGo API response format.
interface DuckDuckGoWebResult {
  Result: string;
  FirstURL: string;
  Text: string;
  Icon?: { URL: string };
}

interface DuckDuckGoApiResponse {
  RelatedTopics?: DuckDuckGoWebResult[];
}

export class DuckDuckGoSearchProvider implements WebSearchProvider {
  public readonly name = 'duckduckgo';

  private readonly endpoint = searchConfig.providers.duckduckgo.endpoint;

  async search(params: ProviderSearchParams): Promise<ProviderResult> {
    const { query, maxResults, timeoutMs } = params;
    const searchUrl = new URL(this.endpoint);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('no_html', '1');

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    const startedAt = Date.now();

    try {
      response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'web-ui-tools/1.0',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`DuckDuckGo Search API error (${response.status}): ${errorBody}`);
    }

    const payload = (await response.json()) as DuckDuckGoApiResponse;
    const rawResults = payload.RelatedTopics ?? [];

    const normalized: WebSearchDocument[] = rawResults
      .slice(0, maxResults)
      .map(result => ({
        title: result.Text.split(' - ')[0],
        url: result.FirstURL,
        snippet: result.Text,
        source: 'DuckDuckGo Search',
        imageUrl: result.Icon?.URL ? `https://duckduckgo.com${result.Icon.URL}` : undefined,
      }));

    return {
      provider: this.name,
      latencyMs: Date.now() - startedAt,
      results: normalized,
      raw: payload,
    };
  }
}

export const duckduckgoSearchProvider = new DuckDuckGoSearchProvider();
