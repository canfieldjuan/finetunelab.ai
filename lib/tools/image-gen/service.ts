/**
 * Image-generation orchestrator: ComfyUI (Flux) primary, Unsplash fallback.
 *
 * Strategy:
 *   1. If COMFYUI_URL is configured, try to generate with Flux and upload the
 *      result to Supabase Storage. On ANY failure (unreachable, GPU OOM while
 *      the LLM holds VRAM, malformed response, upload error) we log and fall
 *      through — generation is best-effort.
 *   2. Otherwise (or on ComfyUI failure) search Unsplash for a stock photo.
 *   3. If neither backend is configured, throw.
 *
 * Backends are operator-configured via env vars, so the URLs are trusted (not
 * the user-supplied SSRF case). Both paths return an http(s) URL — never a
 * data-URI or image content block — so the chat renderer embeds it as markdown.
 */

import { ImageGenError } from './types';
import type { ImageGenOptions, ImageGenResult } from './types';
import { buildFluxWorkflow, FLUX_DEFAULTS } from './flux-workflow';
import { generateWithComfyUi } from './comfyui-client';
import { searchUnsplashImage } from './unsplash-client';
import { uploadGeneratedImage } from './storage';
import type { ImageStorageClient } from './storage';

export interface GenerateImageParams {
  prompt: string;
  userId: string;
  options?: ImageGenOptions;
}

export interface GenerateImageConfig {
  /** Defaults to process.env.COMFYUI_URL. */
  comfyUiUrl?: string;
  /** Defaults to process.env.UNSPLASH_ACCESS_KEY. */
  unsplashAccessKey?: string;
  /** Storage client for the ComfyUI upload; defaults to a service-role client. */
  supabase?: ImageStorageClient;
  /** Injected fetch for testing. */
  fetchImpl?: typeof fetch;
}

/** Lazily resolve a service-role Supabase client (kept out of module scope so
 * the core has no import-time dependency on env/config). */
async function resolveStorageClient(
  injected?: ImageStorageClient,
): Promise<ImageStorageClient> {
  if (injected) return injected;
  const mod = await import('@/lib/supabase/server-client');
  return mod.createServerClient() as unknown as ImageStorageClient;
}

async function generateViaComfyUi(
  prompt: string,
  params: GenerateImageParams,
  config: GenerateImageConfig,
  comfyUiUrl: string,
): Promise<ImageGenResult> {
  const workflow = buildFluxWorkflow({
    prompt,
    width: params.options?.width,
    height: params.options?.height,
    seed: params.options?.seed,
    steps: params.options?.steps,
  });

  const image = await generateWithComfyUi(workflow, {
    baseUrl: comfyUiUrl,
    fetchImpl: config.fetchImpl,
  });

  const supabase = await resolveStorageClient(config.supabase);
  const url = await uploadGeneratedImage({
    supabase,
    userId: params.userId,
    imageBytes: image.imageBytes,
    contentType: image.mimeType,
  });

  return {
    url,
    source: 'comfyui',
    prompt,
    width: params.options?.width ?? FLUX_DEFAULTS.width,
    height: params.options?.height ?? FLUX_DEFAULTS.height,
  };
}

/**
 * Produce an image URL for `prompt`, preferring local Flux generation and
 * falling back to an Unsplash stock photo. Throws {@link ImageGenError} only
 * when no backend can satisfy the request.
 */
export async function generateImage(
  params: GenerateImageParams,
  config: GenerateImageConfig = {},
): Promise<ImageGenResult> {
  const prompt = params.prompt?.trim();
  if (!prompt) {
    throw new ImageGenError('generateImage: prompt is required', 400);
  }

  const comfyUiUrl = config.comfyUiUrl ?? process.env.COMFYUI_URL;
  const unsplashAccessKey = config.unsplashAccessKey ?? process.env.UNSPLASH_ACCESS_KEY;

  let comfyError: unknown;
  if (comfyUiUrl) {
    try {
      return await generateViaComfyUi(prompt, params, config, comfyUiUrl);
    } catch (err) {
      comfyError = err;
      console.warn(
        `[image-gen] ComfyUI generation failed, falling back to Unsplash: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  if (unsplashAccessKey) {
    return searchUnsplashImage(
      prompt,
      { accessKey: unsplashAccessKey, fetchImpl: config.fetchImpl },
      params.options,
    );
  }

  // No fallback available: surface the ComfyUI error if there was one.
  if (comfyError) {
    throw comfyError instanceof Error ? comfyError : new ImageGenError(String(comfyError));
  }
  throw new ImageGenError(
    'No image backend configured (set COMFYUI_URL and/or UNSPLASH_ACCESS_KEY)',
    503,
  );
}
