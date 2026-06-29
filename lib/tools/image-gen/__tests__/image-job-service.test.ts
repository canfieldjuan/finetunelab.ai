import { describe, it, expect, vi, beforeEach } from 'vitest';

const { create, update, get, generateImage, sendEvent } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  generateImage: vi.fn(),
  sendEvent: vi.fn(),
}));

vi.mock('../image-job-store', () => ({ imageJobStore: { create, update, get } }));
vi.mock('../service', () => ({ generateImage }));
vi.mock('../image-sse.service', () => ({
  imageSseService: { sendEvent },
  IMAGE_EVENT_TYPES: { CONNECTED: 'connected', COMPLETE: 'image_complete', FAILED: 'image_failed' },
}));

import { imageJobService } from '../image-job-service';

const pendingJob = {
  id: 'j1',
  userId: 'u1',
  prompt: 'a fox',
  status: 'pending' as const,
  createdAt: 't',
  updatedAt: 't',
};

describe('imageJobService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ success: true });
    update.mockResolvedValue({ success: true });
  });

  it('startImageJob persists a pending job and returns it', async () => {
    const job = await imageJobService.startImageJob({
      prompt: 'a fox',
      userId: 'u1',
      options: { width: 512 },
    });
    expect(job.status).toBe('pending');
    expect(job.userId).toBe('u1');
    expect(job.prompt).toBe('a fox');
    expect(job.id).toBeTruthy();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ status: 'pending', options: { width: 512 } });
  });

  it('startImageJob throws when persistence fails', async () => {
    create.mockResolvedValue({ success: false, error: 'db down' });
    await expect(imageJobService.startImageJob({ prompt: 'x', userId: 'u1' })).rejects.toThrow(/db down/);
  });

  it('runImageJob completes a job and records the result', async () => {
    get.mockResolvedValue({ ...pendingJob });
    generateImage.mockResolvedValue({ url: 'https://img/x.png', source: 'comfyui', prompt: 'a fox' });

    await imageJobService.runImageJob('j1', 'u1');

    expect(get).toHaveBeenCalledWith('j1', 'u1'); // owner-scoped read
    expect(generateImage).toHaveBeenCalledWith({ prompt: 'a fox', userId: 'u1', options: undefined });
    expect(update).toHaveBeenCalledTimes(2); // running, then completed
    const final = update.mock.calls[update.mock.calls.length - 1][0];
    expect(final.status).toBe('completed');
    expect(final.resultUrl).toBe('https://img/x.png');
    expect(final.source).toBe('comfyui');
    expect(final.completedAt).toBeTruthy();
    expect(sendEvent).toHaveBeenCalledWith(
      'j1',
      expect.objectContaining({ type: 'image_complete', url: 'https://img/x.png', source: 'comfyui' }),
    );
  });

  it('carries Unsplash attribution onto the completed job', async () => {
    get.mockResolvedValue({ ...pendingJob });
    generateImage.mockResolvedValue({
      url: 'https://u/x.jpg',
      source: 'unsplash',
      prompt: 'a fox',
      attribution: { authorName: 'Jane', authorUrl: 'a', sourceName: 'Unsplash', sourceUrl: 's' },
    });

    await imageJobService.runImageJob('j1', 'u1');
    const final = update.mock.calls[update.mock.calls.length - 1][0];
    expect(final.source).toBe('unsplash');
    expect(final.attribution?.authorName).toBe('Jane');
  });

  it('records a failure without throwing', async () => {
    get.mockResolvedValue({ ...pendingJob });
    generateImage.mockRejectedValue(new Error('no backend'));

    await expect(imageJobService.runImageJob('j1', 'u1')).resolves.toBeUndefined();
    const final = update.mock.calls[update.mock.calls.length - 1][0];
    expect(final.status).toBe('failed');
    expect(final.error).toMatch(/no backend/);
    expect(final.completedAt).toBeTruthy();
    expect(sendEvent).toHaveBeenCalledWith(
      'j1',
      expect.objectContaining({ type: 'image_failed', error: expect.stringMatching(/no backend/) }),
    );
  });

  it('no-ops when the job id is unknown', async () => {
    get.mockResolvedValue(null);
    await imageJobService.runImageJob('missing', 'u1');
    expect(update).not.toHaveBeenCalled();
    expect(generateImage).not.toHaveBeenCalled();
  });
});
