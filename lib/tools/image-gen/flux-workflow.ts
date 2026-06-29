/**
 * Builds a ComfyUI "API format" prompt graph for Flux.1-dev (Q8 GGUF).
 *
 * The graph is keyed by string node ids; each node is `{ class_type, inputs }`
 * and edges are `[sourceNodeId, outputIndex]` tuples — exactly the shape
 * ComfyUI's `POST /prompt` accepts (the "Save (API Format)" export).
 *
 * The default model filenames match the operator's local ComfyUI install:
 *   models/unet/flux1-dev-Q8_0.gguf      (ComfyUI-GGUF UnetLoaderGGUF)
 *   models/vae/ae.safetensors
 *   models/clip/clip_l.safetensors
 *   models/clip/t5xxl_fp8_e4m3fn.safetensors
 *
 * NOTE: this graph is authored from the known model filenames and the standard
 * Flux-dev GGUF node layout; it has NOT yet been executed against a running
 * ComfyUI instance (the GPU is otherwise occupied). Verify node availability
 * (UnetLoaderGGUF, DualCLIPLoader type:'flux', FluxGuidance, EmptySD3LatentImage)
 * against a live instance before relying on it in production.
 */

/** A single node in the API-format graph. */
export interface ComfyWorkflowNode {
  class_type: string;
  inputs: Record<string, unknown>;
}

/** The full API-format graph: node id -> node. */
export type ComfyWorkflow = Record<string, ComfyWorkflowNode>;

export interface FluxWorkflowParams {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  /** Flux guidance scale (distilled guidance, not CFG). */
  guidance?: number;
  /** Override model filenames (defaults match the local install). */
  unetName?: string;
  vaeName?: string;
  clipNameT5?: string;
  clipNameL?: string;
  /** Prefix for SaveImage output filenames. */
  filenamePrefix?: string;
}

export const FLUX_DEFAULTS = {
  unetName: 'flux1-dev-Q8_0.gguf',
  vaeName: 'ae.safetensors',
  clipNameT5: 't5xxl_fp8_e4m3fn.safetensors',
  clipNameL: 'clip_l.safetensors',
  width: 1024,
  height: 1024,
  steps: 20,
  guidance: 3.5,
  filenamePrefix: 'finetunelab',
} as const;

/**
 * Construct the Flux.1-dev GGUF text-to-image workflow.
 * Flux runs with cfg=1.0 (negative conditioning is inert) and uses
 * FluxGuidance for prompt adherence, so the negative prompt is an empty encode.
 */
export function buildFluxWorkflow(params: FluxWorkflowParams): ComfyWorkflow {
  const prompt = params.prompt?.trim();
  if (!prompt) {
    throw new Error('buildFluxWorkflow: prompt is required');
  }

  const width = params.width ?? FLUX_DEFAULTS.width;
  const height = params.height ?? FLUX_DEFAULTS.height;
  const steps = params.steps ?? FLUX_DEFAULTS.steps;
  const seed = params.seed ?? 0;
  const guidance = params.guidance ?? FLUX_DEFAULTS.guidance;
  const unetName = params.unetName ?? FLUX_DEFAULTS.unetName;
  const vaeName = params.vaeName ?? FLUX_DEFAULTS.vaeName;
  const clipNameT5 = params.clipNameT5 ?? FLUX_DEFAULTS.clipNameT5;
  const clipNameL = params.clipNameL ?? FLUX_DEFAULTS.clipNameL;
  const filenamePrefix = params.filenamePrefix ?? FLUX_DEFAULTS.filenamePrefix;

  return {
    unet: {
      class_type: 'UnetLoaderGGUF',
      inputs: { unet_name: unetName },
    },
    clip: {
      class_type: 'DualCLIPLoader',
      inputs: { clip_name1: clipNameT5, clip_name2: clipNameL, type: 'flux' },
    },
    vae: {
      class_type: 'VAELoader',
      inputs: { vae_name: vaeName },
    },
    positive: {
      class_type: 'CLIPTextEncode',
      inputs: { text: prompt, clip: ['clip', 0] },
    },
    guidance: {
      class_type: 'FluxGuidance',
      inputs: { guidance, conditioning: ['positive', 0] },
    },
    negative: {
      class_type: 'CLIPTextEncode',
      inputs: { text: '', clip: ['clip', 0] },
    },
    latent: {
      class_type: 'EmptySD3LatentImage',
      inputs: { width, height, batch_size: 1 },
    },
    sampler: {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps,
        cfg: 1.0,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1.0,
        model: ['unet', 0],
        positive: ['guidance', 0],
        negative: ['negative', 0],
        latent_image: ['latent', 0],
      },
    },
    decode: {
      class_type: 'VAEDecode',
      inputs: { samples: ['sampler', 0], vae: ['vae', 0] },
    },
    save: {
      class_type: 'SaveImage',
      inputs: { images: ['decode', 0], filename_prefix: filenamePrefix },
    },
  };
}

/** The node id whose outputs hold the saved image(s). */
export const SAVE_IMAGE_NODE_ID = 'save';
