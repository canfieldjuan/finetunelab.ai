/** Image-generation service core (ComfyUI/Flux primary, Unsplash fallback). */

export { generateImage } from './service';
export type { GenerateImageParams, GenerateImageConfig } from './service';
export {
  ImageGenError,
  ComfyUiError,
  UnsplashError,
  ImageStorageError,
} from './types';
export type {
  ImageSource,
  ImageAttribution,
  ImageGenResult,
  ImageGenOptions,
} from './types';
export { buildFluxWorkflow, FLUX_DEFAULTS, SAVE_IMAGE_NODE_ID } from './flux-workflow';
export type { ComfyWorkflow, ComfyWorkflowNode, FluxWorkflowParams } from './flux-workflow';
export { generateWithComfyUi } from './comfyui-client';
export type { ComfyUiClientOptions, ComfyUiImage } from './comfyui-client';
export { searchUnsplashImage } from './unsplash-client';
export type { UnsplashClientOptions } from './unsplash-client';
export { uploadGeneratedImage, CHAT_IMAGES_BUCKET } from './storage';
export type { ImageStorageClient, UploadImageParams } from './storage';
