
import { searchConfig } from '../search.config';
import type { ProviderResult, ProviderSearchParams, WebSearchDocument, WebSearchProvider } from '../types';

// This is a placeholder for the actual Google Search API response format.
interface GoogleWebResult {
  title: string;
  snippet: string;
  link: string;
  pagemap?: { cse_image?: [{ src: string }] };
}

interface GoogleApiResponse {
  items?: GoogleWebResult[];
}

export class GoogleSearchProvider implements WebSearchProvider {
  public readonly name = 'google';

  private readonly endpoint = searchConfig.providers.google.endpoint;
  private readonly apiKey = searchConfig.providers.google.apiKey;
  private readonly cx = searchConfig.providers.google.cx;

  async search(params: ProviderSearchParams): Promise<ProviderResult> {
    if (!this.apiKey || !this.cx) {
      throw new Error('Google Search API key or CX is not configured');
    }

    const { query, maxResults, timeoutMs } = params;
    const searchUrl = new URL(this.endpoint);
    searchUrl.searchParams.set('key', this.apiKey);
    searchUrl.searchParams.set('cx', this.cx);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('num', Math.min(maxResults, 10).toString());

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
      throw new Error(`Google Search API error (${response.status}): ${errorBody}`);
    }

    const payload = (await response.json()) as GoogleApiResponse;
    const rawResults = payload.items ?? [];

    const normalized: WebSearchDocument[] = rawResults
      .slice(0, maxResults)
      .map(result => ({
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        source: 'Google Search',
        imageUrl: result.pagemap?.cse_image?.[0]?.src,
      }));

    return {
      provider: this.name,
      latencyMs: Date.now() - startedAt,
      results: normalized,
      raw: payload,
    };
  }
}

export const googleSearchProvider = new GoogleSearchProvider();
