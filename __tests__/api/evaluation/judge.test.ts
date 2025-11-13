/**
 * LLM-Judge API Route Tests
 * Tests: /api/evaluation/judge endpoint
 * Coverage: Authentication, single/batch evaluation, criteria handling
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/evaluation/judge/route';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(),
          })),
          in: jest.fn(),
        })),
        in: jest.fn(),
      })),
      insert: jest.fn(),
    })),
  })),
}));

// Mock LLMJudge
jest.mock('@/lib/evaluation/llm-judge', () => ({
  LLMJudge: jest.fn().mockImplementation(() => ({
    judgeMessage: jest.fn(),
    batchJudge: jest.fn(),
  })),
  STANDARD_CRITERIA: [
    {
      name: 'helpfulness',
      description: 'Test criterion',
      scoring_guide: 'Test guide',
      min_score: 1,
      max_score: 10,
      passing_score: 7,
    },
  ],
}));

describe('/api/evaluation/judge', () => {
  describe('POST - Authentication', () => {
    it('should reject requests without authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/evaluation/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: 'msg_123',
          message_content: 'Test message',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject requests with invalid auth token', async () => {
      const { createClient } = require('@supabase/supabase-js');
      createClient.mockReturnValueOnce({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: new Error('Invalid token'),
          }),
        },
      });

      const request = new NextRequest('http://localhost:3000/api/evaluation/judge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid_token',
        },
        body: JSON.stringify({
          message_id: 'msg_123',
          message_content: 'Test message',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });
  });

  describe('POST - Single Evaluation', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();

      // Setup auth mock
      const { createClient } = require('@supabase/supabase-js');
      createClient.mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user_123' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { content: 'Message from DB' },
                  error: null,
                }),
              })),
            })),
          })),
          insert: jest.fn().mockResolvedValue({ error: null }),
        })),
      });
    });

    it('should evaluate a message with provided content', async () => {
      const { LLMJudge } = require('@/lib/evaluation/llm-judge');
      const mockJudge = {
        judgeMessage: jest.fn().mockResolvedValue([
          {
            message_id: 'msg_123',
            criterion: 'helpfulness',
            score: 8,
            passed: true,
            reasoning: 'Good response',
            judge_model: 'gpt-4-turbo',
            confidence: 0.9,
            evidence: {
              positive_aspects: ['Clear'],
              negative_aspects: [],
              improvement_suggestions: [],
            },
          },
        ]),
      };
      LLMJudge.mockImplementation(() => mockJudge);

      const request = new NextRequest('http://localhost:3000/api/evaluation/judge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token',
        },
        body: JSON.stringify({
          message_id: 'msg_123',
          message_content: 'Test response content',
          criteria: ['helpfulness'],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message_id).toBe('msg_123');
      expect(data.evaluations).toHaveLength(1);
      expect(data.summary.total_criteria).toBe(1);
      expect(data.summary.passed).toBe(1);
    });

    it('should fetch message content from database if not provided', async () => {
      const { LLMJudge } = require('@/lib/evaluation/llm-judge');
      const mockJudge = {
        judgeMessage: jest.fn().mockResolvedValue([
          {
            message_id: 'msg_456',
            criterion: 'helpfulness',
            score: 7,
            passed: true,
            reasoning: 'Adequate',
            judge_model: 'gpt-4-turbo',
            confidence: 0.8,
            evidence: {
              positive_aspects: [],
              negative_aspects: [],
              improvement_suggestions: [],
            },
          },
        ]),
      };
      LLMJudge.mockImplementation(() => mockJudge);

      const request = new NextRequest('http://localhost:3000/api/evaluation/judge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token',
        },
        body: JSON.stringify({
          message_id: 'msg_456',
          // No message_content - should fetch from DB
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify judgeMessage was called with DB content
      expect(mockJudge.judgeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message_id: 'msg_456',
          message_content: 'Message from DB',
        })
      );
    });

    it('should return 404 if message not found in database', async () => {
      const { createClient } = require('@supabase/supabase-js');
      createClient.mockReturnValueOnce({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user_123' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: new Error('Not found'),
                }),
              })),
            })),
          })),
        })),
      });

      const request = new NextRequest('http://localhost:3000/api/evaluation/judge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token',
        },
        body: JSON.stringify({
          message_id: 'msg_nonexistent',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(404);
    });

    it('should use default criteria if none provided', async () => {
      const { LLMJudge, STANDARD_CRITERIA } = require('@/lib/evaluation/llm-judge');
      const mockJudge = {
        judgeMessage: jest.fn().mockResolvedValue([]),
      };
      LLMJudge.mockImplementation(() => mockJudge);

      const request = new NextRequest('http://localhost:3000/api/evaluation/judge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token',
        },
        body: JSON.stringify({
          message_id: 'msg_123',
          message_content: 'Test',
          // No criteria - should use STANDARD_CRITERIA
        }),
      });

      await POST(request);

      expect(mockJudge.judgeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          criteria: STANDARD_CRITERIA,
        })
      );
    });

    it('should save evaluations to database by default', async () => {
      const { LLMJudge } = require('@/lib/evaluation/llm-judge');
      const { createClient } = require('@supabase/supabase-js');
      
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      createClient.mockReturnValueOnce({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user_123' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { content: 'Test' },
                  error: null,
                }),
              })),
            })),
          })),
          insert: mockInsert,
        })),
      });

      const mockJudge = {
        judgeMessage: jest.fn().mockResolvedValue([
          {
            message_id: 'msg_123',
            criterion: 'helpfulness',
            score: 8,
            passed: true,
            reasoning: 'Good',
            judge_model: 'gpt-4-turbo',
            confidence: 0.9,
            evidence: {
              positive_aspects: ['Clear'],
              negative_aspects: [],
              improvement_suggestions: [],
            },
          },
        ]),
      };
      LLMJudge.mockImplementation(() => mockJudge);

      const request = new NextRequest('http://localhost:3000/api/evaluation/judge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token',
        },
        body: JSON.stringify({
          message_id: 'msg_123',
          message_content: 'Test',
        }),
      });

      await POST(request);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            message_id: 'msg_123',
            judge_type: 'llm',
            criterion: 'helpfulness',
            score: 8,
            passed: true,
          }),
        ])
      );
    });
  });

  describe('POST - Batch Evaluation', () => {
    beforeEach(() => {
      jest.clearAllMocks();

      const { createClient } = require('@supabase/supabase-js');
      createClient.mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user_123' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { id: 'msg_1', content: 'Message 1' },
                  { id: 'msg_2', content: 'Message 2' },
                ],
                error: null,
              }),
            })),
          })),
          insert: jest.fn().mockResolvedValue({ error: null }),
        })),
      });
    });

    it('should evaluate multiple messages in batch', async () => {
      const { LLMJudge } = require('@/lib/evaluation/llm-judge');
      const mockJudge = {
        batchJudge: jest.fn().mockResolvedValue(
          new Map([
            ['msg_1', [{ message_id: 'msg_1', criterion: 'helpfulness', score: 8, passed: true, reasoning: 'Good', judge_model: 'gpt-4-turbo', confidence: 0.9, evidence: { positive_aspects: [], negative_aspects: [], improvement_suggestions: [] } }]],
            ['msg_2', [{ message_id: 'msg_2', criterion: 'helpfulness', score: 7, passed: true, reasoning: 'OK', judge_model: 'gpt-4-turbo', confidence: 0.8, evidence: { positive_aspects: [], negative_aspects: [], improvement_suggestions: [] } }]],
          ])
        ),
      };
      LLMJudge.mockImplementation(() => mockJudge);

      const request = new NextRequest('http://localhost:3000/api/evaluation/judge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token',
        },
        body: JSON.stringify({
          message_ids: ['msg_1', 'msg_2'],
          criteria: ['helpfulness'],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.results).toHaveProperty('msg_1');
      expect(data.results).toHaveProperty('msg_2');
      expect(data.summary.total_messages).toBe(2);
      expect(data.summary.total_evaluations).toBe(2);
    });

    it('should return 404 if no messages found', async () => {
      const { createClient } = require('@supabase/supabase-js');
      createClient.mockReturnValueOnce({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user_123' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          })),
        })),
      });

      const request = new NextRequest('http://localhost:3000/api/evaluation/judge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token',
        },
        body: JSON.stringify({
          message_ids: ['msg_nonexistent'],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(404);
    });
  });

  describe('GET - Criteria Info', () => {
    it('should return standard criteria and available models', async () => {
      const response = await GET();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.standard_criteria).toBeDefined();
      expect(data.available_models).toContain('gpt-4');
      expect(data.available_models).toContain('claude-3-opus');
    });
  });
});
