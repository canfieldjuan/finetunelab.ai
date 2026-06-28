import type { WebSearchDocument } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isRenderableUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeWebSearchResults(value: unknown): WebSearchDocument[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const results = value.flatMap((item): WebSearchDocument[] => {
    if (!isRecord(item)) return [];

    const title = getString(item.title);
    const url = getString(item.url);

    if (!title || !url || !isRenderableUrl(url)) {
      return [];
    }

    const result: WebSearchDocument = {
      title,
      url,
      snippet: typeof item.snippet === 'string' ? item.snippet : '',
    };

    const source = getString(item.source);
    const publishedAt = getString(item.publishedAt);
    const summary = getString(item.summary);
    const fullContent = getString(item.fullContent);

    if (source) result.source = source;
    if (publishedAt) result.publishedAt = publishedAt;
    if (summary) result.summary = summary;
    if (typeof item.confidenceScore === 'number') result.confidenceScore = item.confidenceScore;
    if (fullContent) result.fullContent = fullContent;

    return [result];
  });

  return results.length > 0 ? results : undefined;
}
