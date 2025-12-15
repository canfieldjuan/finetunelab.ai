/**
 * Safe JSON parsing utilities for handling truncated responses under load
 *
 * When the server is under heavy load, HTTP connections may close before
 * the full response body is received. This causes response.json() to throw
 * "Unexpected end of JSON input" errors.
 *
 * These utilities gracefully handle such cases by returning fallback values.
 */

/**
 * Safely parse JSON from a fetch Response, returning a fallback on failure
 *
 * @param response - The fetch Response object
 * @param fallback - Value to return if parsing fails
 * @returns Parsed JSON or fallback value
 *
 * @example
 * const data = await safeJsonParse(response, { items: [] });
 */
export async function safeJsonParse<T>(response: Response, fallback: T): Promise<T> {
  try {
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      console.warn('[safeJsonParse] Empty response body');
      return fallback;
    }
    return JSON.parse(text) as T;
  } catch (err) {
    console.error('[safeJsonParse] JSON parse error:', err);
    return fallback;
  }
}

/**
 * Safely parse JSON from a fetch Response, throwing on failure with better error message
 *
 * @param response - The fetch Response object
 * @param context - Description of what was being fetched (for error messages)
 * @returns Parsed JSON
 * @throws Error with context if parsing fails
 *
 * @example
 * const data = await safeJsonParseOrThrow(response, 'fetching user data');
 */
export async function safeJsonParseOrThrow<T>(response: Response, context: string): Promise<T> {
  try {
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error(`Empty response while ${context}`);
    }
    return JSON.parse(text) as T;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON response while ${context}: ${err.message}`);
    }
    throw err;
  }
}
