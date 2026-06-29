/**
 * Unsplash stock-photo search — the FREE fallback when ComfyUI can't generate
 * (e.g. the GPU is busy serving the LLM, or ComfyUI isn't running).
 *
 * IMPORTANT: this is image *search*, not generation — results are labelled
 * accordingly upstream. The Unsplash API Terms require, on use of a photo:
 *   1. triggering the photo's `download_location` endpoint, and
 *   2. crediting the photographer + linking back to Unsplash, both with UTM
 *      params (utm_source=<app>&utm_medium=referral).
 * Both are handled here.
 */

import { UnsplashError } from './types';
import type { ImageGenOptions, ImageGenResult } from './types';

export interface UnsplashClientOptions {
  /** Unsplash API access key (Client-ID). */
  accessKey: string;
  /** Injected fetch (defaults to global fetch); enables testing. */
  fetchImpl?: typeof fetch;
  /** UTM source label appended to attribution links per Unsplash Terms. */
  appName?: string;
}

const UNSPLASH_API = 'https://api.unsplash.com';
const DEFAULT_APP_NAME = 'finetunelab';
/** Upper bound on the best-effort download-tracking call (never blocks delivery). */
const DOWNLOAD_TRIGGER_TIMEOUT_MS = 3000;

interface UnsplashPhoto {
  urls: { regular?: string; full?: string; small?: string };
  links: { html?: string; download_location?: string };
  user: { name?: string; links?: { html?: string } };
  width?: number;
  height?: number;
}

function utm(appName: string): string {
  return `utm_source=${encodeURIComponent(appName)}&utm_medium=referral`;
}

/** Append the required UTM params to an Unsplash link (preserving existing query). */
function withUtm(rawUrl: string, appName: string): string {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set('utm_source', appName);
    url.searchParams.set('utm_medium', 'referral');
    return url.toString();
  } catch {
    const sep = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${sep}${utm(appName)}`;
  }
}

function orientationFor(options?: ImageGenOptions): 'landscape' | 'portrait' | 'squarish' | undefined {
  if (!options?.width || !options?.height) return undefined;
  const ratio = options.width / options.height;
  if (ratio > 1.15) return 'landscape';
  if (ratio < 0.87) return 'portrait';
  return 'squarish';
}

function isUnsplashPhoto(value: unknown): value is UnsplashPhoto {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.urls === 'object' && v.urls !== null &&
    typeof v.links === 'object' && v.links !== null &&
    typeof v.user === 'object' && v.user !== null
  );
}

function firstResult(body: unknown): UnsplashPhoto | null {
  if (typeof body !== 'object' || body === null) return null;
  const results = (body as Record<string, unknown>).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const first = results[0];
  return isUnsplashPhoto(first) ? first : null;
}

/**
 * Search Unsplash for a photo matching `query` and return the first match as an
 * {@link ImageGenResult} with full attribution. Throws {@link UnsplashError} on
 * auth/HTTP failure or when no photo matches.
 */
export async function searchUnsplashImage(
  query: string,
  options: UnsplashClientOptions,
  genOptions?: ImageGenOptions,
): Promise<ImageGenResult> {
  const { accessKey, fetchImpl = fetch, appName = DEFAULT_APP_NAME } = options;
  if (!accessKey) {
    throw new UnsplashError('Unsplash access key not configured', 500);
  }

  const searchUrl = new URL(`${UNSPLASH_API}/search/photos`);
  searchUrl.searchParams.set('query', query);
  searchUrl.searchParams.set('per_page', '1');
  searchUrl.searchParams.set('content_filter', 'high');
  const orientation = orientationFor(genOptions);
  if (orientation) searchUrl.searchParams.set('orientation', orientation);

  const headers = { Authorization: `Client-ID ${accessKey}` };

  let res: Response;
  try {
    res = await fetchImpl(searchUrl.toString(), { headers });
  } catch (err) {
    throw new UnsplashError(
      `Unsplash request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new UnsplashError(`Unsplash search returned ${res.status}`, res.status);
  }

  const body: unknown = await res.json();
  const photo = firstResult(body);
  if (!photo) {
    throw new UnsplashError(`No Unsplash photo found for "${query}"`, 404);
  }

  const imageUrl = photo.urls.regular ?? photo.urls.full ?? photo.urls.small;
  if (!imageUrl) {
    throw new UnsplashError('Unsplash photo missing a usable URL', 502);
  }

  // Per Unsplash Terms: fire the download tracking endpoint. This is
  // fire-and-forget AND time-bounded so a slow/never-completing tracking call
  // can never block delivery of the already-selected image.
  const downloadLocation = photo.links.download_location;
  if (downloadLocation) {
    void fetchImpl(downloadLocation, {
      headers,
      signal: AbortSignal.timeout(DOWNLOAD_TRIGGER_TIMEOUT_MS),
    }).catch(() => {
      // tracking is non-fatal
    });
  }

  const authorUrl = photo.user.links?.html
    ? withUtm(photo.user.links.html, appName)
    : `https://unsplash.com/?${utm(appName)}`;

  return {
    url: imageUrl,
    source: 'unsplash',
    prompt: query,
    width: photo.width,
    height: photo.height,
    attribution: {
      authorName: photo.user.name ?? 'Unsplash photographer',
      authorUrl,
      sourceName: 'Unsplash',
      sourceUrl: `https://unsplash.com/?${utm(appName)}`,
    },
  };
}
