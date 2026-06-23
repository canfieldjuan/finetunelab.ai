import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  const bodyText = JSON.stringify(body);
  const baseHeaders: Record<string, string> = {
    'content-type': 'application/json',
    'content-length': String(bodyText.length),
    ...(headers ?? {}),
  };

  return {
    headers: new Headers(baseHeaders),
    json: async () => body,
  } as unknown as NextRequest;
}

describe('POST app/api/batch-testing/run', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
  });

  it('accepts X-API-Key auth and calls /api/chat with X-API-Key', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: unknown) => {
      // Ensure the background prompt processing uses API key auth.
      if (typeof _url === 'string' && _url.endsWith('/api/chat')) {
expect(((init as RequestInit)?.headers as Record<string, string>)['X-API-Key']).toBe('wak_testkey');
      }
      return { ok: true, text: async () => '' } as unknown;
    });
    // @ts-expect-error - vitest global patching
    globalThis.fetch = fetchMock;

    vi.doMock('@/lib/auth/api-key-validator', () => ({
      validateRequestWithScope: vi.fn(async () => ({ isValid: true, userId: 'user-123' })),
      extractApiKeyFromHeaders: vi.fn(() => 'wak_testkey'),
    }));

    vi.doMock('@/lib/alerts', () => ({
      sendBatchTestAlert: vi.fn(async () => undefined),
      sendScheduledEvaluationAlert: vi.fn(async () => undefined),
    }));

    // The background task generates a session tag (real module hits the DB); stub it so
    // the path to the /api/chat fetch is deterministic.
    vi.doMock('@/lib/session-tagging/generator', () => ({
      generateSessionTag: vi.fn(async () => null),
    }));

    const testSuiteQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({
        data: { name: 'suite', prompts: ['hello'], prompt_count: 1 },
        error: null,
      })),
    };

    const insertBatchTestRunsSelect = vi.fn(async () => ({
      data: [{ id: 'test-run-1' }],
      error: null,
    }));

    const batchTestRunsQuery = {
      insert: vi.fn(() => ({ select: insertBatchTestRunsSelect })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    };

    const runsInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: 'run-1' }, error: null })),
      })),
    }));

    const runsQuery = { insert: runsInsert, update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) };

    const conversationsInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: 'conv-1' }, error: null })),
      })),
    }));

    const conversationsQuery = { insert: conversationsInsert };

    // Background processing looks up the model's provider before calling /api/chat.
    // Returning no provider keeps it off the tools path (no `tools` query needed).
    const llmModelsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: null, error: null })),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'test_suites') return testSuiteQuery;
        if (table === 'batch_test_runs') return batchTestRunsQuery;
        if (table === 'runs') return runsQuery;
        if (table === 'conversations') return conversationsQuery;
        if (table === 'llm_models') return llmModelsQuery;
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
          config: {
            model_id: 'gpt-4',
            test_suite_id: 'suite-1',
            prompt_limit: 1,
            delay_ms: 0,
            judge_config: { enabled: false, model: 'gpt-4.1', criteria: [] },
          },
        },
        { 'X-API-Key': 'wak_testkey' }
      )
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.test_run_id).toBe('test-run-1');

    // The background task runs through several awaits (conversation insert, model
    // lookup, session tag) before reaching the /api/chat fetch; poll until it lands.
    for (let i = 0; i < 50 && fetchMock.mock.calls.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(fetchMock).toHaveBeenCalled();
  });

  it('rejects judge_config when using API key auth', async () => {
    vi.doMock('@/lib/auth/api-key-validator', () => ({
      validateRequestWithScope: vi.fn(async () => ({ isValid: true, userId: 'user-123' })),
      extractApiKeyFromHeaders: vi.fn(() => 'wak_testkey'),
    }));

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => ({ from: vi.fn() })),
    }));

    const { POST } = await import('../route');

    const response = await POST(
      makeRequest(
        {
          config: {
            model_id: 'gpt-4',
            test_suite_id: 'suite-1',
            prompt_limit: 1,
            judge_config: { enabled: true, model: 'gpt-4.1', criteria: ['accuracy'] },
          },
        },
        { 'X-API-Key': 'wak_testkey' }
      )
    );

    expect(response.status).toBe(400);
  });
});
