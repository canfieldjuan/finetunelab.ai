/**
 * Validator Breakdown API Route Tests
 * Tests: /api/batch-testing/[id]/validators endpoint (GET)
 * Coverage: Validator statistics, grouping, pass rate calculations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/batch-testing/[id]/validators/route';

// `mockEq` resolves the `messages` query, `mockNeq` resolves the `judgments` query.
const { mockEq, mockNeq } = vi.hoisted(() => ({
  mockEq: vi.fn(),
  mockNeq: vi.fn(),
}));

// Mock Supabase. The route always:
//  1. Verifies ownership against `batch_test_runs` (.eq().eq().single())
//  2. Loads `conversations` for the run (.eq())
//  3. Loads `messages` for those conversations (.in())  -> resolved by mockEq
//  4. Loads `judgments` for those messages (.in().neq()) -> resolved by mockNeq
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table) => {
      if (table === 'batch_test_runs') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({ data: { id: 'run_123' }, error: null })
                ),
              })),
            })),
          })),
        };
      }
      if (table === 'conversations') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() =>
              Promise.resolve({ data: [{ id: 'conv_1' }], error: null })
            ),
          })),
        };
      }
      if (table === 'messages') {
        return {
          select: vi.fn(() => ({
            in: mockEq,
          })),
        };
      }
      if (table === 'judgments') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              neq: mockNeq,
            })),
          })),
        };
      }
      return {};
    }),
  })),
}));

// Mock API-key auth so the route takes the deterministic apiKey path.
vi.mock('@/lib/auth/api-key-validator', () => ({
  validateRequestWithScope: vi.fn(() =>
    Promise.resolve({ isValid: true, userId: 'user_123' })
  ),
  extractApiKeyFromHeaders: vi.fn(() => 'wak_test_key'),
}));

function makeRequest() {
  return new NextRequest(
    'http://localhost:3000/api/batch-testing/run_123/validators',
    { headers: { 'x-api-key': 'wak_test_key' } }
  );
}

describe('/api/batch-testing/[id]/validators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET - Validator Breakdown', () => {
    it('should return empty array when no messages found', async () => {
      mockEq.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const request = makeRequest();
      const response = await GET(request, { params: Promise.resolve({ id: 'run_123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.validators).toEqual([]);
      expect(data.total_messages).toBe(0);
    });

    it('should return empty array when no judgments found', async () => {
      const mockMessages = [
        { id: 'msg_1' },
        { id: 'msg_2' },
      ];

      mockEq.mockResolvedValueOnce({
        data: mockMessages,
        error: null,
      });

      mockNeq.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const request = makeRequest();
      const response = await GET(request, { params: Promise.resolve({ id: 'run_123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.validators).toEqual([]);
      expect(data.total_messages).toBe(2);
    });

    it('should calculate validator statistics correctly', async () => {
      const mockMessages = [
        { id: 'msg_1' },
        { id: 'msg_2' },
        { id: 'msg_3' },
      ];

      const mockJudgments = [
        {
          message_id: 'msg_1',
          judge_name: 'must_cite_if_claims',
          judge_type: 'validator',
          criterion: 'has_citation',
          passed: true,
        },
        {
          message_id: 'msg_2',
          judge_name: 'must_cite_if_claims',
          judge_type: 'validator',
          criterion: 'has_citation',
          passed: true,
        },
        {
          message_id: 'msg_3',
          judge_name: 'must_cite_if_claims',
          judge_type: 'validator',
          criterion: 'has_citation',
          passed: false,
        },
      ];

      mockEq.mockResolvedValueOnce({
        data: mockMessages,
        error: null,
      });

      mockNeq.mockResolvedValueOnce({
        data: mockJudgments,
        error: null,
      });

      const request = makeRequest();
      const response = await GET(request, { params: Promise.resolve({ id: 'run_123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.total_messages).toBe(3);
      expect(data.validators).toHaveLength(1);

      const validator = data.validators[0];
      expect(validator.judge_name).toBe('must_cite_if_claims');
      expect(validator.total).toBe(3);
      expect(validator.passed).toBe(2);
      expect(validator.failed).toBe(1);
      expect(validator.pass_rate).toBe(67); // 2/3 = 66.67 rounded to 67
    });

    it('should group multiple validators separately', async () => {
      const mockMessages = [
        { id: 'msg_1' },
        { id: 'msg_2' },
      ];

      const mockJudgments = [
        {
          message_id: 'msg_1',
          judge_name: 'must_cite_if_claims',
          judge_type: 'validator',
          criterion: 'has_citation',
          passed: true,
        },
        {
          message_id: 'msg_2',
          judge_name: 'must_cite_if_claims',
          judge_type: 'validator',
          criterion: 'has_citation',
          passed: false,
        },
        {
          message_id: 'msg_1',
          judge_name: 'format_ok',
          judge_type: 'validator',
          criterion: 'valid_json',
          passed: true,
        },
        {
          message_id: 'msg_2',
          judge_name: 'format_ok',
          judge_type: 'validator',
          criterion: 'valid_json',
          passed: true,
        },
      ];

      mockEq.mockResolvedValueOnce({
        data: mockMessages,
        error: null,
      });

      mockNeq.mockResolvedValueOnce({
        data: mockJudgments,
        error: null,
      });

      const request = makeRequest();
      const response = await GET(request, { params: Promise.resolve({ id: 'run_123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.validators).toHaveLength(2);

      // Should be sorted by pass_rate (lowest first)
      const [lowestPassRate, highestPassRate] = data.validators;
      expect(lowestPassRate.pass_rate).toBeLessThanOrEqual(highestPassRate.pass_rate);
    });

    it('should calculate per-criterion statistics', async () => {
      const mockMessages = [{ id: 'msg_1' }];

      const mockJudgments = [
        {
          message_id: 'msg_1',
          judge_name: 'must_cite_if_claims',
          judge_type: 'validator',
          criterion: 'has_citation',
          passed: true,
        },
        {
          message_id: 'msg_1',
          judge_name: 'must_cite_if_claims',
          judge_type: 'validator',
          criterion: 'citation_format',
          passed: false,
        },
      ];

      mockEq.mockResolvedValueOnce({
        data: mockMessages,
        error: null,
      });

      mockNeq.mockResolvedValueOnce({
        data: mockJudgments,
        error: null,
      });

      const request = makeRequest();
      const response = await GET(request, { params: Promise.resolve({ id: 'run_123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      const validator = data.validators[0];
      expect(validator.criteria).toBeDefined();
      expect(validator.criteria.has_citation).toEqual({
        total: 1,
        passed: 1,
        failed: 0,
      });
      expect(validator.criteria.citation_format).toEqual({
        total: 1,
        passed: 0,
        failed: 1,
      });
    });

    it('should exclude basic judgments', async () => {
      const mockMessages = [{ id: 'msg_1' }];

      const mockJudgments = [
        {
          message_id: 'msg_1',
          judge_name: 'basic_quality',
          judge_type: 'basic',
          criterion: 'quality',
          passed: true,
        },
        {
          message_id: 'msg_1',
          judge_name: 'must_cite_if_claims',
          judge_type: 'validator',
          criterion: 'has_citation',
          passed: true,
        },
      ];

      mockEq.mockResolvedValueOnce({
        data: mockMessages,
        error: null,
      });

      // The neq filter should exclude 'basic' judge_type
      mockNeq.mockResolvedValueOnce({
        data: mockJudgments.filter(j => j.judge_type !== 'basic'),
        error: null,
      });

      const request = makeRequest();
      const response = await GET(request, { params: Promise.resolve({ id: 'run_123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only have 1 validator (not the basic one)
      expect(data.validators).toHaveLength(1);
      expect(data.validators[0].judge_name).toBe('must_cite_if_claims');
    });

    it('should handle database errors for messages query', async () => {
      mockEq.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      });

      const request = makeRequest();
      const response = await GET(request, { params: Promise.resolve({ id: 'run_123' }) });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch messages');
    });

    it('should handle database errors for judgments query', async () => {
      mockEq.mockResolvedValueOnce({
        data: [{ id: 'msg_1' }],
        error: null,
      });

      mockNeq.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      });

      const request = makeRequest();
      const response = await GET(request, { params: Promise.resolve({ id: 'run_123' }) });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch judgments');
    });

    it('should sort validators by pass_rate ascending', async () => {
      const mockMessages = [
        { id: 'msg_1' },
        { id: 'msg_2' },
        { id: 'msg_3' },
      ];

      const mockJudgments = [
        // Validator 1: 3/3 = 100%
        { message_id: 'msg_1', judge_name: 'validator_high', judge_type: 'validator', criterion: 'test', passed: true },
        { message_id: 'msg_2', judge_name: 'validator_high', judge_type: 'validator', criterion: 'test', passed: true },
        { message_id: 'msg_3', judge_name: 'validator_high', judge_type: 'validator', criterion: 'test', passed: true },
        // Validator 2: 1/3 = 33%
        { message_id: 'msg_1', judge_name: 'validator_low', judge_type: 'validator', criterion: 'test', passed: true },
        { message_id: 'msg_2', judge_name: 'validator_low', judge_type: 'validator', criterion: 'test', passed: false },
        { message_id: 'msg_3', judge_name: 'validator_low', judge_type: 'validator', criterion: 'test', passed: false },
        // Validator 3: 2/3 = 67%
        { message_id: 'msg_1', judge_name: 'validator_mid', judge_type: 'validator', criterion: 'test', passed: true },
        { message_id: 'msg_2', judge_name: 'validator_mid', judge_type: 'validator', criterion: 'test', passed: true },
        { message_id: 'msg_3', judge_name: 'validator_mid', judge_type: 'validator', criterion: 'test', passed: false },
      ];

      mockEq.mockResolvedValueOnce({
        data: mockMessages,
        error: null,
      });

      mockNeq.mockResolvedValueOnce({
        data: mockJudgments,
        error: null,
      });

      const request = makeRequest();
      const response = await GET(request, { params: Promise.resolve({ id: 'run_123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.validators).toHaveLength(3);
      expect(data.validators[0].judge_name).toBe('validator_low');
      expect(data.validators[0].pass_rate).toBe(33);
      expect(data.validators[1].judge_name).toBe('validator_mid');
      expect(data.validators[1].pass_rate).toBe(67);
      expect(data.validators[2].judge_name).toBe('validator_high');
      expect(data.validators[2].pass_rate).toBe(100);
    });
  });
});
