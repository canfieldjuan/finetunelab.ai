import { describe, it, expect, vi, beforeEach } from 'vitest';

const { startImageJob, runImageJob } = vi.hoisted(() => ({
  startImageJob: vi.fn(),
  runImageJob: vi.fn(),
}));

vi.mock('../image-job-service', () => ({ imageJobService: { startImageJob, runImageJob } }));

import generateImageTool from '../tool';

type ExecResult = Record<string, unknown>;

describe('generate_image tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startImageJob.mockResolvedValue({
      id: 'job-9',
      userId: 'u1',
      prompt: 'a cat',
      status: 'pending',
      createdAt: 't',
      updatedAt: 't',
    });
    runImageJob.mockResolvedValue(undefined);
  });

  it('is named generate_image and requires a prompt', () => {
    expect(generateImageTool.name).toBe('generate_image');
    expect(generateImageTool.parameters.required).toContain('prompt');
  });

  it('starts a job and returns a started payload with the jobId', async () => {
    const res = (await generateImageTool.execute({ prompt: 'a cat', width: 512 }, 'conv1', 'u1')) as ExecResult;

    expect(res.status).toBe('image_generation_started');
    expect(res.jobId).toBe('job-9');
    expect(startImageJob).toHaveBeenCalledTimes(1);
    expect(startImageJob.mock.calls[0][0]).toMatchObject({
      prompt: 'a cat',
      userId: 'u1',
      options: { width: 512 },
    });
    // runner fired forget-style, scoped to the authenticated user
    expect(runImageJob).toHaveBeenCalledWith('job-9', 'u1');
  });

  it('omits options when no dimensions are given', async () => {
    await generateImageTool.execute({ prompt: 'a cat' }, 'c', 'u1');
    expect(startImageJob.mock.calls[0][0].options).toBeUndefined();
  });

  it('errors on an empty prompt without starting a job', async () => {
    const res = (await generateImageTool.execute({ prompt: '   ' }, 'c', 'u1')) as ExecResult;
    expect(res.status).toBe('error');
    expect(startImageJob).not.toHaveBeenCalled();
  });

  it('errors when there is no signed-in user', async () => {
    const res = (await generateImageTool.execute({ prompt: 'a cat' }, 'c', undefined)) as ExecResult;
    expect(res.status).toBe('error');
    expect(startImageJob).not.toHaveBeenCalled();
  });
});
