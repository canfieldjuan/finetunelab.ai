// Dataset Manager Tool - Delete & Merge Test Logic
// Date: October 21, 2025

import { supabase } from '@/lib/supabaseClient';
import datasetManagerTool from './index';

export async function runDeleteMergeTests() {
  console.log('--- Running Delete & Merge Tests for Dataset Manager ---\n');

  // Get test user ID from environment or use a test-specific UUID
  const testUserId = process.env.TEST_USER_ID;
  
  if (!testUserId) {
    console.error('❌ FATAL: TEST_USER_ID environment variable is required for delete/merge tests');
    console.log('Please set TEST_USER_ID to a valid user UUID in your .env file');
    return;
  }

  let conv1Id: string, conv2Id: string, conv3Id: string;

  // Setup: Create test data
  console.log('[Setup] Creating test conversations...');
  try {
    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .insert([
        { user_id: testUserId, title: 'Conversation 1' },
        { user_id: testUserId, title: 'Conversation 2' },
        { user_id: testUserId, title: 'Conversation 3' },
      ])
      .select();

    if (convError) throw convError;
    conv1Id = convData[0].id;
    conv2Id = convData[1].id;
    conv3Id = convData[2].id;

    // Add messages to each conversation
    await supabase.from('messages').insert([
      { conversation_id: conv1Id, role: 'user', content: 'Message 1 in Conv1' },
      { conversation_id: conv1Id, role: 'assistant', content: 'Response 1 in Conv1' },
      { conversation_id: conv2Id, role: 'user', content: 'Message 1 in Conv2' },
      { conversation_id: conv3Id, role: 'user', content: 'Message 1 in Conv3' },
    ]);

    console.log('[Setup] Test data created successfully.\n');
  } catch (error) {
    console.error('[Setup] Failed to create test data:', error);
    await cleanup();
    return;
  }

  // Test 1: Delete without confirmation (should fail)
  console.log('[Test 1] Attempting delete without confirmation...');
  try {
    await datasetManagerTool.execute({
      operation: 'delete',
      user_id: testUserId,
      conversation_ids: conv1Id,
      confirm_delete: false,
    });
    console.error('❌ FAIL: Should have rejected delete without confirmation\n');
  } catch (error) {
    if (error instanceof Error && error.message.includes('confirm_delete=true')) {
      console.log('✅ PASS: Correctly rejected delete without confirmation\n');
    } else {
      console.error('❌ FAIL: Unexpected error:', error, '\n');
    }
  }

  // Test 2: Delete with confirmation
  console.log('[Test 2] Deleting conversation with confirmation...');
  try {
    const result = await datasetManagerTool.execute({
      operation: 'delete',
      user_id: testUserId,
      conversation_ids: conv1Id,
      confirm_delete: true,
    }) as { deleted_count: number };

    if (result.deleted_count === 1) {
      console.log('✅ PASS: Successfully deleted 1 conversation\n');
    } else {
      console.error('❌ FAIL: Expected deleted_count=1, got:', result, '\n');
    }
  } catch (error) {
    console.error('❌ FAIL: Test 2 threw an error:', error, '\n');
  }

  // Test 3: Verify deletion (conversation should not exist)
  console.log('[Test 3] Verifying conversation was deleted...');
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conv1Id);

    if (error) throw error;

    if (!data || data.length === 0) {
      console.log('✅ PASS: Conversation successfully deleted\n');
    } else {
      console.error('❌ FAIL: Conversation still exists:', data, '\n');
    }
  } catch (error) {
    console.error('❌ FAIL: Verification failed:', error, '\n');
  }

  // Test 4: Merge conversations
  console.log('[Test 4] Merging conv3 into conv2...');
  try {
    const result = await datasetManagerTool.execute({
      operation: 'merge',
      user_id: testUserId,
      conversation_ids: conv3Id,
      target_conversation_id: conv2Id,
    }) as { merged_count: number; messages_moved: number };

    if (result.merged_count === 1 && result.messages_moved === 1) {
      console.log('✅ PASS: Successfully merged 1 conversation, moved 1 message\n');
    } else {
      console.error('❌ FAIL: Unexpected result:', result, '\n');
    }
  } catch (error) {
    console.error('❌ FAIL: Test 4 threw an error:', error, '\n');
  }

  // Test 5: Verify merge (conv3 should not exist, conv2 should have 2 messages)
  console.log('[Test 5] Verifying merge results...');
  try {
    const { data: conv3Data } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conv3Id);

    const { count: conv2MessageCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conv2Id);

    if (
      (!conv3Data || conv3Data.length === 0) &&
      conv2MessageCount === 2
    ) {
      console.log('✅ PASS: Merge verified - source deleted, messages moved\n');
    } else {
      console.error(
        '❌ FAIL: Merge verification failed. Conv3 exists:',
        conv3Data?.length,
        'Conv2 messages:',
        conv2MessageCount,
        '\n'
      );
    }
  } catch (error) {
    console.error('❌ FAIL: Verification failed:', error, '\n');
  }

  // Cleanup
  await cleanup();

  async function cleanup() {
    console.log('[Cleanup] Deleting test data...');
    try {
      // Delete any remaining test conversations
      await supabase
        .from('messages')
        .delete()
        .in('conversation_id', [conv1Id, conv2Id, conv3Id]);

      await supabase
        .from('conversations')
        .delete()
        .in('id', [conv1Id, conv2Id, conv3Id]);

      console.log('[Cleanup] Test data deleted successfully.');
    } catch (error) {
      console.error('[Cleanup] Failed to delete test data:', error);
    }
  }

  console.log('\n--- All Delete & Merge Tests Completed ---');
}
