/**
 * Chat and Evaluation E2E Tests
 * Tests core chat workflow and message evaluation functionality
 * Date: 2025-10-17
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token-placeholder';

interface TestContext {
  conversationId: string | null;
  messageIds: string[];
  evaluationIds: string[];
}

const testContext: TestContext = {
  conversationId: null,
  messageIds: [],
  evaluationIds: [],
};

describe('Chat and Evaluation E2E Tests', () => {
  console.log('[Chat-E2E] Starting Chat and Evaluation E2E tests');

  beforeAll(() => {
    console.log('[Chat-E2E] Test environment:', {
      apiUrl: API_BASE_URL,
      hasAuthToken: !!TEST_AUTH_TOKEN,
    });
  });

  afterAll(async () => {
    console.log('[Chat-E2E] Cleaning up test data');
    // Cleanup is handled by cascade delete on conversation
  });

  test('should send chat message and receive response', async () => {
    console.log('[Chat-E2E] Test 1: Sending chat message');

    const chatPayload = {
      message: 'Hello! This is a test message for e2e testing.',
      conversationId: null,
      modelId: 'gpt-4',
    };

    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(chatPayload),
    });

    console.log('[Chat-E2E] Chat response status:', response.status);
    expect(response.status).toBe(200);

    // Read streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    if (!reader) throw new Error('No response body');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      fullResponse += chunk;
    }

    console.log('[Chat-E2E] Response received, length:', fullResponse.length);
    expect(fullResponse.length).toBeGreaterThan(0);

    // Parse the response to extract conversation and message IDs
    const lines = fullResponse.split('\n').filter(line => line.trim());
    const dataLines = lines.filter(line => line.startsWith('data: '));

    for (const line of dataLines) {
      try {
        const data = JSON.parse(line.replace('data: ', ''));
        if (data.conversationId && !testContext.conversationId) {
          testContext.conversationId = data.conversationId;
          console.log('[Chat-E2E] Conversation created:', testContext.conversationId);
        }
        if (data.messageId && !testContext.messageIds.includes(data.messageId)) {
          testContext.messageIds.push(data.messageId);
          console.log('[Chat-E2E] Message ID captured:', data.messageId);
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    expect(testContext.conversationId).toBeTruthy();
    expect(testContext.messageIds.length).toBeGreaterThan(0);
  }, 60000);

  test('should send follow-up message in same conversation', async () => {
    console.log('[Chat-E2E] Test 2: Sending follow-up message');

    expect(testContext.conversationId).toBeTruthy();

    const chatPayload = {
      message: 'This is a follow-up message.',
      conversationId: testContext.conversationId,
      modelId: 'gpt-4',
    };

    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(chatPayload),
    });

    expect(response.status).toBe(200);

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    if (!reader) throw new Error('No response body');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullResponse += decoder.decode(value);
    }

    expect(fullResponse.length).toBeGreaterThan(0);
    console.log('[Chat-E2E] Follow-up message sent successfully');
  }, 60000);

  test('should evaluate message with rating and success flag', async () => {
    console.log('[Chat-E2E] Test 3: Evaluating message');

    // Get the first assistant message ID
    const assistantMessageId = testContext.messageIds.find(id => id);
    expect(assistantMessageId).toBeTruthy();

    const evaluationPayload = {
      messageId: assistantMessageId,
      rating: 5,
      success: true,
      failureTags: null,
    };

    const response = await fetch(`${API_BASE_URL}/api/evaluate-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(evaluationPayload),
    });

    console.log('[Chat-E2E] Evaluation response status:', response.status);
    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[Chat-E2E] Evaluation created:', data.evaluation?.id);

    expect(data.evaluation).toBeDefined();
    expect(data.evaluation.rating).toBe(5);
    expect(data.evaluation.success).toBe(true);

    testContext.evaluationIds.push(data.evaluation.id);
  }, 30000);

  test('should evaluate message with failure', async () => {
    console.log('[Chat-E2E] Test 4: Evaluating message with failure');

    const assistantMessageId = testContext.messageIds[testContext.messageIds.length - 1];
    expect(assistantMessageId).toBeTruthy();

    const evaluationPayload = {
      messageId: assistantMessageId,
      rating: 2,
      success: false,
      failureTags: ['incorrect', 'unhelpful'],
    };

    const response = await fetch(`${API_BASE_URL}/api/evaluate-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(evaluationPayload),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[Chat-E2E] Failure evaluation created:', data.evaluation?.id);

    expect(data.evaluation.rating).toBe(2);
    expect(data.evaluation.success).toBe(false);
    expect(data.evaluation.failure_tags).toEqual(['incorrect', 'unhelpful']);

    testContext.evaluationIds.push(data.evaluation.id);
  }, 30000);

  test('should update existing evaluation', async () => {
    console.log('[Chat-E2E] Test 5: Updating existing evaluation');

    const evaluationId = testContext.evaluationIds[0];
    const messageId = testContext.messageIds[0];

    const updatePayload = {
      messageId: messageId,
      rating: 4,
      success: true,
      failureTags: null,
    };

    const response = await fetch(`${API_BASE_URL}/api/evaluate-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(updatePayload),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[Chat-E2E] Evaluation updated:', data.evaluation?.id);

    expect(data.evaluation.rating).toBe(4);
    expect(data.evaluation.id).toBe(evaluationId); // Should be same ID (update, not create)
  }, 30000);
});

console.log('[Chat-E2E] Test suite loaded');
