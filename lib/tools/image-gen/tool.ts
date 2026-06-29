/**
 * `generate_image` portal tool.
 *
 * Async by design (like web_search's deep-research branch): it creates an
 * image_jobs row, fires the background runner forget-style, and returns a
 * "started" payload with the jobId — so the chat request returns fast instead
 * of blocking on a ~30s generation. The finished image is delivered to the UI
 * in slice 3iii (SSE + render).
 *
 * Gated by `TOOL_IMAGE_GEN_ENABLED` (off by default) via {@link imageGenConfig}.
 */

import type { ToolDefinition } from '../types';
import { imageGenConfig } from '../config';
import { imageJobService } from './image-job-service';
import type { ImageGenOptions } from './types';

const generateImageTool: ToolDefinition = {
  name: 'generate_image',
  description:
    'Generate an image from a text description. Uses a local image model when available and falls back to a relevant stock photo otherwise. Returns immediately with a job id; the image is delivered to the chat when ready. Use for requests like "draw / generate / create an image of ...".',
  version: '1.0.0',

  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'A clear, detailed description of the image to generate.',
      },
      width: {
        type: 'number',
        description: 'Optional image width in pixels (defaults to 1024).',
      },
      height: {
        type: 'number',
        description: 'Optional image height in pixels (defaults to 1024).',
      },
    },
    required: ['prompt'],
  },

  config: { enabled: imageGenConfig.enabled },

  async execute(
    params: Record<string, unknown>,
    _conversationId?: string,
    userId?: string,
  ) {
    const prompt = typeof params.prompt === 'string' ? params.prompt.trim() : '';
    if (!prompt) {
      return { status: 'error', message: 'A non-empty "prompt" is required to generate an image.' };
    }
    if (!userId) {
      return {
        status: 'error',
        message: 'Image generation requires a signed-in user and is unavailable in this context.',
      };
    }

    const options: ImageGenOptions = {};
    if (typeof params.width === 'number') options.width = params.width;
    if (typeof params.height === 'number') options.height = params.height;

    const job = await imageJobService.startImageJob({
      prompt,
      userId,
      options: Object.keys(options).length > 0 ? options : undefined,
    });
    imageJobService
      .runImageJob(job.id, userId)
      .catch((err) => console.error('[generate_image] job runner failed:', err));

    return {
      status: 'image_generation_started',
      message: `Generating an image for "${prompt}". It will appear in the chat when ready.`,
      jobId: job.id,
    };
  },
};

export default generateImageTool;
