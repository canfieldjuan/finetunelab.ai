import { describe, it, expect, vi, beforeEach } from 'vitest';

function makeRequest(headers?: Record<string, string>) {
  return {
    headers: new Headers(headers ?? {}),
  } as unknown;
}

describe('GET app/api/batch-testing/status/[id]', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('accepts X-API-Key auth and returns status', async () => {
    vi.doMock('@/lib/auth/api-key-validator', () => ({
      validateRequest: vi.fn(async () => ({ isValid: true, userId: 'user-123' })),
      extractApiKeyFromHeaders: vi.fn(() => 'wak_testkey'),
    }));

    const batchTestRun = {
      id: 'test-run-1',
      status: 'completed',
      model_name: 'gpt-4',
      total_prompts: 10,
      completed_prompts: 10,
      failed_prompts: 2,
      started_at: '2025-01-01T00:00:00Z',
      completed_at: '2025-01-01T00:01:00Z',
      error: null,
    };

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: batchTestRun, error: null })),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'batch_test_runs') return query;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => supabase),
    }));

    const { GET } = await import('../route');

    const response = await GET(
      makeRequest({ 'X-API-Key': 'wak_testkey' }),
      { params: Promise.resolve({ id: 'test-run-1' }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.id).toBe('test-run-1');
    expect(payload.status).toBe('completed');
    expect(payload.failed_prompts).toBe(2);
  });
});

