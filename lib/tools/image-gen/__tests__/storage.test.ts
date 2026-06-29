import { describe, it, expect, vi } from 'vitest';
import { uploadGeneratedImage, CHAT_IMAGES_BUCKET } from '../storage';
import { ImageStorageError } from '../types';
import type { ImageStorageClient } from '../storage';

function makeClient(overrides?: {
  uploadError?: { message: string } | null;
  signError?: { message: string } | null;
  signedUrl?: string | null;
}) {
  const upload = vi.fn<
    (
      path: string,
      body: Uint8Array | ArrayBuffer | Buffer,
      opts?: { contentType?: string; upsert?: boolean },
    ) => Promise<{ data: { path: string } | null; error: { message: string } | null }>
  >(async (path) => ({
    data: { path },
    error: overrides?.uploadError ?? null,
  }));
  const createSignedUrl = vi.fn(async () => ({
    data:
      overrides?.signedUrl === null
        ? null
        : { signedUrl: overrides?.signedUrl ?? 'https://signed.example/img.png' },
    error: overrides?.signError ?? null,
  }));
  const from = vi.fn(() => ({ upload, createSignedUrl }));
  const client: ImageStorageClient = { storage: { from } };
  return { client, from, upload, createSignedUrl };
}

const bytes = new Uint8Array([1, 2, 3]);

describe('uploadGeneratedImage', () => {
  it('uploads under a per-user path and returns a signed URL + the storage path', async () => {
    const { client, from, upload } = makeClient();
    const result = await uploadGeneratedImage({ supabase: client, userId: 'user-42', imageBytes: bytes });

    expect(result.signedUrl).toBe('https://signed.example/img.png');
    expect(result.path).toMatch(/^user-42\/[0-9a-f-]+\.png$/);
    expect(from).toHaveBeenCalledWith(CHAT_IMAGES_BUCKET);

    const [path, body, opts] = upload.mock.calls[0];
    expect(result.path).toBe(path); // returned path matches what was uploaded
    expect(body).toBe(bytes);
    expect(opts).toMatchObject({ contentType: 'image/png', upsert: false });
  });

  it('uses the extension matching the content type', async () => {
    const { client, upload } = makeClient();
    await uploadGeneratedImage({
      supabase: client,
      userId: 'u',
      imageBytes: bytes,
      contentType: 'image/jpeg',
    });
    expect(String(upload.mock.calls[0][0])).toMatch(/\.jpg$/);
  });

  it('throws ImageStorageError when the upload fails', async () => {
    const { client } = makeClient({ uploadError: { message: 'quota exceeded' } });
    await expect(
      uploadGeneratedImage({ supabase: client, userId: 'u', imageBytes: bytes }),
    ).rejects.toThrow(/quota exceeded/);
  });

  it('throws when signing fails', async () => {
    const { client } = makeClient({ signError: { message: 'no perms' } });
    await expect(
      uploadGeneratedImage({ supabase: client, userId: 'u', imageBytes: bytes }),
    ).rejects.toBeInstanceOf(ImageStorageError);
  });

  it('throws when no signed URL is returned', async () => {
    const { client } = makeClient({ signedUrl: null });
    await expect(
      uploadGeneratedImage({ supabase: client, userId: 'u', imageBytes: bytes }),
    ).rejects.toThrow(/Failed to sign/);
  });

  it('requires a userId', async () => {
    const { client } = makeClient();
    await expect(
      uploadGeneratedImage({ supabase: client, userId: '', imageBytes: bytes }),
    ).rejects.toThrow(/userId is required/);
  });
});
