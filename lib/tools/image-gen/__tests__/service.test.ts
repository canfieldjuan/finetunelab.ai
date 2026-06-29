import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ImageStorageClient } from '../storage';
import type { ImageGenResult } from '../types';

const { generateWithComfyUi, searchUnsplashImage, uploadGeneratedImage } = vi.hoisted(() => ({
  generateWithComfyUi: vi.fn(),
  searchUnsplashImage: vi.fn(),
  uploadGeneratedImage: vi.fn(),
}));

vi.mock('../comfyui-client', () => ({ generateWithComfyUi }));
vi.mock('../unsplash-client', () => ({ searchUnsplashImage }));
vi.mock('../storage', () => ({ uploadGeneratedImage, CHAT_IMAGES_BUCKET: 'chat-images' }));

import { generateImage } from '../service';
import { ImageGenError, ComfyUiError } from '../types';

const dummySupabase = {} as unknown as ImageStorageClient;

const comfyImage = { imageBytes: new Uint8Array([1, 2]), filename: 'g.png', mimeType: 'image/png' };
const unsplashResult: ImageGenResult = {
  url: 'https://images.unsplash.com/x.jpg',
  source: 'unsplash',
  prompt: 'a cat',
  attribution: {
    authorName: 'Jane',
    authorUrl: 'https://unsplash.com/@jane?utm_source=finetunelab&utm_medium=referral',
    sourceName: 'Unsplash',
    sourceUrl: 'https://unsplash.com/?utm_source=finetunelab&utm_medium=referral',
  },
};

describe('generateImage orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('COMFYUI_URL', '');
    vi.stubEnv('UNSPLASH_ACCESS_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses ComfyUI and uploads when it succeeds', async () => {
    generateWithComfyUi.mockResolvedValue(comfyImage);
    uploadGeneratedImage.mockResolvedValue('https://signed.example/g.png');

    const result = await generateImage(
      { prompt: 'a cat', userId: 'u-1' },
      { comfyUiUrl: 'http://127.0.0.1:8188', supabase: dummySupabase },
    );

    expect(result.source).toBe('comfyui');
    expect(result.url).toBe('https://signed.example/g.png');
    expect(generateWithComfyUi).toHaveBeenCalledTimes(1);
    expect(uploadGeneratedImage).toHaveBeenCalledTimes(1);
    expect(searchUnsplashImage).not.toHaveBeenCalled();
  });

  it('falls back to Unsplash when ComfyUI fails', async () => {
    generateWithComfyUi.mockRejectedValue(new ComfyUiError('CUDA out of memory'));
    searchUnsplashImage.mockResolvedValue(unsplashResult);

    const result = await generateImage(
      { prompt: 'a cat', userId: 'u-1' },
      { comfyUiUrl: 'http://127.0.0.1:8188', unsplashAccessKey: 'KEY', supabase: dummySupabase },
    );

    expect(generateWithComfyUi).toHaveBeenCalledTimes(1);
    expect(searchUnsplashImage).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('unsplash');
    expect(result.attribution?.authorName).toBe('Jane');
  });

  it('uses Unsplash directly when ComfyUI is not configured', async () => {
    searchUnsplashImage.mockResolvedValue(unsplashResult);

    const result = await generateImage({ prompt: 'a cat', userId: 'u-1' }, { unsplashAccessKey: 'KEY' });

    expect(generateWithComfyUi).not.toHaveBeenCalled();
    expect(result.source).toBe('unsplash');
  });

  it('surfaces the ComfyUI error when there is no Unsplash fallback', async () => {
    generateWithComfyUi.mockRejectedValue(new ComfyUiError('boom'));
    await expect(
      generateImage(
        { prompt: 'a cat', userId: 'u-1' },
        { comfyUiUrl: 'http://127.0.0.1:8188', supabase: dummySupabase },
      ),
    ).rejects.toBeInstanceOf(ComfyUiError);
    expect(searchUnsplashImage).not.toHaveBeenCalled();
  });

  it('throws when no backend is configured', async () => {
    await expect(generateImage({ prompt: 'a cat', userId: 'u-1' }, {})).rejects.toThrow(
      /No image backend configured/,
    );
  });

  it('rejects an empty prompt before touching any backend', async () => {
    await expect(
      generateImage({ prompt: '   ', userId: 'u-1' }, { unsplashAccessKey: 'KEY' }),
    ).rejects.toBeInstanceOf(ImageGenError);
    expect(searchUnsplashImage).not.toHaveBeenCalled();
  });
});
