/**
 * Shared types and errors for the image-generation service core.
 *
 * The service produces an http(s) image URL from a text prompt using a local
 * ComfyUI/Flux backend when available, falling back to an Unsplash stock-photo
 * search. Results are always delivered as plain URLs (never data-URIs / image
 * content blocks) so a downstream chat renderer can embed them as markdown text.
 */

/** Which backend produced the image. */
export type ImageSource = 'comfyui' | 'unsplash';

/**
 * Attribution metadata. Required for Unsplash results (their API Terms mandate
 * crediting the photographer and linking back to Unsplash with UTM params).
 * ComfyUI-generated images have no attribution.
 */
export interface ImageAttribution {
  /** Human-readable credit, e.g. the photographer's name. */
  authorName: string;
  /** Link to the author's profile, with required UTM params. */
  authorUrl: string;
  /** Source platform label, e.g. 'Unsplash'. */
  sourceName: string;
  /** Link to the source platform, with required UTM params. */
  sourceUrl: string;
}

/** Result of a successful image request. */
export interface ImageGenResult {
  /** http(s) URL to the image (Supabase signed URL for ComfyUI, CDN URL for Unsplash). */
  url: string;
  /** Which backend produced it. */
  source: ImageSource;
  /** The prompt/query used (also serves as alt text downstream). */
  prompt: string;
  /** Pixel dimensions when known (Unsplash returns its own dimensions). */
  width?: number;
  height?: number;
  /** Present for Unsplash results; absent for generated images. */
  attribution?: ImageAttribution;
}

/** Caller-tunable generation options (sane defaults applied per backend). */
export interface ImageGenOptions {
  width?: number;
  height?: number;
  /** Deterministic seed for ComfyUI; ignored by Unsplash. */
  seed?: number;
  /** Sampling steps for ComfyUI; ignored by Unsplash. */
  steps?: number;
}

/** Base error for the image-gen service. */
export class ImageGenError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'ImageGenError';
    this.statusCode = statusCode;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/** A ComfyUI generation failed (unreachable, OOM, malformed response, etc.). */
export class ComfyUiError extends ImageGenError {
  constructor(message: string, statusCode = 502) {
    super(message, statusCode);
    this.name = 'ComfyUiError';
  }
}

/** An Unsplash search failed (auth, rate limit, no results, etc.). */
export class UnsplashError extends ImageGenError {
  constructor(message: string, statusCode = 502) {
    super(message, statusCode);
    this.name = 'UnsplashError';
  }
}

/** Uploading a generated image to Supabase Storage failed. */
export class ImageStorageError extends ImageGenError {
  constructor(message: string, statusCode = 500) {
    super(message, statusCode);
    this.name = 'ImageStorageError';
  }
}
