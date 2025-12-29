import { describe, it, expect, vi, beforeEach } from 'vitest';

type SupabaseResponse<T> = { data: T | null; error: { message: string } | null };

function makeRequest(url: string, body?: unknown, headers?: Record<string, string>) {
  const bodyText = body === undefined ? '' : JSON.stringify(body);
  const baseHeaders: Record<string, string> = {
    ...(headers ?? {}),
    ...(body === undefined ? {} : { 'content-type': 'application/json', 'content-length': String(bodyText.length) }),
  };

  return {
    url,
    headers: new Headers(baseHeaders),
    json: async () => body,
  } as unknown;
}

describe('app/api/analytics/traces', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('POST accepts X-API-Key auth and inserts trace', async () => {
    vi.doMock('@/lib/auth/api-key-validator', () => ({
      validateRequest: vi.fn(async () => ({ isValid: true, userId: 'user-123' })),
    }));

    const insertSingle = vi.fn(async () => ({
      data: { id: 'trace-row-1' },
      error: null,
    } satisfies SupabaseResponse<{ id: string }>));

    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const insert = vi.fn(() => ({ select: insertSelect }));

    const supabase = {
      from: vi.fn(() => ({ insert })),
    };

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => supabase),
    }));

    const { POST } = await import('../route');

    const response = await POST(
      makeRequest(
        'http://localhost:3000/api/analytics/traces',
        {
          trace_id: 't1',
          span_id: 's1',
          span_name: 'llm.completion',
          operation_type: 'completion',
          start_time: new Date().toISOString(),
        },
        { 'X-API-Key': 'wak_fake' }
      )
    );

    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(1);
    const insertArg = (insert.mock.calls[0] as unknown[])?.[0];
    expect(insertArg.user_id).toBe('user-123');
  });

  it('GET accepts X-API-Key auth and returns traces', async () => {
    vi.doMock('@/lib/auth/api-key-validator', () => ({
      validateRequest: vi.fn(async () => ({ isValid: true, userId: 'user-123' })),
    }));

    const range = vi.fn(async () => ({ data: [], error: null }));
    const builder: unknown = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.range = range;

    const supabase = {
      from: vi.fn(() => builder),
    };

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => supabase),
    }));

    const { GET } = await import('../route');

    const response = await GET(
      makeRequest(
        'http://localhost:3000/api/analytics/traces?limit=10&offset=0',
        undefined,
        { 'X-API-Key': 'wak_fake' }
      )
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-123');
  });
});
