import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const { getUser, getJob } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getJob: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: { getUser } })),
}));
vi.mock('@/lib/tools/image-gen/image-job-store', () => ({
  imageJobStore: { get: getJob },
}));

import { GET } from '../route';

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
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  });

  it('400 when jobId is missing', async () => {
    const res = await GET(makeRequest('?token=tok'));
    expect(res.status).toBe(400);
  });

  it('401 when there is no token', async () => {
    const res = await GET(makeRequest('?jobId=j1'));
    expect(res.status).toBe(401);
    expect(getJob).not.toHaveBeenCalled();
  });

  it('401 when the token does not resolve to a user', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } });
    const res = await GET(makeRequest('?jobId=j1&token=bad'));
    expect(res.status).toBe(401);
    expect(getJob).not.toHaveBeenCalled();
  });

  it('404 when the job is not owned by the caller (owner-scoped get returns null)', async () => {
    getJob.mockResolvedValue(null);
    const res = await GET(makeRequest('?jobId=j1&token=tok'));
    expect(res.status).toBe(404);
    // owner-scoped read used the verified user id
    expect(getJob).toHaveBeenCalledWith('j1', 'u1');
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
    const res = await GET(makeRequest('?jobId=j1&token=tok'));
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
    const res = await GET(makeRequest('?jobId=j1&token=tok'));
    const body = await readStream(res);
    expect(body).toContain('"type":"image_failed"');
    expect(body).toContain('no backend configured');
  });
});
