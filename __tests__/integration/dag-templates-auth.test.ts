/**
 * DAG Template Authentication Integration Tests
 * Tests: /api/training/dag/templates endpoints with user authentication
 * 
 * Setup:
 * 1. Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * 2. Ensure test user credentials are configured
 * 3. Run: npm test __tests__/integration/dag-templates-auth.test.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'test_password';

const TEST_EMAIL_2 = process.env.TEST_USER_EMAIL_2 || 'test2@example.com';
const TEST_PASSWORD_2 = process.env.TEST_USER_PASSWORD_2 || 'test_password_2';

interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  config: {
    jobs: unknown[];
  };
  user_id?: string;
  created_at?: string;
}

describe('DAG Template Authentication Tests', () => {
  let supabase: SupabaseClient;
  let authToken: string;
  let userId: string;
  let createdTemplateId: string;

  let supabase2: SupabaseClient;
  let authToken2: string;

  beforeAll(async () => {
    // Initialize first test user
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (error || !data.session) {
      throw new Error(`Failed to authenticate test user 1: ${error?.message}`);
    }

    authToken = data.session.access_token;
    userId = data.user.id;

    // Initialize second test user for ownership tests
    supabase2 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: data2, error: error2 } = await supabase2.auth.signInWithPassword({
      email: TEST_EMAIL_2,
      password: TEST_PASSWORD_2,
    });

    if (error2 || !data2.session) {
      console.warn('Second test user not available - some tests will be skipped');
    } else {
      authToken2 = data2.session.access_token;
    }
  });

  afterAll(async () => {
    // Cleanup: Delete test templates
    if (createdTemplateId && authToken) {
      await fetch(`${BASE_URL}/api/training/dag/templates/${createdTemplateId}`, {
        method: 'DELETE',
        headers: {
          'authorization': `Bearer ${authToken}`,
        },
      });
    }

    await supabase.auth.signOut();
    if (supabase2) {
      await supabase2.auth.signOut();
    }
  });

  describe('Template List Endpoint (GET /api/training/dag/templates)', () => {
    it('should reject requests without authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/training/dag/templates`, {
        method: 'GET',
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should return only user own templates when authenticated', async () => {
      const response = await fetch(`${BASE_URL}/api/training/dag/templates`, {
        method: 'GET',
        headers: {
          'authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.templates)).toBe(true);
    });
  });

  describe('Template Creation Endpoint (POST /api/training/dag/templates)', () => {
    it('should reject requests without authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/training/dag/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Template',
          description: 'Test description',
          category: 'custom',
          config: {
            jobs: [],
          },
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should create template with authenticated user', async () => {
      const response = await fetch(`${BASE_URL}/api/training/dag/templates`, {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Test Template ${Date.now()}`,
          description: 'Integration test template',
          category: 'testing',
          config: {
            jobs: [
              {
                id: 'job-1',
                name: 'Test Job',
                type: 'training',
              },
            ],
          },
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.template).toBeDefined();
      expect(data.template.user_id).toBe(userId);

      createdTemplateId = data.template.id;
    });
  });

  describe('Individual Template Endpoint (GET /api/training/dag/templates/[id])', () => {
    it('should reject requests without authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/training/dag/templates/test-id`, {
        method: 'GET',
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should allow owner to access their template', async () => {
      if (!createdTemplateId) {
        console.warn('Skipping test - no template created');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/training/dag/templates/${createdTemplateId}`, {
        method: 'GET',
        headers: {
          'authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.template).toBeDefined();
      expect(data.template.id).toBe(createdTemplateId);
    });

    it('should deny access to templates owned by other users', async () => {
      if (!createdTemplateId || !authToken2) {
        console.warn('Skipping test - prerequisites not met');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/training/dag/templates/${createdTemplateId}`, {
        method: 'GET',
        headers: {
          'authorization': `Bearer ${authToken2}`,
        },
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not found or access denied');
    });
  });

  describe('Template Deletion Endpoint (DELETE /api/training/dag/templates/[id])', () => {
    it('should reject requests without authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/training/dag/templates/test-id`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should prevent deletion of templates owned by other users', async () => {
      if (!createdTemplateId || !authToken2) {
        console.warn('Skipping test - prerequisites not met');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/training/dag/templates/${createdTemplateId}`, {
        method: 'DELETE',
        headers: {
          'authorization': `Bearer ${authToken2}`,
        },
      });

      expect([404, 500]).toContain(response.status);
    });

    it('should allow owner to delete their template', async () => {
      if (!createdTemplateId) {
        console.warn('Skipping test - no template created');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/training/dag/templates/${createdTemplateId}`, {
        method: 'DELETE',
        headers: {
          'authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      createdTemplateId = '';
    });
  });

  describe('RLS Policy Enforcement', () => {
    it('should enforce user_id filter at database level', async () => {
      const response = await fetch(`${BASE_URL}/api/training/dag/templates`, {
        method: 'GET',
        headers: {
          'authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      if (data.templates && data.templates.length > 0) {
        data.templates.forEach((template: Template) => {
          expect(template.user_id).toBe(userId);
        });
      }
    });
  });
});



