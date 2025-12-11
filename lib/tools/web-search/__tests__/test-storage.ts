// Manual test for storage service
// NOTE: Requires database connection and valid user ID
// Run with: npx tsx lib/tools/web-search/__tests__/test-storage.ts

import { searchStorageService } from '../storage.service';
import type { SearchResultSummary } from '../types';

async function testStorage() {
  console.log('=== Storage Service Test ===\n');

  // NOTE: Replace with actual user ID from your Supabase auth.users table
  const TEST_USER_ID = '00000000-0000-0000-0000-000000000000';
  const TEST_CONVERSATION_ID = '11111111-1111-1111-1111-111111111111';

  // Sample search result summaries
  const testSummaries: SearchResultSummary[] = [
    {
      id: 'test-summary-1',
      query: 'TypeScript best practices',
      resultUrl: 'https://example.com/ts-best-practices',
      resultTitle: 'TypeScript Best Practices Guide',
      originalSnippet:
        'Learn essential TypeScript best practices including type safety, strict mode, and proper interface usage.',
      summary:
        'Essential TypeScript best practices: use strict mode, leverage type inference, avoid any, prefer interfaces.',
      source: 'TypeScript Guide',
      publishedAt: '2024-01-15',
      createdAt: new Date().toISOString(),
      isIngested: false,
      isSaved: false,
    },
    {
      id: 'test-summary-2',
      query: 'TypeScript best practices',
      resultUrl: 'https://example.com/advanced-ts',
      resultTitle: 'Advanced TypeScript Patterns',
      originalSnippet:
        'Explore advanced TypeScript patterns like mapped types, conditional types, and utility types for powerful code.',
      summary:
        'Advanced patterns: mapped types, conditional types, utility types for powerful type transformations.',
      source: 'Dev Blog',
      createdAt: new Date().toISOString(),
      isIngested: false,
      isSaved: false,
    },
  ];

  try {
    console.log('Test 1: Save single summary');
    console.log('----------------------------');
    const saveResult = await searchStorageService.saveSummary(
      testSummaries[0],
      TEST_USER_ID,
      TEST_CONVERSATION_ID
    );
    console.log('Save result:', saveResult);

    if (!saveResult.success) {
      console.error('❌ Save failed:', saveResult.error);
      console.log('\nNote: This test requires:');
      console.log('1. Database connection (check .env for SUPABASE variables)');
      console.log('2. Valid user ID (replace TEST_USER_ID)');
      console.log('3. Migration 006 applied (search_summaries table exists)');
      return;
    }

    const savedId = saveResult.id;
    console.log('✅ Saved successfully with ID:', savedId);
    console.log();

    console.log('Test 2: Batch save summaries');
    console.log('-----------------------------');
    const batchResult = await searchStorageService.saveBatch(
      testSummaries,
      TEST_USER_ID,
      TEST_CONVERSATION_ID
    );
    console.log('Batch result:', batchResult);
    console.log();

    console.log('Test 3: Retrieve saved summaries');
    console.log('---------------------------------');
    const retrieved = await searchStorageService.getSavedSummaries(TEST_USER_ID, {
      conversationId: TEST_CONVERSATION_ID,
      limit: 10,
    });
    console.log(`Retrieved ${retrieved.length} summaries:`);
    retrieved.forEach((s, i) => {
      console.log(`${i + 1}. ${s.resultTitle}`);
      console.log(`   URL: ${s.resultUrl}`);
      console.log(`   Summary: ${s.summary}`);
      console.log(`   Ingested: ${s.isIngested}, Saved: ${s.isSaved}\n`);
    });

    console.log('Test 4: Mark as ingested');
    console.log('-------------------------');
    const summaryIds = retrieved.slice(0, 2).map(s => s.id);
    const markResult = await searchStorageService.markAsIngested(
      summaryIds,
      TEST_USER_ID
    );
    console.log('Mark result:', markResult);
    console.log();

    console.log('Test 5: Search summaries');
    console.log('------------------------');
    const searchResults = await searchStorageService.searchSummaries(
      TEST_USER_ID,
      'TypeScript',
      5
    );
    console.log(`Found ${searchResults.length} results for "TypeScript"`);
    console.log();

    console.log('Test 6: Get statistics');
    console.log('----------------------');
    const stats = await searchStorageService.getStats(TEST_USER_ID);
    console.log('Stats:', stats);
    console.log();

    console.log('Test 7: Delete summaries');
    console.log('------------------------');
    if (savedId) {
      const deleteResult = await searchStorageService.deleteSummaries(
        [savedId],
        TEST_USER_ID
      );
      console.log('Delete result:', deleteResult);
    }
    console.log();

    console.log('=== All Tests Completed ===');
    console.log('\nNote: Some tests may fail if:');
    console.log('- Database connection is not configured');
    console.log('- User ID does not exist in auth.users');
    console.log('- Migration 006 has not been applied');
    console.log('- RLS policies are blocking the operations');
  } catch (error) {
    console.error('Test failed with exception:', error);
  }
}

// Run test if executed directly
if (require.main === module) {
  testStorage();
}

export { testStorage };
