/**
 * Persist a generated image to Supabase Storage and return a signed URL.
 *
 * Mirrors the repo's existing Storage usage (e.g. lib/storage/export-storage.ts):
 * `client.storage.from(bucket).upload(...)` then `.createSignedUrl(...)`.
 *
 * The Supabase client is INJECTED (a minimal structural type) so the core stays
 * pure and unit-testable; the wiring slice passes a real service-role client.
 * Images are namespaced per user (`<userId>/<uuid>.<ext>`) so bucket RLS can
 * restrict access to the owner.
 */

import { randomUUID } from 'crypto';
import { ImageStorageError } from './types';

/** Bucket holding chat-generated images (created by a migration in the wiring slice). */
export const CHAT_IMAGES_BUCKET = 'chat-images';

/** Default signed-URL lifetime: 7 days. */
const DEFAULT_SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7;

interface StorageUploadResult {
  data: { path: string } | null;
  error: { message: string } | null;
}

interface StorageSignedUrlResult {
  data: { signedUrl: string } | null;
  error: { message: string } | null;
}

interface StorageBucketApi {
  upload(
    path: string,
    body: Uint8Array | ArrayBuffer | Buffer,
    options?: { contentType?: string; upsert?: boolean },
  ): Promise<StorageUploadResult>;
  createSignedUrl(path: string, expiresIn: number): Promise<StorageSignedUrlResult>;
}

/** Minimal slice of a Supabase client this module needs. */
export interface ImageStorageClient {
  storage: { from(bucket: string): StorageBucketApi };
}

export interface UploadImageParams {
  supabase: ImageStorageClient;
  userId: string;
  imageBytes: Uint8Array;
  /** MIME type, e.g. 'image/png'. */
  contentType?: string;
  /** File extension without the dot, e.g. 'png'. */
  fileExtension?: string;
  signedUrlExpiresInSec?: number;
  bucket?: string;
}

function extensionFor(contentType?: string, explicit?: string): string {
  if (explicit) return explicit.replace(/^\./, '');
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/png':
    default:
      return 'png';
  }
}

/**
 * Upload `imageBytes` and return a signed URL. Throws {@link ImageStorageError}
 * if the upload or signing step fails.
 */
export async function uploadGeneratedImage(params: UploadImageParams): Promise<string> {
  const {
    supabase,
    userId,
    imageBytes,
    contentType = 'image/png',
    fileExtension,
    signedUrlExpiresInSec = DEFAULT_SIGNED_URL_TTL_SEC,
    bucket = CHAT_IMAGES_BUCKET,
  } = params;

  if (!userId) {
    throw new ImageStorageError('uploadGeneratedImage: userId is required', 400);
  }

  const ext = extensionFor(contentType, fileExtension);
  const path = `${userId}/${randomUUID()}.${ext}`;
  const store = supabase.storage.from(bucket);

  const uploadResult = await store.upload(path, imageBytes, { contentType, upsert: false });
  if (uploadResult.error) {
    throw new ImageStorageError(`Failed to upload image: ${uploadResult.error.message}`);
  }

  const signed = await store.createSignedUrl(path, signedUrlExpiresInSec);
  if (signed.error || !signed.data?.signedUrl) {
    throw new ImageStorageError(
      `Failed to sign image URL: ${signed.error?.message ?? 'no URL returned'}`,
    );
  }

  return signed.data.signedUrl;
}
