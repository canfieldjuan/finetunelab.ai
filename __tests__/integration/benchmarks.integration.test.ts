/**
 * Benchmark API Integration Tests
 * Tests: /api/benchmarks and /api/benchmarks/[id] endpoints
 * Uses: Real Supabase instance (requires valid credentials)
 * 
 * Setup:
 * 1. Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * 2. Ensure you have a valid auth token
 * 3. Run: npm test __tests__/integration/benchmarks.integration.test.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Test user credentials - update these with your test account
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'test_password';

interface Benchmark {
  id: string;
  name: string;
  created_by: string;
  pass_criteria: {
    required_validators: string[];
    min_score?: number;
    custom_rules?: Record<string, unknown>;
  };
  is_public?: boolean;
}

describe('Benchmark API Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let createdBenchmarkId: string;
  let supabase: SupabaseClient;

  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Authenticate test user
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (error || !data.session) {
      throw new Error(`Failed to authenticate test user: ${error?.message || 'No session'}`);
    }

    authToken = data.session.access_token;
    userId = data.user.id;

    console.log('✓ Test user authenticated:', userId);
  });

  afterAll(async () => {
    // Clean up any test benchmarks
    if (createdBenchmarkId) {
      await fetch(`${BASE_URL}/api/benchmarks/${createdBenchmarkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      console.log('✓ Cleaned up test benchmark:', createdBenchmarkId);
    }

    // Sign out
    await supabase.auth.signOut();
  });

  describe('POST /api/benchmarks - Create Benchmark', () => {
    it('should create a new benchmark with validators', async () => {
      const newBenchmark = {
        name: 'Integration Test Benchmark',
        description: 'Created by integration test',
        task_type: 'qa',
        pass_criteria: {
          min_score: 80,
          required_validators: ['must_cite_if_claims', 'format_ok'],
          custom_rules: { max_length: 500 },
        },
        is_public: false,
      };

      const response = await fetch(`${BASE_URL}/api/benchmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(newBenchmark),
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.benchmark).toBeDefined();
      expect(data.benchmark.name).toBe(newBenchmark.name);
      expect(data.benchmark.created_by).toBe(userId);
      expect(data.benchmark.pass_criteria.required_validators).toEqual(
        newBenchmark.pass_criteria.required_validators
      );

      // Store for cleanup
      createdBenchmarkId = data.benchmark.id;
      console.log('✓ Created benchmark:', createdBenchmarkId);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await fetch(`${BASE_URL}/api/benchmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Test' }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/benchmarks - List Benchmarks', () => {
    it('should fetch user benchmarks', async () => {
      const response = await fetch(`${BASE_URL}/api/benchmarks`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.benchmarks).toBeDefined();
      expect(Array.isArray(data.benchmarks)).toBe(true);

      // Should include our created benchmark
      const ourBenchmark = data.benchmarks.find(
        (b: Benchmark) => b.id === createdBenchmarkId
      );
      expect(ourBenchmark).toBeDefined();
    });
  });

  describe('PATCH /api/benchmarks/[id] - Update Benchmark', () => {
    it('should update benchmark name', async () => {
      const updatedName = 'Updated Integration Test Benchmark';

      const response = await fetch(`${BASE_URL}/api/benchmarks/${createdBenchmarkId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name: updatedName }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.benchmark.name).toBe(updatedName);
      expect(data.benchmark.id).toBe(createdBenchmarkId);
    });

    it('should update pass_criteria', async () => {
      const updatedCriteria = {
        min_score: 90,
        required_validators: ['must_cite_if_claims'],
        custom_rules: { max_length: 1000 },
      };

      const response = await fetch(`${BASE_URL}/api/benchmarks/${createdBenchmarkId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ pass_criteria: updatedCriteria }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.benchmark.pass_criteria.min_score).toBe(90);
      expect(data.benchmark.pass_criteria.required_validators).toEqual(['must_cite_if_claims']);
      expect(data.benchmark.pass_criteria.custom_rules.max_length).toBe(1000);
    });

    it('should update is_public flag', async () => {
      const response = await fetch(`${BASE_URL}/api/benchmarks/${createdBenchmarkId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ is_public: true }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.benchmark.is_public).toBe(true);
    });

    it('should return 404 for non-existent benchmark', async () => {
      const response = await fetch(`${BASE_URL}/api/benchmarks/non_existent_id`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name: 'Updated' }),
      });

      expect(response.status).toBe(404);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await fetch(`${BASE_URL}/api/benchmarks/${createdBenchmarkId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated' }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/benchmarks/[id] - Delete Benchmark', () => {
    it('should delete benchmark', async () => {
      const response = await fetch(`${BASE_URL}/api/benchmarks/${createdBenchmarkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify it's actually deleted
      const getResponse = await fetch(`${BASE_URL}/api/benchmarks`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const getData = await getResponse.json();
      const deletedBenchmark = getData.benchmarks.find(
        (b: Benchmark) => b.id === createdBenchmarkId
      );
      expect(deletedBenchmark).toBeUndefined();

      // Clear ID so afterAll doesn't try to delete again
      createdBenchmarkId = '';
    });

    it('should return 404 for non-existent benchmark', async () => {
      const response = await fetch(`${BASE_URL}/api/benchmarks/non_existent_id`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(404);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await fetch(`${BASE_URL}/api/benchmarks/some_id`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(401);
    });
  });
});
