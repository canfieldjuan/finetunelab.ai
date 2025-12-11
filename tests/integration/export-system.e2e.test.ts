/**
 * Export System E2E Tests
 * Tests conversation export generation, download, and archive functionality
 * Date: 2025-10-17
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token-placeholder';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface TestContext {
  userId: string;
  conversationIds: string[];
  exportIds: string[];
  messageCount: number;
}

const testContext: TestContext = {
  userId: '',
  conversationIds: [],
  exportIds: [],
  messageCount: 0,
};

describe('Export System E2E Tests', () => {
  console.log('[Export-E2E] Starting Export System E2E tests');

  beforeAll(async () => {
    console.log('[Export-E2E] Setting up test data');

    // Set auth session
    const token = TEST_AUTH_TOKEN.replace('Bearer ', '');
    const { data: { session }, error: sessionError } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: token,
    });

    if (sessionError || !session) {
      throw new Error(`Auth failed: ${sessionError?.message || 'No session found'}`);
    }

    testContext.userId = session.user.id;

    // Create test conversations with messages
    for (let i = 0; i < 2; i++) {
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          user_id: testContext.userId,
          title: `Export Test Conversation ${i + 1}`,
        })
        .select()
        .single();

      if (convError) throw convError;
      testContext.conversationIds.push(conversation.id);

      // Add messages to conversation
      const messages = [
        {
          conversation_id: conversation.id,
          user_id: testContext.userId,
          role: 'user',
          content: 'Test user message for export',
        },
        {
          conversation_id: conversation.id,
          user_id: testContext.userId,
          role: 'assistant',
          content: 'Test assistant response for export',
          model_id: 'gpt-4',
          provider: 'openai',
        },
      ];

      const { error: msgError } = await supabase
        .from('messages')
        .insert(messages);

      if (msgError) throw msgError;
      testContext.messageCount += 2;
    }

    console.log('[Export-E2E] Test data created:', {
      conversations: testContext.conversationIds.length,
      messages: testContext.messageCount,
    });
  });

  afterAll(async () => {
    console.log('[Export-E2E] Cleaning up test data');
    await cleanup();
  });

  test('should generate markdown export', async () => {
    console.log('[Export-E2E] Test 1: Generating markdown export');

    const exportPayload = {
      conversationIds: testContext.conversationIds,
      format: 'markdown',
      includeMetadata: true,
      includeSystemMessages: false,
      title: 'Test Markdown Export',
    };

    const response = await fetch(`${API_BASE_URL}/api/export/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(exportPayload),
    });

    console.log('[Export-E2E] Export generation response status:', response.status);
    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[Export-E2E] Export generated:', data.export?.id);

    expect(data.success).toBe(true);
    expect(data.export).toBeDefined();
    expect(data.export.id).toBeDefined();
    expect(data.export.format).toBe('markdown');
    expect(data.export.conversationCount).toBe(2);
    expect(data.export.messageCount).toBe(testContext.messageCount);
    expect(data.export.downloadUrl).toBeDefined();

    testContext.exportIds.push(data.export.id);
  }, 30000);

  test('should generate JSON export', async () => {
    console.log('[Export-E2E] Test 2: Generating JSON export');

    const exportPayload = {
      conversationIds: testContext.conversationIds,
      format: 'json',
      includeMetadata: true,
      title: 'Test JSON Export',
    };

    const response = await fetch(`${API_BASE_URL}/api/export/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(exportPayload),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[Export-E2E] JSON export generated:', data.export?.id);

    expect(data.export.format).toBe('json');
    testContext.exportIds.push(data.export.id);
  }, 30000);

  test('should generate JSONL export', async () => {
    console.log('[Export-E2E] Test 3: Generating JSONL export');

    const exportPayload = {
      conversationIds: testContext.conversationIds,
      format: 'jsonl',
      includeMetadata: false,
      title: 'Test JSONL Export',
    };

    const response = await fetch(`${API_BASE_URL}/api/export/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(exportPayload),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[Export-E2E] JSONL export generated:', data.export?.id);

    expect(data.export.format).toBe('jsonl');
    testContext.exportIds.push(data.export.id);
  }, 30000);

  test('should generate TXT export', async () => {
    console.log('[Export-E2E] Test 4: Generating TXT export');

    const exportPayload = {
      conversationIds: testContext.conversationIds,
      format: 'txt',
      includeMetadata: false,
      includeSystemMessages: false,
    };

    const response = await fetch(`${API_BASE_URL}/api/export/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(exportPayload),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[Export-E2E] TXT export generated:', data.export?.id);

    expect(data.export.format).toBe('txt');
    testContext.exportIds.push(data.export.id);
  }, 30000);

  test('should download export file', async () => {
    console.log('[Export-E2E] Test 5: Downloading export file');

    const exportId = testContext.exportIds[0];
    const response = await fetch(
      `${API_BASE_URL}/api/export/download/${exportId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        },
      }
    );

    console.log('[Export-E2E] Download response status:', response.status);
    expect(response.status).toBe(200);

    const content = await response.text();
    console.log('[Export-E2E] Downloaded content length:', content.length);

    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain('Test user message for export');
  }, 30000);

  test('should delete export', async () => {
    console.log('[Export-E2E] Test 6: Deleting export');

    const exportId = testContext.exportIds[0];
    const response = await fetch(
      `${API_BASE_URL}/api/export/download/${exportId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        },
      }
    );

    console.log('[Export-E2E] Delete response status:', response.status);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
  }, 30000);

  test('should reject invalid format', async () => {
    console.log('[Export-E2E] Test 7: Testing invalid format rejection');

    const exportPayload = {
      conversationIds: testContext.conversationIds,
      format: 'invalid-format',
    };

    const response = await fetch(`${API_BASE_URL}/api/export/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(exportPayload),
    });

    console.log('[Export-E2E] Invalid format response status:', response.status);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('Invalid format');
  }, 30000);

  test('should reject empty conversation IDs', async () => {
    console.log('[Export-E2E] Test 8: Testing empty conversation IDs rejection');

    const exportPayload = {
      conversationIds: [],
      format: 'markdown',
    };

    const response = await fetch(`${API_BASE_URL}/api/export/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(exportPayload),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('conversationIds');
  }, 30000);
});

async function cleanup(): Promise<void> {
  console.log('[Export-E2E] Starting cleanup');

  // Delete exports from storage
  for (const exportId of testContext.exportIds) {
    try {
      await fetch(`${API_BASE_URL}/api/export/download/${exportId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        },
      });
      console.log('[Export-E2E] Deleted export:', exportId);
    } catch (error) {
      console.log('[Export-E2E] Export cleanup error:', error);
    }
  }

  // Delete conversations (cascade deletes messages)
  if (testContext.conversationIds.length > 0) {
    const { error: convError } = await supabase
      .from('conversations')
      .delete()
      .in('id', testContext.conversationIds);

    if (convError) {
      console.log('[Export-E2E] Conversation cleanup error:', convError);
    } else {
      console.log('[Export-E2E] Deleted conversations:', testContext.conversationIds.length);
    }
  }

  console.log('[Export-E2E] Cleanup complete');
}

console.log('[Export-E2E] Test suite loaded');
