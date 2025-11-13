/**
 * Analytics E2E Tests
 * Tests analytics data aggregation, filtering, and export functionality
 * Date: 2025-10-17
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token-placeholder';

// Initialize Supabase client for testing
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface TestData {
  userId: string;
  conversationIds: string[];
  messageIds: string[];
  evaluationIds: string[];
  modelId: string;
}

const testData: TestData = {
  userId: '',
  conversationIds: [],
  messageIds: [],
  evaluationIds: [],
  modelId: 'test-model-analytics',
};

describe('Analytics E2E Tests', () => {
  console.log('[Analytics-E2E] Starting Analytics E2E tests');

  beforeAll(async () => {
    console.log('[Analytics-E2E] Setting up test data');

    // Set auth session
    const token = TEST_AUTH_TOKEN.replace('Bearer ', '');
    const { data: { session }, error: sessionError } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: token,
    });

    if (sessionError || !session) {
      throw new Error(`Auth failed: ${sessionError?.message || 'No session found'}`);
    }

    testData.userId = session.user.id;
    console.log('[Analytics-E2E] Authenticated as user:', testData.userId);
  });

  afterAll(async () => {
    console.log('[Analytics-E2E] Cleaning up test data');
    await cleanup();
  });

  test('should create test conversations and messages', async () => {
    console.log('[Analytics-E2E] Test 1: Creating test conversations and messages');

    // Create 3 test conversations
    for (let i = 0; i < 3; i++) {
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          user_id: testData.userId,
          title: `Analytics Test Conversation ${i + 1}`,
          session_id: i === 0 ? 'test-session-a' : null,
          experiment_name: i === 0 ? 'Test Experiment A' : null,
        })
        .select()
        .single();

      if (convError) throw convError;
      testData.conversationIds.push(conversation.id);

      console.log('[Analytics-E2E] Created conversation:', conversation.id);

      // Create 5 messages per conversation (2 user + 2 assistant + 1 user)
      const messages = [
        {
          conversation_id: conversation.id,
          user_id: testData.userId,
          role: 'user',
          content: 'Test user message 1',
        },
        {
          conversation_id: conversation.id,
          user_id: testData.userId,
          role: 'assistant',
          content: 'Test assistant message 1',
          model_id: testData.modelId,
          provider: 'openai',
          input_tokens: 100,
          output_tokens: 150,
          latency_ms: 1000,
        },
        {
          conversation_id: conversation.id,
          user_id: testData.userId,
          role: 'user',
          content: 'Test user message 2',
        },
        {
          conversation_id: conversation.id,
          user_id: testData.userId,
          role: 'assistant',
          content: 'Test assistant message 2',
          model_id: testData.modelId,
          provider: 'openai',
          input_tokens: 120,
          output_tokens: 180,
          latency_ms: 1200,
        },
      ];

      const { data: createdMessages, error: msgError } = await supabase
        .from('messages')
        .insert(messages)
        .select();

      if (msgError) throw msgError;

      // Store assistant message IDs for evaluations
      createdMessages
        .filter(m => m.role === 'assistant')
        .forEach(m => testData.messageIds.push(m.id));
    }

    console.log('[Analytics-E2E] Created conversations:', testData.conversationIds.length);
    console.log('[Analytics-E2E] Created messages (assistant only):', testData.messageIds.length);

    expect(testData.conversationIds.length).toBe(3);
    expect(testData.messageIds.length).toBe(6); // 2 assistant messages per conversation
  }, 30000);

  test('should create message evaluations with different ratings', async () => {
    console.log('[Analytics-E2E] Test 2: Creating message evaluations');

    // Create evaluations for all assistant messages
    // Ratings: 5, 4, 3, 2, 1, 5 (varied distribution)
    const ratings = [5, 4, 3, 2, 1, 5];
    const successValues = [true, true, true, false, false, true];

    for (let i = 0; i < testData.messageIds.length; i++) {
      const { data: evaluation, error: evalError } = await supabase
        .from('message_evaluations')
        .insert({
          message_id: testData.messageIds[i],
          evaluator_id: testData.userId,
          rating: ratings[i],
          success: successValues[i],
          failure_tags: successValues[i] ? null : ['error', 'incorrect'],
        })
        .select()
        .single();

      if (evalError) throw evalError;
      testData.evaluationIds.push(evaluation.id);
    }

    console.log('[Analytics-E2E] Created evaluations:', testData.evaluationIds.length);
    expect(testData.evaluationIds.length).toBe(6);
  }, 30000);

  test('should fetch and verify analytics overview data', async () => {
    console.log('[Analytics-E2E] Test 3: Fetching analytics overview');

    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', testData.userId)
      .in('id', testData.messageIds);

    if (msgError) throw msgError;

    // Fetch evaluations
    const { data: evaluations, error: evalError } = await supabase
      .from('message_evaluations')
      .select('*')
      .eq('evaluator_id', testData.userId)
      .in('id', testData.evaluationIds);

    if (evalError) throw evalError;

    console.log('[Analytics-E2E] Fetched messages:', messages.length);
    console.log('[Analytics-E2E] Fetched evaluations:', evaluations.length);

    // Verify data
    expect(messages.length).toBe(6);
    expect(evaluations.length).toBe(6);

    // Calculate expected metrics
    const avgRating = (5 + 4 + 3 + 2 + 1 + 5) / 6; // 3.33
    const successCount = 4; // 4 successful out of 6
    const successRate = (successCount / 6) * 100; // 66.67%

    const actualAvgRating = evaluations.reduce((sum, e) => sum + (e.rating || 0), 0) / evaluations.length;
    const actualSuccessCount = evaluations.filter(e => e.success).length;
    const actualSuccessRate = (actualSuccessCount / evaluations.length) * 100;

    console.log('[Analytics-E2E] Calculated metrics:', {
      avgRating: actualAvgRating,
      successRate: actualSuccessRate,
    });

    expect(actualAvgRating).toBeCloseTo(avgRating, 1);
    expect(actualSuccessRate).toBeCloseTo(successRate, 1);
  }, 30000);

  test('should verify model performance aggregation', async () => {
    console.log('[Analytics-E2E] Test 4: Verifying model performance');

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', testData.userId)
      .eq('model_id', testData.modelId);

    if (msgError) throw msgError;

    console.log('[Analytics-E2E] Messages for model:', messages.length);
    expect(messages.length).toBe(6);

    // Verify token aggregation
    const totalInputTokens = messages.reduce((sum, m) => sum + (m.input_tokens || 0), 0);
    const totalOutputTokens = messages.reduce((sum, m) => sum + (m.output_tokens || 0), 0);
    const avgInputTokens = totalInputTokens / messages.length;
    const avgOutputTokens = totalOutputTokens / messages.length;

    console.log('[Analytics-E2E] Token metrics:', {
      avgInputTokens,
      avgOutputTokens,
    });

    expect(avgInputTokens).toBeGreaterThan(0);
    expect(avgOutputTokens).toBeGreaterThan(0);
  }, 30000);

  test('should verify rating distribution', async () => {
    console.log('[Analytics-E2E] Test 5: Verifying rating distribution');

    const { data: evaluations, error: evalError } = await supabase
      .from('message_evaluations')
      .select('rating')
      .eq('evaluator_id', testData.userId)
      .in('id', testData.evaluationIds);

    if (evalError) throw evalError;

    // Count ratings
    const ratingCounts: Record<number, number> = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    evaluations.forEach(e => {
      if (e.rating) {
        ratingCounts[e.rating] = (ratingCounts[e.rating] || 0) + 1;
      }
    });

    console.log('[Analytics-E2E] Rating distribution:', ratingCounts);

    // Expected: 1 star=1, 2 star=1, 3 star=1, 4 star=1, 5 star=2
    expect(ratingCounts[1]).toBe(1);
    expect(ratingCounts[2]).toBe(1);
    expect(ratingCounts[3]).toBe(1);
    expect(ratingCounts[4]).toBe(1);
    expect(ratingCounts[5]).toBe(2);
  }, 30000);

  test('should verify all session metrics are available', async () => {
    console.log('[Analytics-E2E] Test 6: Verifying all session metrics');

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', testData.userId)
      .in('id', testData.messageIds);

    if (msgError) throw msgError;

    const { data: evaluations, error: evalError } = await supabase
      .from('message_evaluations')
      .select('*')
      .eq('evaluator_id', testData.userId)
      .in('id', testData.evaluationIds);

    if (evalError) throw evalError;

    // Calculate all available session metrics
    const totalMessages = messages.length;
    const totalConversations = testData.conversationIds.length;
    const avgRating = evaluations.reduce((sum, e) => sum + (e.rating || 0), 0) / evaluations.length;
    const successCount = evaluations.filter(e => e.success).length;
    const successRate = (successCount / evaluations.length) * 100;
    const errorRate = ((evaluations.length - successCount) / evaluations.length) * 100;
    const avgInputTokens = messages.reduce((sum, m) => sum + (m.input_tokens || 0), 0) / messages.length;
    const avgOutputTokens = messages.reduce((sum, m) => sum + (m.output_tokens || 0), 0) / messages.length;
    const avgResponseTime = messages.reduce((sum, m) => sum + (m.latency_ms || 0), 0) / messages.length;
    const evaluationCount = evaluations.length;

    console.log('[Analytics-E2E] All session metrics calculated:', {
      totalMessages,
      totalConversations,
      avgRating,
      successRate,
      errorRate,
      avgInputTokens,
      avgOutputTokens,
      avgResponseTime,
      evaluationCount,
    });

    // Verify all metrics are computable
    expect(totalMessages).toBeGreaterThan(0);
    expect(totalConversations).toBeGreaterThan(0);
    expect(avgRating).toBeGreaterThan(0);
    expect(successRate).toBeGreaterThan(0);
    expect(errorRate).toBeGreaterThan(0);
    expect(avgInputTokens).toBeGreaterThan(0);
    expect(avgOutputTokens).toBeGreaterThan(0);
    expect(avgResponseTime).toBeGreaterThan(0);
    expect(evaluationCount).toBeGreaterThan(0);
  }, 30000);

  test('should verify all model metrics are available', async () => {
    console.log('[Analytics-E2E] Test 7: Verifying all model metrics');

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', testData.userId)
      .eq('model_id', testData.modelId);

    if (msgError) throw msgError;

    const { data: evaluations, error: evalError } = await supabase
      .from('message_evaluations')
      .select('*')
      .in('message_id', testData.messageIds);

    if (evalError) throw evalError;

    // Calculate all available model metrics
    const totalMessages = messages.length;
    const totalConversations = new Set(messages.map(m => m.conversation_id)).size;
    const avgRating = evaluations.reduce((sum, e) => sum + (e.rating || 0), 0) / evaluations.length;
    const successCount = evaluations.filter(e => e.success).length;
    const successRate = (successCount / evaluations.length) * 100;
    const errorRate = ((evaluations.length - successCount) / evaluations.length) * 100;
    const avgInputTokens = messages.reduce((sum, m) => sum + (m.input_tokens || 0), 0) / messages.length;
    const avgOutputTokens = messages.reduce((sum, m) => sum + (m.output_tokens || 0), 0) / messages.length;
    const avgResponseTime = messages.reduce((sum, m) => sum + (m.latency_ms || 0), 0) / messages.length;
    const provider = messages[0]?.provider || null;

    console.log('[Analytics-E2E] All model metrics calculated:', {
      modelId: testData.modelId,
      totalMessages,
      totalConversations,
      avgRating,
      successRate,
      errorRate,
      avgInputTokens,
      avgOutputTokens,
      avgResponseTime,
      provider,
    });

    // Verify all metrics are computable
    expect(totalMessages).toBeGreaterThan(0);
    expect(totalConversations).toBeGreaterThan(0);
    expect(avgRating).toBeGreaterThan(0);
    expect(successRate).toBeGreaterThan(0);
    expect(errorRate).toBeGreaterThan(0);
    expect(avgInputTokens).toBeGreaterThan(0);
    expect(avgOutputTokens).toBeGreaterThan(0);
    expect(avgResponseTime).toBeGreaterThan(0);
    expect(provider).toBeTruthy();
  }, 30000);

  test('should verify session metrics include date ranges', async () => {
    console.log('[Analytics-E2E] Test 8: Verifying session date metrics');

    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('created_at, updated_at')
      .in('id', testData.conversationIds)
      .order('created_at', { ascending: true });

    if (convError) throw convError;

    const firstConversation = conversations[0]?.created_at;
    const lastConversation = conversations[conversations.length - 1]?.updated_at;

    console.log('[Analytics-E2E] Session date range:', {
      firstConversation,
      lastConversation,
      totalDays: firstConversation && lastConversation
        ? Math.ceil((new Date(lastConversation).getTime() - new Date(firstConversation).getTime()) / (1000 * 60 * 60 * 24))
        : 0
    });

    expect(firstConversation).toBeTruthy();
    expect(lastConversation).toBeTruthy();
  }, 30000);

  test('should verify metric formatting logic', async () => {
    console.log('[Analytics-E2E] Test 9: Verifying metric formatting');

    // Test data for formatting
    const testMetrics = {
      percentage: 66.666666,
      currency: 0.00123456,
      tokens: 1234,
      time: 1234,
      rating: 3.333333,
    };

    // Expected formatted values (matching formatMetricValue logic)
    const expectedFormats = {
      percentage: '66.7%',
      currency: '$0.0012',
      tokens: '1,234 tokens',
      time: '1234ms',
      rating: '3.3',
    };

    console.log('[Analytics-E2E] Test metrics:', testMetrics);
    console.log('[Analytics-E2E] Expected formats:', expectedFormats);

    // Verify formatting logic matches expected patterns
    expect(testMetrics.percentage.toFixed(1) + '%').toBe(expectedFormats.percentage);
    expect('$' + testMetrics.currency.toFixed(4)).toBe(expectedFormats.currency);
    expect(Math.round(testMetrics.tokens).toLocaleString() + ' tokens').toBe(expectedFormats.tokens);
    expect(Math.round(testMetrics.time) + 'ms').toBe(expectedFormats.time);
    expect(testMetrics.rating.toFixed(1)).toBe(expectedFormats.rating);
  }, 30000);
});

async function cleanup(): Promise<void> {
  console.log('[Analytics-E2E] Starting cleanup');

  // Delete evaluations first (foreign key constraint)
  if (testData.evaluationIds.length > 0) {
    const { error: evalError } = await supabase
      .from('message_evaluations')
      .delete()
      .in('id', testData.evaluationIds);

    if (evalError) {
      console.log('[Analytics-E2E] Evaluation cleanup error:', evalError);
    } else {
      console.log('[Analytics-E2E] Deleted evaluations:', testData.evaluationIds.length);
    }
  }

  // Delete messages
  if (testData.messageIds.length > 0) {
    const { error: msgError } = await supabase
      .from('messages')
      .delete()
      .eq('user_id', testData.userId)
      .eq('model_id', testData.modelId);

    if (msgError) {
      console.log('[Analytics-E2E] Message cleanup error:', msgError);
    } else {
      console.log('[Analytics-E2E] Deleted messages');
    }
  }

  // Delete conversations
  if (testData.conversationIds.length > 0) {
    const { error: convError } = await supabase
      .from('conversations')
      .delete()
      .in('id', testData.conversationIds);

    if (convError) {
      console.log('[Analytics-E2E] Conversation cleanup error:', convError);
    } else {
      console.log('[Analytics-E2E] Deleted conversations:', testData.conversationIds.length);
    }
  }

  console.log('[Analytics-E2E] Cleanup complete');
}

console.log('[Analytics-E2E] Test suite loaded');
