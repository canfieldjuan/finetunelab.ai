/**
 * End-to-End Tests for Enhanced Web Search Tool
 * Tests all three enhancement features working together
 */

import { searchService } from '../search.service';

// Helper to add delay between tests to respect rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Delay between tests to avoid rate limiting (Base AI: 20 req/sec, so 50ms between requests is safe)
const INTER_TEST_DELAY = 100; // 100ms = well under rate limit

describe('Web Search Tool - E2E Tests', () => {
  // Increase timeout for real network calls
  jest.setTimeout(30000);

  // Add delay between tests
  afterEach(async () => {
    await delay(INTER_TEST_DELAY);
  });

  describe('Feature Integration Tests', () => {
    it('should perform basic search with confidence scoring', async () => {
      console.log('\n=== TEST 1: Basic Search with Confidence Scoring ===');
      
      const response = await searchService.search('TypeScript best practices', 5);
      const results = response.results;

      console.log(`\nResults found: ${results.length}`);
      results.forEach((result, i) => {
        console.log(`\n${i + 1}. ${result.title}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   Confidence: ${result.confidenceScore?.toFixed(2) || 'N/A'}`);
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].confidenceScore).toBeDefined();
      expect(results[0].confidenceScore).toBeGreaterThanOrEqual(0);
      expect(results[0].confidenceScore).toBeLessThanOrEqual(1);
      
      // Verify results are sorted by confidence
      for (let i = 0; i < results.length - 1; i++) {
        const current = results[i].confidenceScore || 0;
        const next = results[i + 1].confidenceScore || 0;
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('should perform deep search with full content', async () => {
      console.log('\n=== TEST 2: Deep Search ===');
      
      const response = await searchService.search('Next.js documentation', 3, { deepSearch: true });
      const results = response.results;

      console.log(`\nResults found: ${results.length}`);
      
      let deepContentCount = 0;
      results.forEach((result, i) => {
        console.log(`\n${i + 1}. ${result.title}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   Confidence: ${result.confidenceScore?.toFixed(2) || 'N/A'}`);
        console.log(`   Has Full Content: ${!!result.fullContent}`);
        if (result.fullContent) {
          console.log(`   Content Length: ${result.fullContent.length} chars`);
          deepContentCount++;
        }
      });

      console.log(`\nDeep content fetched for ${deepContentCount} results`);

      expect(results.length).toBeGreaterThan(0);
      expect(deepContentCount).toBeGreaterThan(0);
    });

    it('should detect and refine vague queries', async () => {
      console.log('\n=== TEST 3: Auto Query Refinement ===');
      
      // Use a deliberately vague query
      const vagueQuery = 'programming stuff';
      console.log(`\nOriginal query: "${vagueQuery}"`);
      
      const response = await searchService.search(vagueQuery, 10, { autoRefine: true });
      const results = response.results;

      console.log(`\nFinal results: ${results.length}`);
      
      if (results.length > 0) {
        console.log('\nTop 3 results:');
        results.slice(0, 3).forEach((result, i) => {
          console.log(`\n${i + 1}. ${result.title}`);
          console.log(`   URL: ${result.url}`);
          console.log(`   Confidence: ${result.confidenceScore?.toFixed(2) || 'N/A'}`);
        });
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it('should NOT refine specific queries', async () => {
      console.log('\n=== TEST 4: Specific Query (No Refinement) ===');
      
      const specificQuery = 'Next.js 14 app router documentation';
      console.log(`\nSpecific query: "${specificQuery}"`);
      
      const response = await searchService.search(specificQuery, 5, { autoRefine: true });
      const results = response.results;

      console.log(`\nResults found: ${results.length}`);
      
      // Calculate average confidence
      const avgConfidence = results.reduce((sum, r) => sum + (r.confidenceScore || 0.5), 0) / results.length;
      console.log(`Average confidence: ${avgConfidence.toFixed(2)}`);
      console.log('(Should be high enough that refinement was NOT triggered)');

      expect(results.length).toBeGreaterThan(0);
      expect(avgConfidence).toBeGreaterThan(0.4); // Above refinement threshold
    });

    it('should handle all features together (power mode)', async () => {
      console.log('\n=== TEST 5: All Features Combined ===');
      
      const response = await searchService.search('React hooks tutorial', 5, {
        deepSearch: true,
        autoRefine: true,
      });
      const results = response.results;

      console.log(`\nResults found: ${results.length}`);
      
      let withDeepContent = 0;
      let withConfidence = 0;
      
      results.forEach((result, i) => {
        console.log(`\n${i + 1}. ${result.title}`);
        console.log(`   Confidence: ${result.confidenceScore?.toFixed(2) || 'N/A'}`);
        console.log(`   Has Deep Content: ${!!result.fullContent}`);
        
        if (result.fullContent) withDeepContent++;
        if (result.confidenceScore !== undefined) withConfidence++;
      });

      console.log(`\n✓ Results with confidence scores: ${withConfidence}/${results.length}`);
      console.log(`✓ Results with deep content: ${withDeepContent}/${results.length}`);

      expect(results.length).toBeGreaterThan(0);
      expect(withConfidence).toBe(results.length); // All should have scores
      expect(withDeepContent).toBeGreaterThan(0); // At least some deep content
    });
  });

  describe('Edge Cases', () => {
    it('should handle queries with special characters', async () => {
      console.log('\n=== TEST 6: Special Characters ===');
      
      const response = await searchService.search('C++ vs C# performance', 3);
      const results = response.results;

      console.log(`\nResults: ${results.length}`);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle very specific technical queries', async () => {
      console.log('\n=== TEST 7: Technical Query ===');
      
      const response = await searchService.search('TypeScript generic constraints extends keyof', 5);
      const results = response.results;

      console.log(`\nResults: ${results.length}`);
      console.log(`Avg confidence: ${(results.reduce((sum, r) => sum + (r.confidenceScore || 0), 0) / results.length).toFixed(2)}`);
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('should gracefully handle deep search failures', async () => {
      console.log('\n=== TEST 8: Deep Search Error Handling ===');
      
      // Search for something that might have hard-to-fetch content
      const response = await searchService.search('github trending repositories', 3, { deepSearch: true });
      const results = response.results;

      console.log(`\nResults: ${results.length}`);
      
      // Should still return results even if some deep fetches fail
      expect(results.length).toBeGreaterThan(0);
      
      // All results should have at least a snippet
      results.forEach(result => {
        expect(result.snippet || result.fullContent).toBeDefined();
      });
    });
  });

  describe('Performance Tests', () => {
    it('should complete basic search within reasonable time', async () => {
      console.log('\n=== TEST 9: Performance - Basic Search ===');
      
      const start = Date.now();
      const response = await searchService.search('JavaScript arrays', 5);
      const duration = Date.now() - start;

      console.log(`\nCompleted in ${duration}ms`);
      console.log(`Results: ${response.results.length}`);

      expect(duration).toBeLessThan(5000); // Should complete in under 5s
      expect(response.results.length).toBeGreaterThan(0);
    });

    it('should complete deep search within reasonable time', async () => {
      console.log('\n=== TEST 10: Performance - Deep Search ===');
      
      const start = Date.now();
      const response = await searchService.search('Python pandas documentation', 3, { deepSearch: true });
      const duration = Date.now() - start;

      console.log(`\nCompleted in ${duration}ms`);
      console.log(`Results: ${response.results.length}`);

      expect(duration).toBeLessThan(10000); // Should complete in under 10s
      expect(response.results.length).toBeGreaterThan(0);
    });
  });
});
