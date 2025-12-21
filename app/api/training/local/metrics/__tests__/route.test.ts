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
    clone: () => ({
      text: async () => bodyText,
    }),
  };

  return request as any;
}

describe('POST app/api/training/local/metrics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('rejects missing Authorization header', async () => {
    const jobsSelectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn<() => Promise<SupabaseResponse<{ id: string; job_token: string }>>>(),
    };
    const metricsInsertQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn(async () => ({ data: [], error: null })),
    };
    const jobsUpdateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn(async () => ({ error: null })),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'local_training_jobs') {
          return {
            select: vi.fn(() => jobsSelectQuery),
            update: vi.fn(() => jobsUpdateQuery),
          };
        }
        if (table === 'local_training_metrics') return metricsInsertQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => supabase),
    }));

    const { POST } = await import('../route');

    const response = await POST(
      makeRequest({
        job_id: 'job-123',
        metrics: [{ step: 1, epoch: 0 }],
      })
    );

    expect(response.status).toBe(401);
  });

  it('rejects invalid job token', async () => {
    const jobsSelectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({
        data: { id: 'job-123', job_token: 'correct-token' },
        error: null,
      })),
    };

    const metricsInsertQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn(async () => ({ data: [], error: null })),
    };

    const jobsUpdateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn(async () => ({ error: null })),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'local_training_jobs') {
          return {
            select: vi.fn(() => jobsSelectQuery),
            update: vi.fn(() => jobsUpdateQuery),
          };
        }
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
          job_id: 'job-123',
          metrics: [{ step: 1, epoch: 0 }],
        },
        { authorization: 'Bearer wrong-token' }
      )
    );

    expect(response.status).toBe(401);
  });

  it('inserts metric points and updates job from latest point', async () => {
    const jobsSelectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({
        data: { id: 'job-123', job_token: 'correct-token' },
        error: null,
      })),
    };

    const insertedRows = [{ id: 1 }, { id: 2 }];
    const metricsInsertQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn(async () => ({ data: insertedRows, error: null })),
    };

    const jobsUpdateEq = vi.fn(async () => ({ error: null }));
    const jobsUpdate = vi.fn(() => ({ eq: jobsUpdateEq }));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'local_training_jobs') {
          return {
            select: vi.fn(() => jobsSelectQuery),
            update: jobsUpdate,
          };
        }
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
          job_id: 'job-123',
          metrics: [
            { step: 1, epoch: 0, train_loss: 1.0, eval_loss: 2.0 },
            { step: 2, epoch: 0, train_loss: 0.5, eval_loss: 1.5, learning_rate: 0.0001 },
          ],
        },
        { authorization: 'Bearer correct-token' }
      )
    );

    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload).toEqual({ success: true, count: insertedRows.length });

    expect(metricsInsertQuery.insert).toHaveBeenCalledTimes(1);
    expect(jobsUpdate).toHaveBeenCalledTimes(1);

    const updateArg = (jobsUpdate.mock.calls[0] as any[])?.[0];
    expect(updateArg).toMatchObject({
      current_step: 2,
      current_epoch: 0,
      loss: 0.5,
      eval_loss: 1.5,
      learning_rate: 0.0001,
    });
  });
});
