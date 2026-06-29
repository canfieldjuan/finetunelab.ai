/**
 * Async image-generation job runner.
 *
 * `startImageJob` persists a 'pending' job and returns immediately (the tool's
 * execute fires `runImageJob` forget-style, like deep-research). `runImageJob`
 * transitions the job to 'running', calls the {@link generateImage} service
 * (ComfyUI -> Unsplash fallback), and records the result or the failure.
 *
 * Delivery of the finished image to the chat UI (SSE + render) is slice 3iii;
 * this slice just makes the job run and persist.
 */

import { randomUUID } from 'crypto';
import { generateImage } from './service';
import { imageJobStore } from './image-job-store';
import type { ImageGenOptions, ImageJob } from './types';

export interface StartImageJobParams {
  prompt: string;
  userId: string;
  options?: ImageGenOptions;
}

class ImageJobService {
  /** Create and persist a 'pending' job. Does not run the work. */
  async startImageJob(params: StartImageJobParams): Promise<ImageJob> {
    const now = new Date().toISOString();
    const job: ImageJob = {
      id: randomUUID(),
      userId: params.userId,
      prompt: params.prompt,
      status: 'pending',
      options: params.options,
      createdAt: now,
      updatedAt: now,
    };
    const result = await imageJobStore.create(job);
    if (!result.success) {
      throw new Error(`Failed to create image job: ${result.error ?? 'unknown error'}`);
    }
    return job;
  }

  /**
   * Run a previously-created job to completion, persisting the outcome.
   * Never throws for a generation failure — it records 'failed' on the job so
   * the fire-and-forget caller has nothing to handle.
   */
  async runImageJob(jobId: string): Promise<void> {
    const job = await imageJobStore.get(jobId);
    if (!job) {
      console.error(`[ImageJob] runImageJob: job ${jobId} not found`);
      return;
    }

    job.status = 'running';
    job.updatedAt = new Date().toISOString();
    await imageJobStore.update(job);

    try {
      const result = await generateImage({
        prompt: job.prompt,
        userId: job.userId,
        options: job.options,
      });
      job.status = 'completed';
      job.resultUrl = result.url;
      job.source = result.source;
      job.attribution = result.attribution;
      job.completedAt = new Date().toISOString();
      job.updatedAt = job.completedAt;
      await imageJobStore.update(job);
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
      job.completedAt = new Date().toISOString();
      job.updatedAt = job.completedAt;
      await imageJobStore.update(job);
      console.error(`[ImageJob] generation failed for job ${jobId}: ${job.error}`);
    }
  }
}

export const imageJobService = new ImageJobService();
