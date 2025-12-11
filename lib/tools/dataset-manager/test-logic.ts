// Dataset Manager Tool - Test Logic
// Date: October 21, 2025

import { createClient } from '@supabase/supabase-js';
import datasetManagerTool from './index';
import { DatasetExport } from './types';

export async function runAdvancedFilterTests() {
  console.log('--- Running Advanced Filter Tests for Dataset Manager ---');

  // Create a Supabase client with service role privileges for testing
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ FATAL: Missing required environment variables.');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('[Setup] Using service role client for testing.');

  let testUserId: string;
  let conversationId: string;
  let messageId1: string, messageId2: string;

  // 1. Setup: Get or create test user
  console.log('\n[Setup] Looking for existing user...');
  try {
    // Try to find an existing user from the conversations table
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('user_id')
      .limit(1)
      .single();

    if (existingConv && existingConv.user_id) {
      testUserId = existingConv.user_id;
      console.log(`[Setup] Using existing user: ${testUserId}`);
    } else {
      console.log('⚠️  No existing users found. Skipping advanced filter tests.');
      console.log('   Please create at least one conversation to enable these tests.');
      return;
    }
  } catch (error) {
    console.error('❌ Failed to find test user:', error);
    return;
  }

  // 2. Setup: Create test data
  console.log('\n[Setup] Creating test data...');
  try {
    // Create conversation
    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .insert({ user_id: testUserId, title: 'Advanced Filter Test' })
      .select()
      .single();
    if (convError) throw convError;
    conversationId = convData.id;

    // Create messages
    const { data: msgData, error: msgError } = await supabase
      .from('messages')
      .insert([
        { conversation_id: conversationId, role: 'user', content: 'Test message 1' },
        { conversation_id: conversationId, role: 'assistant', content: 'Test response 1' },
      ])
      .select();
    if (msgError) throw msgError;
    messageId1 = msgData[0].id;
    messageId2 = msgData[1].id;

    // Create evaluations
    await supabase.from('message_evaluations').insert([
      { message_id: messageId1, rating: 5, success: true, notes: 'Excellent' },
      { message_id: messageId2, rating: 2, success: false, failure_tags: ['bad_response'], notes: 'Poor' },
    ]);
    console.log('[Setup] Test data created successfully.');
  } catch (error) {
    console.error('[Setup] Failed to create test data:', error);
    await cleanup();
    return;
  }

  // 2. Test: Export with min_rating filter
  console.log('\n[Test 1] Exporting with min_rating = 4...');
  console.log(`[Test 1] Test user ID: ${testUserId}`);
  console.log(`[Test 1] Conversation ID: ${conversationId}`);
  try {
    const result = await datasetManagerTool.execute({
      operation: 'export',
      dataset_filter: { min_rating: 4 },
      user_id: testUserId,
    }) as DatasetExport;

    console.log(`[Test 1] Result: ${result.total_records} records`);
    if (result.total_records > 0) {
      console.log(`[Test 1] Sample record:`, JSON.stringify(result.data[0], null, 2));
    }

    if (result.total_records === 1 && result.data[0].rating === 5) {
      console.log('✅ PASS: Correctly filtered by min_rating.');
    } else {
      console.error('❌ FAIL: Incorrect result for min_rating filter.');
    }
  } catch (error) {
    console.error('❌ FAIL: Test 1 threw an error:', error);
  }

  // 3. Test: Export with success_only filter
  console.log('\n[Test 2] Exporting with success_only = true...');
  try {
    const result = await datasetManagerTool.execute({
      operation: 'export',
      dataset_filter: { success_only: true },
      user_id: testUserId,
    }) as DatasetExport;

    if (result.total_records === 1 && result.data[0].success === true) {
      console.log('✅ PASS: Correctly filtered by success_only.');
    } else {
      console.error('❌ FAIL: Incorrect result for success_only filter.', result);
    }
  } catch (error) {
    console.error('❌ FAIL: Test 2 threw an error:', error);
  }

  // 4. Cleanup
  await cleanup();

  async function cleanup() {
    console.log('\n[Cleanup] Deleting test data...');
    if (conversationId) {
      await supabase.from('message_evaluations').delete().in('message_id', [messageId1, messageId2]);
      await supabase.from('messages').delete().eq('conversation_id', conversationId);
      await supabase.from('conversations').delete().eq('id', conversationId);
      console.log('[Cleanup] Test data deleted.');
    }
  }
}
