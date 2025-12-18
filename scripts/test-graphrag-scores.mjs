/**
 * Test script to check actual GraphRAG search scores
 * This will help diagnose if the threshold is too high
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Import search service
const { searchService } = await import('../lib/graphrag/graphiti/search-service.js');

console.log('Testing GraphRAG search with actual scores...\n');
console.log('Current threshold from .env:', process.env.GRAPHRAG_SEARCH_THRESHOLD || '0.7 (default)');
console.log('');

// Test with a sample query - replace with your actual userId
const userId = process.env.TEST_USER_ID || 'test-user';
const testQuery = 'What is in my documents?';

console.log(`Running search for: "${testQuery}"`);
console.log(`User ID: ${userId}\n`);

try {
  const result = await searchService.search(testQuery, userId);

  console.log('=== SEARCH RESULTS ===');
  console.log(`Total sources returned: ${result.sources.length}`);
  console.log(`Context generated: ${result.context ? 'Yes' : 'No'}`);
  console.log('');

  if (result.sources.length > 0) {
    console.log('Sources with confidence scores:');
    result.sources.forEach((source, idx) => {
      const confidence = (source.confidence * 100).toFixed(1);
      const passesThreshold = source.confidence >= parseFloat(process.env.GRAPHRAG_SEARCH_THRESHOLD || '0.7');
      const status = passesThreshold ? '✅ PASSES' : '❌ FILTERED OUT';

      console.log(`\n${idx + 1}. ${status} (${confidence}% confidence)`);
      console.log(`   Entity: ${source.entity}`);
      console.log(`   Fact: ${source.fact?.substring(0, 100)}...`);
    });

    // Calculate threshold statistics
    const threshold = parseFloat(process.env.GRAPHRAG_SEARCH_THRESHOLD || '0.7');
    const passingCount = result.sources.filter(s => s.confidence >= threshold).length;
    const avgScore = result.sources.reduce((sum, s) => sum + s.confidence, 0) / result.sources.length;

    console.log('\n=== STATISTICS ===');
    console.log(`Average confidence: ${(avgScore * 100).toFixed(1)}%`);
    console.log(`Threshold setting: ${(threshold * 100).toFixed(1)}%`);
    console.log(`Sources passing threshold: ${passingCount} / ${result.sources.length}`);
    console.log('');

    if (passingCount === 0) {
      console.log('🔴 PROBLEM IDENTIFIED:');
      console.log('   All search results are being filtered out by the threshold!');
      console.log('   This is why GraphRAG metadata is not being saved.');
      console.log('');
      console.log('SOLUTION:');
      console.log(`   Lower GRAPHRAG_SEARCH_THRESHOLD from ${threshold} to ${avgScore.toFixed(2)} or lower`);
      console.log('   Recommended: 0.5 (50%) for more inclusive results');
    } else {
      console.log(`✅ ${passingCount} sources would be used with current threshold`);
    }
  } else {
    console.log('⚠️  No sources returned from search.');
    console.log('   Possible reasons:');
    console.log('   1. No documents in knowledge graph');
    console.log('   2. Graphiti service not running');
    console.log('   3. Query doesn\'t match any documents');
  }

  // Show metadata that would be saved
  if (result.metadata) {
    console.log('\n=== METADATA THAT WOULD BE SAVED ===');
    console.log(JSON.stringify(result.metadata, null, 2));
  }

} catch (error) {
  console.error('❌ Error running search:', error.message);
  if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
    console.error('\n⚠️  Graphiti service may not be running.');
    console.error('   Start it with: npm run graphiti:start');
  }
}
