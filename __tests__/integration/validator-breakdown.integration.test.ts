/**
 * Validator Breakdown API Integration Tests
 * Tests: /api/batch-testing/[id]/validators endpoint
 * Uses: Real Supabase instance (requires valid credentials and test data)
 * 
 * Note: This test requires an existing batch test run with judgments in the database
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'test_password';

interface Message {
  id: string;
  role: string;
  content: string;
  test_run_id: string;
  created_by: string;
}

interface Validator {
  judge_name: string;
  judge_type: string;
  total: number;
  passed: number;
  failed: number;
  pass_rate: number;
  criteria: Record<string, {
    total: number;
    passed: number;
    failed: number;
  }>;
}

describe('Validator Breakdown API Integration Tests', () => {
  let authToken: string;
  let supabase: SupabaseClient;
  let testRunId: string;
  let messageIds: string[] = [];

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (error || !data.session) {
      throw new Error(`Failed to authenticate: ${error?.message}`);
    }

    authToken = data.session.access_token;
    console.log('✓ Authenticated for validator tests');

    // Create test data: batch test run, messages, and judgments
    await createTestData(data.user.id);
  });

  afterAll(async () => {
    // Clean up test data
    if (testRunId) {
      await supabase.from('judgments').delete().in('message_id', messageIds);
      await supabase.from('messages').delete().in('id', messageIds);
      await supabase.from('batch_test_runs').delete().eq('id', testRunId);
      console.log('✓ Cleaned up test data');
    }

    await supabase.auth.signOut();
  });

  async function createTestData(userId: string) {
    // 1. Create a batch test run
    const { data: testRun, error: runError } = await supabase
      .from('batch_test_runs')
      .insert({
        model_name: 'test-model',
        status: 'completed',
        total_prompts: 3,
        completed_prompts: 3,
        failed_prompts: 0,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) throw new Error(`Failed to create test run: ${runError.message}`);
    testRunId = testRun.id;

    // 2. Create test messages
    const messages = [
      {
        role: 'assistant',
        content: 'Test response 1',
        test_run_id: testRunId,
        created_by: userId,
      },
      {
        role: 'assistant',
        content: 'Test response 2',
        test_run_id: testRunId,
        created_by: userId,
      },
      {
        role: 'assistant',
        content: 'Test response 3',
        test_run_id: testRunId,
        created_by: userId,
      },
    ];

    const { data: createdMessages, error: msgError } = await supabase
      .from('messages')
      .insert(messages)
      .select();

    if (msgError) throw new Error(`Failed to create messages: ${msgError.message}`);
    messageIds = createdMessages.map((m: Message) => m.id);

    // 3. Create test judgments (validators)
    const judgments = [
      // Validator 1: must_cite_if_claims - 2/3 pass (67%)
      {
        message_id: messageIds[0],
        judge_type: 'validator',
        judge_name: 'must_cite_if_claims',
        criterion: 'has_citation',
        score: 1,
        passed: true,
        evidence_json: {},
      },
      {
        message_id: messageIds[1],
        judge_type: 'validator',
        judge_name: 'must_cite_if_claims',
        criterion: 'has_citation',
        score: 1,
        passed: true,
        evidence_json: {},
      },
      {
        message_id: messageIds[2],
        judge_type: 'validator',
        judge_name: 'must_cite_if_claims',
        criterion: 'has_citation',
        score: 0,
        passed: false,
        evidence_json: {},
      },
      // Validator 2: format_ok - 3/3 pass (100%)
      {
        message_id: messageIds[0],
        judge_type: 'validator',
        judge_name: 'format_ok',
        criterion: 'valid_json',
        score: 1,
        passed: true,
        evidence_json: {},
      },
      {
        message_id: messageIds[1],
        judge_type: 'validator',
        judge_name: 'format_ok',
        criterion: 'valid_json',
        score: 1,
        passed: true,
        evidence_json: {},
      },
      {
        message_id: messageIds[2],
        judge_type: 'validator',
        judge_name: 'format_ok',
        criterion: 'valid_json',
        score: 1,
        passed: true,
        evidence_json: {},
      },
      // Basic judgment (should be excluded)
      {
        message_id: messageIds[0],
        judge_type: 'basic',
        judge_name: 'basic_quality',
        criterion: 'quality',
        score: 8,
        passed: true,
        evidence_json: {},
      },
    ];

    const { error: judgeError } = await supabase
      .from('judgments')
      .insert(judgments);

    if (judgeError) throw new Error(`Failed to create judgments: ${judgeError.message}`);
    console.log('✓ Created test data:', testRunId);
  }

  describe('GET /api/batch-testing/[id]/validators', () => {
    it('should fetch validator breakdown for test run', async () => {
      const response = await fetch(
        `${BASE_URL}/api/batch-testing/${testRunId}/validators`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.total_messages).toBe(3);
      expect(data.validators).toBeDefined();
      expect(Array.isArray(data.validators)).toBe(true);
    });

    it('should return correct validator statistics', async () => {
      const response = await fetch(
        `${BASE_URL}/api/batch-testing/${testRunId}/validators`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      const data = await response.json();

      // Should have 2 validators (excluding basic)
      expect(data.validators).toHaveLength(2);

      // Find each validator
      const mustCite = data.validators.find(
        (v: Validator) => v.judge_name === 'must_cite_if_claims'
      );
      const formatOk = data.validators.find(
        (v: Validator) => v.judge_name === 'format_ok'
      );

      expect(mustCite).toBeDefined();
      expect(mustCite.total).toBe(3);
      expect(mustCite.passed).toBe(2);
      expect(mustCite.failed).toBe(1);
      expect(mustCite.pass_rate).toBe(67); // 2/3 = 66.67 rounded to 67

      expect(formatOk).toBeDefined();
      expect(formatOk.total).toBe(3);
      expect(formatOk.passed).toBe(3);
      expect(formatOk.failed).toBe(0);
      expect(formatOk.pass_rate).toBe(100);
    });

    it('should sort validators by pass_rate ascending', async () => {
      const response = await fetch(
        `${BASE_URL}/api/batch-testing/${testRunId}/validators`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      const data = await response.json();

      // First validator should have lower pass rate
      expect(data.validators[0].pass_rate).toBeLessThanOrEqual(
        data.validators[1].pass_rate
      );

      // Specifically, must_cite_if_claims (67%) should come before format_ok (100%)
      expect(data.validators[0].judge_name).toBe('must_cite_if_claims');
      expect(data.validators[1].judge_name).toBe('format_ok');
    });

    it('should exclude basic judgments from results', async () => {
      const response = await fetch(
        `${BASE_URL}/api/batch-testing/${testRunId}/validators`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      const data = await response.json();

      // Should not include the basic_quality judge
      const basicJudge = data.validators.find(
        (v: Validator) => v.judge_type === 'basic'
      );
      expect(basicJudge).toBeUndefined();
    });

    it('should include per-criterion breakdown', async () => {
      const response = await fetch(
        `${BASE_URL}/api/batch-testing/${testRunId}/validators`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      const data = await response.json();

      const mustCite = data.validators.find(
        (v: Validator) => v.judge_name === 'must_cite_if_claims'
      );

      expect(mustCite.criteria).toBeDefined();
      expect(mustCite.criteria.has_citation).toBeDefined();
      expect(mustCite.criteria.has_citation.total).toBe(3);
      expect(mustCite.criteria.has_citation.passed).toBe(2);
      expect(mustCite.criteria.has_citation.failed).toBe(1);
    });

    it('should return empty array for non-existent test run', async () => {
      const response = await fetch(
        `${BASE_URL}/api/batch-testing/non_existent_run/validators`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.validators).toEqual([]);
      expect(data.total_messages).toBe(0);
    });
  });
});
