import { WebSearchDocument } from '@/lib/tools/web-search/types';

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

  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard
      .writeText(citation)
      .then(() => {
        console.log('Citation copied to clipboard');
        return true;
      })
      .catch((err) => {
        console.error('Failed to copy citation:', err);
        return false;
      });
  } else {
    // Fallback for older browsers
    return new Promise<boolean>((resolve) => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = citation;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          console.log('Citation copied to clipboard (fallback)');
          resolve(true);
        } else {
          console.error('Failed to copy citation (fallback)');
          resolve(false);
        }
      } catch (err) {
        console.error('Failed to copy citation (fallback):', err);
        resolve(false);
      }
    });
  }
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

  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard
      .writeText(bibliography)
      .then(() => {
        console.log('Bibliography copied to clipboard');
        return true;
      })
      .catch((err) => {
        console.error('Failed to copy bibliography:', err);
        return false;
      });
  } else {
    // Fallback for older browsers
    return new Promise<boolean>((resolve) => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = bibliography;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          console.log('Bibliography copied to clipboard (fallback)');
          resolve(true);
        } else {
          console.error('Failed to copy bibliography (fallback)');
          resolve(false);
        }
      } catch (err) {
        console.error('Failed to copy bibliography (fallback):', err);
        resolve(false);
      }
    });
  }
}
