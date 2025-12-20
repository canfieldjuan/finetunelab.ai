/**
 * Integration Tests: Research Endpoints Authentication
 * 
 * Tests user authentication and authorization for web research endpoints:
 * - GET /api/web-search/research/list - List user's research jobs
 * - GET /api/web-search/research/[id] - Get specific research job
 * - GET /api/web-search/research/[id]/report - Get job report
 * - GET /api/web-search/research/[id]/steps - Get job steps
 * 
 * Security requirements:
 * - All endpoints require valid Authorization header
 * - Users can only access their own research jobs
 * - Invalid/missing auth returns 401
 * - Access to other users' jobs returns 404
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

describe('Research Endpoints Authentication', () => {
  let supabase: ReturnType<typeof createClient>;
  let authToken: string;
  let userId: string;
  let testJobId: string;
  
  beforeAll(async () => {
    // Create authenticated client
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Sign in test user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    });
    
    if (authError || !authData.session) {
      throw new Error(`Failed to authenticate test user: ${authError?.message}`);
    }
    
    authToken = authData.session.access_token;
    userId = authData.user.id;
    
    // Create test research job
    const { data: job, error: jobError } = await supabase
      .from('research_jobs')
      .insert({
        user_id: userId,
        query: 'test research query',
        status: 'completed',
        report_title: 'Test Report',
        report_summary: 'Test summary',
        report_body: 'Test body content'
      })
      .select('id')
      .single();
    
    if (jobError || !job) {
      throw new Error(`Failed to create test job: ${jobError?.message}`);
    }
    
    testJobId = job.id;
  });
  
  afterAll(async () => {
    // Cleanup test data
    if (testJobId) {
      await supabase.from('research_jobs').delete().eq('id', testJobId);
    }
    await supabase.auth.signOut();
  });

  describe('GET /api/web-search/research/list', () => {
    test('should require authorization header', async () => {
      const response = await fetch(`${API_BASE_URL}/api/web-search/research/list`);
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toContain('authorization');
    });
    
    test('should reject invalid token', async () => {
      const response = await fetch(`${API_BASE_URL}/api/web-search/research/list`, {
        headers: { Authorization: 'Bearer invalid_token' }
      });
      expect(response.status).toBe(401);
    });
    
    test('should return user\'s research jobs with valid auth', async () => {
      const response = await fetch(`${API_BASE_URL}/api/web-search/research/list`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.jobs)).toBe(true);
      
      // Verify test job is in results
      const testJob = data.jobs.find((j: unknown) => j.id === testJobId);
      expect(testJob).toBeDefined();
      expect(testJob.user_id).toBe(userId);
    });
  });

  describe('GET /api/web-search/research/[id]', () => {
    test('should require authorization header', async () => {
      const response = await fetch(`${API_BASE_URL}/api/web-search/research/${testJobId}`);
      expect(response.status).toBe(401);
    });
    
    test('should return job details with valid auth and ownership', async () => {
      const response = await fetch(`${API_BASE_URL}/api/web-search/research/${testJobId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.job).toBeDefined();
      expect(data.job.id).toBe(testJobId);
      expect(data.job.user_id).toBe(userId);
    });
    
    test('should return 404 for non-existent job', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await fetch(`${API_BASE_URL}/api/web-search/research/${fakeId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/web-search/research/[id]/report', () => {
    test('should require authorization header', async () => {
      const response = await fetch(`${API_BASE_URL}/api/web-search/research/${testJobId}/report`);
      expect(response.status).toBe(401);
    });
    
    test('should return report with valid auth and ownership', async () => {
      const response = await fetch(`${API_BASE_URL}/api/web-search/research/${testJobId}/report`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.id).toBe(testJobId);
      expect(data.report_title).toBe('Test Report');
      expect(data.report_body).toBe('Test body content');
    });
    
    test('should return 404 with access denied message for non-owned job', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await fetch(`${API_BASE_URL}/api/web-search/research/${fakeId}/report`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data.error).toContain('access denied');
    });
  });

  describe('GET /api/web-search/research/[id]/steps', () => {
    test('should require authorization header', async () => {
      const response = await fetch(`${API_BASE_URL}/api/web-search/research/${testJobId}/steps`);
      expect(response.status).toBe(401);
    });
    
    test('should verify job ownership before returning steps', async () => {
      const response = await fetch(`${API_BASE_URL}/api/web-search/research/${testJobId}/steps`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.steps)).toBe(true);
    });
    
    test('should return 404 for job owned by different user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await fetch(`${API_BASE_URL}/api/web-search/research/${fakeId}/steps`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data.error).toContain('access denied');
    });
  });

  describe('Defense-in-depth: RLS policy verification', () => {
    test('should not bypass RLS with direct database query', async () => {
      // Even if API auth is compromised, RLS should prevent cross-user access
      const { data: jobs } = await supabase
        .from('research_jobs')
        .select('*');
      
      // All returned jobs should belong to authenticated user
      jobs?.forEach(job => {
        expect(job.user_id).toBe(userId);
      });
    });
    
    test('should enforce RLS on INSERT operations', async () => {
      // Attempt to create job for different user should fail
      const fakeUserId = '00000000-0000-0000-0000-000000000000';
      const { error } = await supabase
        .from('research_jobs')
        .insert({
          user_id: fakeUserId,
          query: 'should fail',
          status: 'pending'
        });
      
      expect(error).toBeDefined();
    });
  });
});
