import axios from 'axios';
import * as cheerio from 'cheerio';

const AXIOS_CONFIG = {
  timeout: 15000, // Increased timeout
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.google.com/',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
  },
  responseType: 'arraybuffer' as const, // For manual decoding
  validateStatus: (status: number) => status < 500, // Handle 4xx manually, throw on 5xx
};

const MAX_CONTENT_LENGTH = 15000; // Limit content to ~15k characters to avoid excessive token usage

export class ContentService {
  /**
   * Fetches the raw HTML content of a given URL.
   * @param url The URL to fetch.
   * @returns The HTML content as a string.
   */
  private async fetchHtml(url: string, retries = 3): Promise<string> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[ContentService] Fetching URL: ${url} (Attempt ${attempt}/${retries})`);
        const response = await axios.get(url, AXIOS_CONFIG);
        
        if (response.status === 429) {
           throw new Error('Rate limited (429)');
        }
        
        if (response.status >= 400) {
           // 403/406 might be permanent, but sometimes transient or WAF.
           if (response.status === 403 || response.status === 406) {
             throw new Error(`Access denied (${response.status})`);
           }
           throw new Error(`Request failed with status ${response.status}`);
        }

        // Decode content
        const buffer = response.data;
        const contentType = response.headers['content-type'] || '';
        let encoding = 'utf-8';
        
        // Simple charset detection
        const charsetMatch = contentType.match(/charset=([^;]+)/i);
        if (charsetMatch) {
          encoding = charsetMatch[1].trim();
        }
        
        const decoder = new TextDecoder(encoding);
        const text = decoder.decode(buffer);
        
        console.log(`[ContentService] Successfully fetched URL: ${url}`);
        return text;

      } catch (error: unknown) {
        lastError = error;
        const isRetryable = error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.message.includes('429') || (error.response && error.response.status >= 500);
        
        if (!isRetryable || attempt === retries) {
          break;
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[ContentService] Retryable error for ${url}. Waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    const message = lastError instanceof Error ? lastError.message : 'Unknown error';
    console.error(`[ContentService] Error fetching ${url}: ${message}`);
    throw new Error(`Failed to fetch content from ${url}.`);
  }

  /**
   * Parses HTML and extracts clean, readable text content.
   * It tries to find the main content of the page and removes irrelevant elements.
   * @param html The HTML string to parse.
   * @returns The cleaned text content.
   */
  private cleanHtml(html: string): string {
    console.log('[ContentService] Cleaning HTML content...');
    const $ = cheerio.load(html);

    // Remove elements that are typically not part of the main content
    $('script, style, nav, header, footer, aside, form, noscript, [aria-hidden="true"]').remove();

    // Attempt to find the main content container
    let mainContent = $('main, article, [role="main"]').first();
    if (mainContent.length === 0) {
      console.log('[ContentService] No main content element found, falling back to body.');
      mainContent = $('body');
    }

    // Get text, normalize whitespace, and join lines
    const text = mainContent.text()
      .replace(/\s\s+/g, ' ')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 20) // Filter out short, likely irrelevant lines
      .join('\n');

    console.log(`[ContentService] Cleaning complete. Extracted length: ${text.length}`);
    
    if (text.length > MAX_CONTENT_LENGTH) {
      const truncated = this.smartTruncate(text, MAX_CONTENT_LENGTH);
      console.log(`[ContentService] Content truncated from ${text.length} to ${truncated.length} characters (smart truncate).`);
      return truncated;
    }

    return text;
  }

  /**
   * Truncates text at natural boundaries (paragraph, sentence, word) to avoid cutting context mid-thought.
   */
  private smartTruncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    // Initial hard cut
    const truncated = text.substring(0, maxLength);

    // Priority 1: Cut at the last paragraph break (double newline)
    const lastParagraph = truncated.lastIndexOf('\n\n');
    if (lastParagraph > maxLength * 0.8) {
      return truncated.substring(0, lastParagraph);
    }

    // Priority 2: Cut at the last sentence end (.!?)
    // We look for punctuation followed by space or newline
    const lastSentence = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('! '),
      truncated.lastIndexOf('? '),
      truncated.lastIndexOf('.\n'),
      truncated.lastIndexOf('!\n'),
      truncated.lastIndexOf('?\n')
    );
    
    if (lastSentence > maxLength * 0.8) {
      return truncated.substring(0, lastSentence + 1);
    }

    // Priority 3: Cut at the last space to avoid cutting words
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace);
    }

    // Fallback: Hard cut
    return truncated;
  }

  /**
   * Public method to fetch and clean content from a URL.
   * @param url The URL to process.
   * @returns A promise that resolves to the cleaned page content.
   */
  async fetchAndClean(url: string): Promise<string> {
    try {
      const html = await this.fetchHtml(url);
      const cleanedContent = this.cleanHtml(html);
      return cleanedContent;
    } catch (error) {
      console.error('[ContentService] fetchAndClean failed for:', url, error);
      return '';
    }
  }
}

export const contentService = new ContentService();
