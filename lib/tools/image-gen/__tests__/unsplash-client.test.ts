import { describe, it, expect, vi } from 'vitest';
import { searchUnsplashImage } from '../unsplash-client';
import { UnsplashError } from '../types';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const photo = {
  urls: { regular: 'https://images.unsplash.com/photo-1.jpg', full: 'https://x/full.jpg' },
  links: { html: 'https://unsplash.com/photos/abc', download_location: 'https://api.unsplash.com/photos/abc/download' },
  user: { name: 'Jane Doe', links: { html: 'https://unsplash.com/@jane' } },
  width: 4000,
  height: 3000,
};

describe('searchUnsplashImage', () => {
  it('returns the first photo with full attribution and fires the download trigger', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes('/search/photos')) return jsonResponse({ total: 1, results: [photo] });
      return jsonResponse({}); // download_location trigger
    });

    const result = await searchUnsplashImage('mountains', { accessKey: 'KEY', fetchImpl });

    expect(result.source).toBe('unsplash');
    expect(result.url).toBe('https://images.unsplash.com/photo-1.jpg');
    expect(result.attribution?.authorName).toBe('Jane Doe');
    expect(result.attribution?.authorUrl).toContain('utm_source=finetunelab');
    expect(result.attribution?.authorUrl).toContain('utm_medium=referral');
    expect(result.attribution?.sourceName).toBe('Unsplash');
    expect(result.attribution?.sourceUrl).toContain('utm_source=finetunelab');

    // Download tracking endpoint was hit (Unsplash Terms requirement).
    const dl = fetchImpl.mock.calls.find((c) => String(c[0]).includes('/download'));
    expect(dl).toBeDefined();
  });

  it('sends a Client-ID auth header', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ results: [photo] }));
    await searchUnsplashImage('x', { accessKey: 'SECRET', fetchImpl });
    const init = fetchImpl.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>).Authorization).toBe('Client-ID SECRET');
  });

  it('passes an orientation derived from requested dimensions', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ results: [photo] }));
    await searchUnsplashImage('x', { accessKey: 'KEY', fetchImpl }, { width: 1600, height: 900 });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('orientation=landscape');
  });

  it('throws UnsplashError on a non-200 response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ errors: ['bad'] }, 401));
    await expect(
      searchUnsplashImage('x', { accessKey: 'KEY', fetchImpl }),
    ).rejects.toBeInstanceOf(UnsplashError);
  });

  it('throws when no results match', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ total: 0, results: [] }));
    await expect(
      searchUnsplashImage('zzz', { accessKey: 'KEY', fetchImpl }),
    ).rejects.toThrow(/No Unsplash photo found/);
  });

  it('throws when the access key is missing', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ results: [photo] }));
    await expect(
      searchUnsplashImage('x', { accessKey: '', fetchImpl }),
    ).rejects.toThrow(/access key not configured/);
  });
});
