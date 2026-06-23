/**
 * LLM-Judge API Route Tests
 * Tests: /api/evaluation/judge endpoint
 * Coverage: Authentication, single/batch evaluation, criteria handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/evaluation/judge/route';
import { createClient } from '@supabase/supabase-js';
import { LLMJudge, STANDARD_CRITERIA } from '@/lib/evaluation/llm-judge';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

// Mock LLMJudge + STANDARD_CRITERIA
vi.mock('@/lib/evaluation/llm-judge', () => ({
  LLMJudge: vi.fn().mockImplementation(function () {
    return {
      judgeMessage: vi.fn(),
      batchJudge: vi.fn(),
    };
  }),
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

// Mock GraphRAG so the route's graphragService.enhancePrompt is a no-op
vi.mock('@/lib/graphrag', () => ({
  graphragService: {
    enhancePrompt: vi.fn(async () => ({
      contextUsed: false,
      sources: [],
      metadata: {},
    })),
  },
}));

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

type QueryResult = { data: unknown; error: unknown };

/**
 * Build a chainable query builder where every chain method returns the same
 * builder, and the builder is also thenable so `await` resolves to `result`.
 * `.single()` resolves to `singleResult` when provided, otherwise `result`.
 */
function makeBuilder(result: QueryResult, singleResult?: QueryResult) {
  const builder: Record<string, unknown> = {};
  const passthrough = () => builder;
  for (const method of ['select', 'eq', 'in', 'lt', 'order', 'limit', 'update']) {
    builder[method] = vi.fn(passthrough);
  }
  builder.single = vi.fn(async () => (singleResult ?? result));
  // Make the builder awaitable (resolves to `result`).
  builder.then = (resolve: (v: QueryResult) => unknown) => resolve(result);
  return builder;
}

interface ClientOptions {
  user?: { id: string } | null;
  authError?: unknown;
  // result builders per table
  messageSingle?: QueryResult; // first messages.select(...).single()
  prevMessageSingle?: QueryResult; // preceding user message single()
  messagesList?: QueryResult; // batch messages.select(...).in('id', ...)
  userMessagesList?: QueryResult; // batch user messages
  tracesResult?: QueryResult; // llm_traces select
  insertResult?: QueryResult; // judgments insert
  insertFn?: ReturnType<typeof vi.fn>;
}

function makeClient(opts: ClientOptions = {}) {
  const {
    user = { id: 'user_123' },
    authError = null,
    messageSingle = { data: { content: 'Message from DB', conversation_id: 'conv_1', created_at: '2026-01-01T00:00:00Z' }, error: null },
    prevMessageSingle = { data: null, error: null },
    messagesList = { data: [], error: null },
    userMessagesList = { data: [], error: null },
    tracesResult = { data: [], error: null },
    insertResult = { error: null },
    insertFn,
  } = opts;

  const insert = insertFn ?? vi.fn(async () => insertResult);

  // Track how many times the `messages` table single-chain has been consumed so
  // the first call returns the assistant message and the second returns the
  // preceding user message.
  let messagesSingleCall = 0;

  const from = vi.fn((table: string) => {
    if (table === 'messages') {
      // Builder whose `.single()` alternates between message + prev message,
      // and whose awaited (`.in('id', ...)`) result returns the batch list.
      const builder = makeBuilder(messagesList);
      builder.single = vi.fn(async () => {
        messagesSingleCall += 1;
        return messagesSingleCall === 1 ? messageSingle : prevMessageSingle;
      });
      // For the batch user-message query, `.in('conversation_id', ...)` ends in
      // `.order(...)` which is awaited. The default builder result is
      // messagesList; we need user messages there instead. Distinguish by the
      // first `.in` argument.
      builder.in = vi.fn((col: string) => {
        if (col === 'conversation_id') {
          return makeBuilder(userMessagesList);
        }
        // 'id' -> batch list path
        return makeBuilder(messagesList);
      });
      return builder;
    }
    if (table === 'llm_traces') {
      return makeBuilder(tracesResult);
    }
    if (table === 'judgments') {
      const builder = makeBuilder(insertResult);
      builder.insert = insert;
      return builder;
    }
    return makeBuilder({ data: null, error: null });
  });

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: authError })),
    },
    from,
    __insert: insert,
  };
}

describe('/api/evaluation/judge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      vi.mocked(createClient).mockReturnValue(
        makeClient({ user: null, authError: new Error('invalid') }) as unknown as ReturnType<typeof createClient>
      );

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
      vi.clearAllMocks();
      vi.mocked(createClient).mockReturnValue(
        makeClient() as unknown as ReturnType<typeof createClient>
      );
    });

    it('should evaluate a message with provided content', async () => {
      const mockJudge = {
        judgeMessage: vi.fn().mockResolvedValue([
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
      vi.mocked(LLMJudge).mockImplementation(function () { return mockJudge as unknown as LLMJudge; });

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
      const mockJudge = {
        judgeMessage: vi.fn().mockResolvedValue([
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
      vi.mocked(LLMJudge).mockImplementation(function () { return mockJudge as unknown as LLMJudge; });

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
      vi.mocked(createClient).mockReturnValueOnce(
        makeClient({
          messageSingle: { data: null, error: new Error('Not found') },
        }) as unknown as ReturnType<typeof createClient>
      );

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
      const mockJudge = {
        judgeMessage: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(LLMJudge).mockImplementation(function () { return mockJudge as unknown as LLMJudge; });

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
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(createClient).mockReturnValue(
        makeClient({ insertFn: mockInsert }) as unknown as ReturnType<typeof createClient>
      );

      const mockJudge = {
        judgeMessage: vi.fn().mockResolvedValue([
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
      vi.mocked(LLMJudge).mockImplementation(function () { return mockJudge as unknown as LLMJudge; });

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
            // score is normalized to /10 when saved (8 -> 0.8)
            score: 0.8,
            passed: true,
          }),
        ])
      );
    });
  });

  describe('POST - Batch Evaluation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should evaluate multiple messages in batch', async () => {
      vi.mocked(createClient).mockReturnValue(
        makeClient({
          messagesList: {
            data: [
              { id: 'msg_1', content: 'Response 1', conversation_id: 'conv_1', created_at: '2026-01-01T00:00:00Z', role: 'assistant' },
              { id: 'msg_2', content: 'Response 2', conversation_id: 'conv_2', created_at: '2026-01-01T00:00:00Z', role: 'assistant' },
            ],
            error: null,
          },
        }) as unknown as ReturnType<typeof createClient>
      );

      const mockJudge = {
        batchJudge: vi.fn().mockResolvedValue(
          new Map([
            ['msg_1', [{ message_id: 'msg_1', criterion: 'helpfulness', score: 8, passed: true, reasoning: 'Good', judge_model: 'gpt-4-turbo', confidence: 0.9, evidence: { positive_aspects: [], negative_aspects: [], improvement_suggestions: [] } }]],
            ['msg_2', [{ message_id: 'msg_2', criterion: 'helpfulness', score: 7, passed: true, reasoning: 'OK', judge_model: 'gpt-4-turbo', confidence: 0.8, evidence: { positive_aspects: [], negative_aspects: [], improvement_suggestions: [] } }]],
          ])
        ),
      };
      vi.mocked(LLMJudge).mockImplementation(function () { return mockJudge as unknown as LLMJudge; });

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
      vi.mocked(createClient).mockReturnValue(
        makeClient({ messagesList: { data: [], error: null } }) as unknown as ReturnType<typeof createClient>
      );

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
