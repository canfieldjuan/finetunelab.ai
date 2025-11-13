import axios from 'axios';
import * as cheerio from 'cheerio';

const AXIOS_CONFIG = {
  timeout: 10000, // 10-second timeout
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  },
};

const MAX_CONTENT_LENGTH = 15000; // Limit content to ~15k characters to avoid excessive token usage

export class ContentService {
  /**
   * Fetches the raw HTML content of a given URL.
   * @param url The URL to fetch.
   * @returns The HTML content as a string.
   */
  private async fetchHtml(url: string): Promise<string> {
    try {
      console.log(`[ContentService] Fetching URL: ${url}`);
      const response = await axios.get(url, AXIOS_CONFIG);
      if (response.status !== 200) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      console.log(`[ContentService] Successfully fetched URL: ${url}`);
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ContentService] Error fetching ${url}: ${message}`);
      throw new Error(`Failed to fetch content from ${url}.`);
    }
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
      console.log(`[ContentService] Content truncated from ${text.length} to ${MAX_CONTENT_LENGTH} characters.`);
      return text.substring(0, MAX_CONTENT_LENGTH);
    }

    return text;
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
