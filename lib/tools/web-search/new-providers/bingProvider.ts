
import { searchConfig } from '../search.config';
import type { ProviderResult, ProviderSearchParams, WebSearchDocument, WebSearchProvider } from '../types';

// This is a placeholder for the actual Bing Search API response format.
interface BingWebResult {
  name: string;
  url: string;
  snippet: string;
  dateLastCrawled: string;
  thumbnailUrl?: string;
}

interface BingApiResponse {
  webPages?: {
    value?: BingWebResult[];
  };
}

export class BingSearchProvider implements WebSearchProvider {
  public readonly name = 'bing';

  private readonly endpoint = searchConfig.providers.bing.endpoint;
  private readonly apiKey = searchConfig.providers.bing.apiKey;

  async search(params: ProviderSearchParams): Promise<ProviderResult> {
    if (!this.apiKey) {
      throw new Error('Bing Search API key is not configured');
    }

    const { query, maxResults, timeoutMs } = params;
    const searchUrl = new URL(this.endpoint);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('count', Math.min(maxResults, 50).toString());
    searchUrl.searchParams.set('mkt', 'en-US');

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    const startedAt = Date.now();

    try {
      response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
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
      throw new Error(`Bing Search API error (${response.status}): ${errorBody}`);
    }

    const payload = (await response.json()) as BingApiResponse;
    const rawResults = payload.webPages?.value ?? [];

    const normalized: WebSearchDocument[] = rawResults
      .slice(0, maxResults)
      .map(result => ({
        title: result.name,
        url: result.url,
        snippet: result.snippet,
        publishedAt: result.dateLastCrawled,
        source: 'Bing Search',
        imageUrl: result.thumbnailUrl,
      }));

    return {
      provider: this.name,
      latencyMs: Date.now() - startedAt,
      results: normalized,
      raw: payload,
    };
  }
}

export const bingSearchProvider = new BingSearchProvider();
