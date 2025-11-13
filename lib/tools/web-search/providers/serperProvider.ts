import { searchConfig } from '../search.config';
import type { ProviderResult, ProviderSearchParams, WebSearchDocument, WebSearchProvider } from '../types';

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  source?: string;
  imageUrl?: string;
}

interface SerperApiResponse {
  organic?: SerperOrganicResult[];
  news?: SerperOrganicResult[];
  knowledgeGraph?: unknown;
}

export class SerperSearchProvider implements WebSearchProvider {
  public readonly name = 'serper';

  private readonly endpoint = searchConfig.providers.serper.endpoint;
  private readonly apiKey = searchConfig.providers.serper.apiKey;
  private readonly location = searchConfig.providers.serper.location;
  private readonly gl = searchConfig.providers.serper.gl;
  private readonly hl = searchConfig.providers.serper.hl;

  async search(params: ProviderSearchParams): Promise<ProviderResult> {
    if (!this.apiKey) {
      throw new Error('Serper API key is not configured');
    }

    const { query, maxResults, timeoutMs } = params;

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    const startedAt = Date.now();

    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
          'User-Agent': 'web-ui-tools/1.0',
        },
        body: JSON.stringify({
          q: query,
          num: Math.min(maxResults, 10),
          gl: this.gl,
          hl: this.hl,
          location: this.location,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Serper API error (${response.status}): ${errorBody}`);
    }

    const payload = (await response.json()) as SerperApiResponse;
    const primaryResults = payload.organic && payload.organic.length
      ? payload.organic
      : payload.news || [];

    const normalized: WebSearchDocument[] = primaryResults
      .slice(0, maxResults)
      .map(result => ({
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        publishedAt: result.date,
        source: result.source || 'Google',
        imageUrl: result.imageUrl,
      }));

    return {
      provider: this.name,
      latencyMs: Date.now() - startedAt,
      results: normalized,
      raw: payload,
    };
  }
}

export const serperSearchProvider = new SerperSearchProvider();
