import { describe, it, expect, vi, beforeEach } from 'vitest';

type SupabaseResponse<T> = { data: T | null; error: { message: string } | null };

function makeRequest(body: unknown, headers?: Record<string, string>) {
  const bodyText = JSON.stringify(body);
  const baseHeaders: Record<string, string> = {
    'content-type': 'application/json',
    'content-length': String(bodyText.length),
    ...(headers ?? {}),
  };

  const request = {
    headers: new Headers(baseHeaders),
    json: async () => body,
  };

  return request as unknown;
}

describe('POST app/api/training/jobs/[jobId]/metrics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('rejects missing Authorization header', async () => {
    const supabase = { from: vi.fn() };

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => supabase),
    }));

    const { POST } = await import('../route');

    const response = await POST(
      makeRequest({ step: 1, epoch: 0 }),
      { params: Promise.resolve({ jobId: 'job-123' }) }
    );

    expect(response.status).toBe(401);
  });

  it('rejects invalid job token', async () => {
    const jobsSelectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({
        data: { id: 'job-123', job_token: 'correct-token', status: 'running' },
        error: null,
      } satisfies SupabaseResponse<{ id: string; job_token: string; status: string }>)),
    };

    const metricsInsertQuery = {
      insert: vi.fn(),
    };

    const jobsUpdate = vi.fn();

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'local_training_jobs') return { ...jobsSelectQuery, update: jobsUpdate };
        if (table === 'local_training_metrics') return metricsInsertQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => supabase),
    }));

    const { POST } = await import('../route');

    const response = await POST(
      makeRequest(
        { step: 1, epoch: 0 },
        { Authorization: 'Bearer wrong-token' }
      ),
      { params: Promise.resolve({ jobId: 'job-123' }) }
    );

    expect(response.status).toBe(401);
  });

  it('updates job and inserts a metric point', async () => {
    const jobsSelectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({
        data: { id: 'job-123', job_token: 'correct-token', status: 'pending' },
        error: null,
      } satisfies SupabaseResponse<{ id: string; job_token: string; status: string }>)),
    };

    const jobsUpdateEq = vi.fn(async () => ({ error: null }));
    const jobsUpdate = vi.fn(() => ({ eq: jobsUpdateEq }));

    const metricsInsert = vi.fn(async () => ({ error: null }));
    const metricsInsertQuery = { insert: metricsInsert };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'local_training_jobs') return { ...jobsSelectQuery, update: jobsUpdate };
        if (table === 'local_training_metrics') return metricsInsertQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => supabase),
    }));

    const { POST } = await import('../route');

    const response = await POST(
      makeRequest(
        {
          step: 2,
          epoch: 1.2,
          loss: 0.5,
          eval_loss: 0.6,
          learning_rate: 0.0001,
        },
        { Authorization: 'Bearer correct-token' }
      ),
      { params: Promise.resolve({ jobId: 'job-123' }) }
    );

    expect(response.status).toBe(200);

    expect(jobsUpdate).toHaveBeenCalledTimes(1);
    expect(metricsInsert).toHaveBeenCalledTimes(1);

    const updateArg = (jobsUpdate.mock.calls[0] as unknown[])?.[0];
    expect(updateArg).toMatchObject({
      current_step: 2,
      current_epoch: 1,
      loss: 0.5,
      eval_loss: 0.6,
      learning_rate: 0.0001,
      status: 'running',
    });

    const insertArg = (metricsInsert.mock.calls[0] as unknown[])?.[0];
    expect(insertArg).toMatchObject({
      job_id: 'job-123',
      step: 2,
      epoch: 1,
      train_loss: 0.5,
      eval_loss: 0.6,
      learning_rate: 0.0001,
    });
  });
});

