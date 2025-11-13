// Manual test for summarization service
// Run with: npx tsx lib/tools/web-search/__tests__/test-summarization.ts

import { summarizationService } from '../summarization.service';
import type { WebSearchDocument } from '../types';

async function testSummarization() {
  console.log('=== Summarization Service Test ===\n');

  // Sample search result
  const testDocument: WebSearchDocument = {
    title: 'Understanding TypeScript Generics',
    url: 'https://example.com/typescript-generics',
    snippet:
      'TypeScript generics provide a way to create reusable components that can work with multiple types rather than a single one. Generics allow you to write flexible, type-safe code by using type variables that act as placeholders for types. Common examples include generic functions, classes, and interfaces. The syntax uses angle brackets <T> to define type parameters.',
    source: 'TypeScript Docs',
    publishedAt: '2024-01-15',
  };

  const query = 'TypeScript generics tutorial';

  try {
    console.log('Test 1: Single result summarization');
    console.log('-----------------------------------');
    console.log('Query:', query);
    console.log('Original snippet:', testDocument.snippet);
    console.log('Original length:', testDocument.snippet.length, 'chars\n');

    const summary = await summarizationService.summarizeResult(
      testDocument,
      query
    );

    console.log('Generated summary:', summary);
    console.log('Summary length:', summary.length, 'chars');
    console.log('Compression ratio:', Math.round((summary.length / testDocument.snippet.length) * 100), '%\n');

    console.log('Test 2: Batch summarization');
    console.log('----------------------------');

    const testDocuments: WebSearchDocument[] = [
      testDocument,
      {
        title: 'Advanced TypeScript Patterns',
        url: 'https://example.com/advanced-ts',
        snippet:
          'Learn advanced TypeScript patterns including mapped types, conditional types, and utility types. These features enable powerful type transformations and help you write more maintainable code.',
        source: 'Dev Blog',
      },
      {
        title: 'TypeScript Best Practices',
        url: 'https://example.com/ts-best-practices',
        snippet:
          'Follow these TypeScript best practices to write cleaner code: use strict mode, leverage type inference, avoid any type, prefer interfaces over type aliases for objects, and use const assertions.',
        source: 'Best Practices Guide',
      },
    ];

    const summaries = await summarizationService.summarizeBatch(
      testDocuments,
      query
    );

    console.log(`Summarized ${summaries.length} results:\n`);
    summaries.forEach((s, i) => {
      console.log(`${i + 1}. ${s.resultTitle}`);
      console.log(`   Summary: ${s.summary}`);
      console.log(`   Length: ${s.summary.length} chars`);
      console.log(`   Ingested: ${s.isIngested}, Saved: ${s.isSaved}\n`);
    });

    console.log('=== All Tests Passed ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run test if executed directly
if (require.main === module) {
  testSummarization();
}

export { testSummarization };
