import { describe, it, expect, vi, beforeEach } from 'vitest';

function makeRequest(url: string, headers?: Record<string, string>) {
  return {
    url,
    headers: new Headers(headers ?? {}),
  } as unknown;
}

describe('GET app/api/analytics/data', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('accepts X-API-Key auth and returns dataset', async () => {
    vi.doMock('@/lib/auth/api-key-validator', () => ({
      validateRequest: vi.fn(async () => ({ isValid: true, userId: 'user-123' })),
    }));

    vi.doMock('@/lib/analytics/dataAggregator', () => ({
      aggregateTokenUsageData: vi.fn(async () => []),
      aggregateQualityMetrics: vi.fn(async () => []),
      aggregateToolUsageData: vi.fn(async () => []),
      aggregateConversationMetrics: vi.fn(async () => []),
      aggregateErrorData: vi.fn(async () => []),
      aggregateLatencyData: vi.fn(async () => []),
    }));

    const { GET } = await import('../route');

    const response = await GET(
      makeRequest(
        'http://localhost:3000/api/analytics/data?startDate=2025-01-01T00:00:00Z&endDate=2025-01-02T00:00:00Z&metrics=all',
        { 'X-API-Key': 'wak_testkey_should_not_be_validated_by_format_here' }
      )
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.metadata.userId).toBe('user-123');
  });
});

