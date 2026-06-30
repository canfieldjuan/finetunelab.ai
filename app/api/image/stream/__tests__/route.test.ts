import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const { getJob } = vi.hoisted(() => ({ getJob: vi.fn() }));

vi.mock('@/lib/tools/image-gen/image-job-store', () => ({
  imageJobStore: { get: getJob },
}));

import { GET } from '../route';
import { signImageStreamToken } from '@/lib/tools/image-gen/stream-token';

// Real (not mocked) tokens — the test env has a signing secret (service-role key).
const tokenFor = (jobId: string, userId: string) => signImageStreamToken({ jobId, userId })!;

function makeRequest(query: string): NextRequest {
  return new Request(`http://localhost/api/image/stream${query}`) as unknown as NextRequest;
}

async function readStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

describe('GET /api/image/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs and verifies a job-scoped token round-trip', () => {
    const t = tokenFor('j1', 'u1');
    expect(typeof t).toBe('string');
    expect(t).toContain('.');
  });

  it('400 when jobId is missing', async () => {
    const res = await GET(makeRequest(`?token=${tokenFor('j1', 'u1')}`));
    expect(res.status).toBe(400);
  });

  it('401 when there is no token', async () => {
    const res = await GET(makeRequest('?jobId=j1'));
    expect(res.status).toBe(401);
    expect(getJob).not.toHaveBeenCalled();
  });

  it('401 for a malformed / bad-signature token', async () => {
    const res = await GET(makeRequest('?jobId=j1&token=not.a.valid.token'));
    expect(res.status).toBe(401);
    expect(getJob).not.toHaveBeenCalled();
  });

  it('404 when the token is bound to a different jobId', async () => {
    const res = await GET(makeRequest(`?jobId=j1&token=${tokenFor('other-job', 'u1')}`));
    expect(res.status).toBe(404);
    expect(getJob).not.toHaveBeenCalled();
  });

  it('404 when the job is not owned by the caller (owner-scoped get returns null)', async () => {
    getJob.mockResolvedValue(null);
    const res = await GET(makeRequest(`?jobId=j1&token=${tokenFor('j1', 'u1')}`));
    expect(res.status).toBe(404);
    expect(getJob).toHaveBeenCalledWith('j1', 'u1'); // userId came from the verified token
  });

  it('streams the completed result immediately when the job already finished (race guard)', async () => {
    getJob.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      prompt: 'a fox',
      status: 'completed',
      resultUrl: 'https://signed/x.png',
      source: 'comfyui',
      createdAt: 't',
      updatedAt: 't',
    });
    const res = await GET(makeRequest(`?jobId=j1&token=${tokenFor('j1', 'u1')}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const body = await readStream(res);
    expect(body).toContain('"type":"connected"');
    expect(body).toContain('"type":"image_complete"');
    expect(body).toContain('https://signed/x.png');
  });

  it('streams a failure immediately when the job already failed', async () => {
    getJob.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      prompt: 'a fox',
      status: 'failed',
      error: 'no backend configured',
      createdAt: 't',
      updatedAt: 't',
    });
    const res = await GET(makeRequest(`?jobId=j1&token=${tokenFor('j1', 'u1')}`));
    const body = await readStream(res);
    expect(body).toContain('"type":"image_failed"');
    expect(body).toContain('no backend configured');
  });
});
