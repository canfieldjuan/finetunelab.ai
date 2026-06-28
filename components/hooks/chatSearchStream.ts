import { normalizeWebSearchResults } from '@/lib/tools/web-search/result-normalizer';
import type { WebSearchDocument } from '@/lib/tools/web-search/types';

export interface WebSearchStreamState {
  results?: WebSearchDocument[];
  receivedStructuredEvent: boolean;
}

export const initialWebSearchStreamState: WebSearchStreamState = {
  receivedStructuredEvent: false,
};

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function getToolEventName(parsed: Record<string, unknown>): string | undefined {
  return getString(parsed.tool_name) ?? getString(parsed.toolName);
}

export function reduceWebSearchStreamEvent(
  state: WebSearchStreamState,
  parsed: Record<string, unknown>
): WebSearchStreamState {
  if (parsed.type === 'web_search_results') {
    return {
      receivedStructuredEvent: true,
      results: normalizeWebSearchResults(parsed.results),
    };
  }

  if (parsed.type !== 'doc_summary' || state.receivedStructuredEvent) {
    return state;
  }

  const legacyResults = normalizeWebSearchResults([{
    title: getString(parsed.title) ?? 'Document',
    url: getString(parsed.url) ?? '',
    snippet: getString(parsed.summary) ?? '',
    summary: getString(parsed.summary),
    source: getString(parsed.source),
    publishedAt: getString(parsed.publishedAt),
  }]);

  if (!legacyResults) {
    return state;
  }

  return {
    receivedStructuredEvent: false,
    results: state.results ? [...state.results, ...legacyResults] : legacyResults,
  };
}
