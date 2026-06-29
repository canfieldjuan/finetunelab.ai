import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateImage } from '../service';
import { ImageGenError, ComfyUiError, ImageStorageError } from '../types';
import type { ImageStorageClient } from '../storage';

// These tests run the REAL comfyui-client / unsplash-client / storage modules
// through generateImage, faking only the external boundaries (fetch + Supabase).

const COMFY = 'http://127.0.0.1:8188';
const PROMPT_ID = 'job-1';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const historyDone = {
  [PROMPT_ID]: {
    outputs: { save: { images: [{ filename: 'g.png', subfolder: '', type: 'output' }] } },
  },
};

const unsplashBody = {
  total: 1,
  results: [
    {
      urls: { regular: 'https://images.unsplash.com/x.jpg' },
      links: { html: 'https://unsplash.com/photos/x', download_location: 'https://api.unsplash.com/photos/x/download' },
      user: { name: 'Jane', links: { html: 'https://unsplash.com/@jane' } },
      width: 100,
      height: 100,
    },
  ],
};

function makeSupabase(opts?: { uploadError?: { message: string }; signedUrl?: string | null }) {
  const upload = vi.fn(async () => ({ data: { path: 'p' }, error: opts?.uploadError ?? null }));
  const createSignedUrl = vi.fn(async () => ({
    data: opts?.signedUrl === null ? null : { signedUrl: opts?.signedUrl ?? 'https://signed/img.png' },
    error: null,
  }));
  const client = {
    storage: { from: vi.fn(() => ({ upload, createSignedUrl })) },
  } as unknown as ImageStorageClient;
  return { client, upload };
}

/** Full happy-path router: ComfyUI generates, Unsplash also available. */
function fullFetch() {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.endsWith('/prompt')) return jsonResponse({ prompt_id: PROMPT_ID });
    if (url.includes('/history/')) return jsonResponse(historyDone);
    if (url.includes('/view')) return new Response(new Uint8Array([1, 2]), { status: 200 });
    if (url.includes('/search/photos')) return jsonResponse(unsplashBody);
    if (url.includes('/download')) return jsonResponse({});
    throw new Error(`unexpected url ${url}`);
  });
}

const hitSearch = (f: ReturnType<typeof fullFetch>) =>
  f.mock.calls.some((c) => String(c[0]).includes('/search/photos'));

describe('generateImage (real collaborators, faked fetch + Supabase)', () => {
  beforeEach(() => {
    vi.stubEnv('COMFYUI_URL', '');
    vi.stubEnv('UNSPLASH_ACCESS_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('generates via ComfyUI and uploads to storage', async () => {
    const fetchImpl = fullFetch();
    const { client, upload } = makeSupabase();

    const result = await generateImage(
      { prompt: 'a cat', userId: 'u1', options: { steps: 4 } },
      { comfyUiUrl: COMFY, supabase: client, fetchImpl },
    );

    expect(result.source).toBe('comfyui');
    expect(result.url).toBe('https://signed/img.png');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(hitSearch(fetchImpl)).toBe(false); // never fell back
  });

  it('falls back to Unsplash when ComfyUI generation fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/prompt')) return jsonResponse({}, 500);
      if (url.includes('/search/photos')) return jsonResponse(unsplashBody);
      if (url.includes('/download')) return jsonResponse({});
      throw new Error(`unexpected url ${url}`);
    });
    const { client } = makeSupabase();

    const result = await generateImage(
      { prompt: 'a cat', userId: 'u1' },
      { comfyUiUrl: COMFY, unsplashAccessKey: 'KEY', supabase: client, fetchImpl },
    );

    expect(result.source).toBe('unsplash');
    expect(result.attribution?.authorName).toBe('Jane');
  });

  it('uses Unsplash directly when ComfyUI is not configured', async () => {
    const fetchImpl = fullFetch();
    const result = await generateImage(
      { prompt: 'a cat', userId: 'u1' },
      { unsplashAccessKey: 'KEY', fetchImpl },
    );
    expect(result.source).toBe('unsplash');
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).endsWith('/prompt'))).toBe(false);
  });

  it('propagates a storage failure rather than degrading a generated image to a stock photo', async () => {
    const fetchImpl = fullFetch();
    const { client } = makeSupabase({ uploadError: { message: 'bucket missing' } });

    await expect(
      generateImage(
        { prompt: 'a cat', userId: 'u1' },
        { comfyUiUrl: COMFY, unsplashAccessKey: 'KEY', supabase: client, fetchImpl },
      ),
    ).rejects.toBeInstanceOf(ImageStorageError);

    expect(hitSearch(fetchImpl)).toBe(false); // did NOT fall back to a stock photo
  });

  it('surfaces the ComfyUI error when there is no Unsplash fallback', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).endsWith('/prompt')) return jsonResponse({}, 500);
      throw new Error('unexpected');
    });
    const { client } = makeSupabase();

    await expect(
      generateImage({ prompt: 'a cat', userId: 'u1' }, { comfyUiUrl: COMFY, supabase: client, fetchImpl }),
    ).rejects.toBeInstanceOf(ComfyUiError);
  });

  it('throws when no backend is configured', async () => {
    await expect(generateImage({ prompt: 'a cat', userId: 'u1' }, {})).rejects.toThrow(
      /No image backend configured/,
    );
  });

  it('rejects an empty prompt before any backend call', async () => {
    const fetchImpl = fullFetch();
    await expect(
      generateImage({ prompt: '   ', userId: 'u1' }, { unsplashAccessKey: 'KEY', fetchImpl }),
    ).rejects.toBeInstanceOf(ImageGenError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
