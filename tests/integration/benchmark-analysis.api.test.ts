import assert from 'assert';

// NOTE: This is a lightweight integration sanity check that can be adapted to your test runner.
// Assumes environment provides a valid bearer token and server is running in test mode.

describe('Benchmark Analysis API', () => {
  it('exposes GET /api/analytics/benchmark-analysis with auth', async () => {
    const token = process.env.TEST_SUPABASE_BEARER;
    if (!token) {
      console.warn('[TEST] Skipping - TEST_SUPABASE_BEARER not set');
      return;
    }
    const params = new URLSearchParams({ period: 'all' }).toString();
    const res = await fetch(`http://localhost:3000/api/analytics/benchmark-analysis?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.ok(res.status !== 401, 'should not be unauthorized with token');
    const json = await res.json();
    assert.ok(json.success === true, 'response.success should be true');
    assert.ok('data' in json, 'response should include data');
  });
});
