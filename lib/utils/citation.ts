import { WebSearchDocument } from '@/lib/tools/web-search/types';
import { copyTextToClipboard } from './clipboard';

export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'simple';

/**
 * Format a web search result as a citation in various academic styles
 */
export function formatCitation(
  result: WebSearchDocument,
  style: CitationStyle = 'apa'
): string {
  const { title, url, source, publishedAt } = result;
  const domain = source || new URL(url).hostname;
  const date = publishedAt ? new Date(publishedAt).toLocaleDateString() : 'n.d.';
  const year = publishedAt ? new Date(publishedAt).getFullYear() : 'n.d.';

  switch (style) {
    case 'apa':
      // APA 7th Edition: Author. (Year, Month Day). Title. Site Name. URL
      return `${domain}. (${date}). ${title}. Retrieved from ${url}`;

    case 'mla':
      // MLA 9th Edition: "Title." Site Name, Date, URL.
      return `"${title}." ${domain}, ${date}, ${url}.`;

    case 'chicago':
      // Chicago 17th Edition: "Title." Site Name. Accessed Date. URL.
      return `"${title}." ${domain}. Accessed ${date}. ${url}.`;

    case 'simple':
      // Simple format for quick reference
      return `${title} - ${domain} (${year}) - ${url}`;

    default:
      return `${title} - ${domain} (${date}) - ${url}`;
  }
}

/**
 * Copy a citation to the clipboard
 */
export function copyCitation(
  result: WebSearchDocument,
  style: CitationStyle = 'apa'
): Promise<boolean> {
  const citation = formatCitation(result, style);
  return copyTextToClipboard(citation);
}

/**
 * Format multiple citations as a bibliography
 */
export function formatBibliography(
  results: WebSearchDocument[],
  style: CitationStyle = 'apa'
): string {
  const citations = results.map((result) => formatCitation(result, style));

  // Sort alphabetically for academic formatting
  const sorted = [...citations].sort((a, b) => a.localeCompare(b));

  return sorted.join('\n\n');
}

/**
 * Copy a bibliography to the clipboard
 */
export function copyBibliography(
  results: WebSearchDocument[],
  style: CitationStyle = 'apa'
): Promise<boolean> {
  const bibliography = formatBibliography(results, style);
  return copyTextToClipboard(bibliography);
}
