import { searchConfig } from '../search.config';
import type { ProviderResult, ProviderSearchParams, WebSearchDocument, WebSearchProvider } from '../types';

interface BraveWebResult {
  title: string;
  description: string;
  url: string;
  page_age?: string;
  thumbnail?: { src: string };
  rank?: number;
}

interface BraveApiResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

export class BraveSearchProvider implements WebSearchProvider {
  public readonly name = 'brave';

  private readonly endpoint = searchConfig.providers.brave.endpoint;
  private readonly apiKey = searchConfig.providers.brave.apiKey;
  private readonly filterAdultContent = searchConfig.providers.brave.filterAdultContent;
  private readonly filterDuplicates = searchConfig.providers.brave.filterDuplicates;

  async search(params: ProviderSearchParams): Promise<ProviderResult> {
    if (!this.apiKey) {
      throw new Error('Brave Search API key is not configured');
    }

    const { query, maxResults, timeoutMs } = params;
    const searchUrl = new URL(this.endpoint);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('count', Math.min(maxResults, 20).toString());
    searchUrl.searchParams.set('summary', '1');
    searchUrl.searchParams.set('freshness', 'month');

    if (this.filterAdultContent) {
      searchUrl.searchParams.set('safesearch', 'strict');
    }

    if (this.filterDuplicates) {
      searchUrl.searchParams.set('exclude_sources', 'duplicates');
    }

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
          'X-Subscription-Token': this.apiKey,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Brave Search API error (${response.status}): ${errorBody}`);
    }

    const payload = (await response.json()) as BraveApiResponse;
    const rawResults = payload.web?.results ?? [];

    const normalized: WebSearchDocument[] = rawResults
      .slice(0, maxResults)
      .map(result => ({
        title: result.title,
        url: result.url,
        snippet: result.description,
        publishedAt: result.page_age,
        source: 'Brave Search',
        imageUrl: result.thumbnail?.src,
      }));

    return {
      provider: this.name,
      latencyMs: Date.now() - startedAt,
      results: normalized,
      raw: payload,
    };
  }
}

export const braveSearchProvider = new BraveSearchProvider();
