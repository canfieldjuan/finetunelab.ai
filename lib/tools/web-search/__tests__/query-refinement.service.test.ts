import { queryRefinementService, POOR_RESULTS_THRESHOLD } from '../query-refinement.service';
import type { WebSearchDocument } from '../types';

// Mock the OpenAI response
jest.mock('@/lib/llm/openai', () => ({
  getOpenAIResponse: jest.fn(),
}));

import { getOpenAIResponse } from '@/lib/llm/openai';
const mockGetOpenAIResponse = getOpenAIResponse as jest.MockedFunction<typeof getOpenAIResponse>;

describe('QueryRefinementService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Poor Results Detection', () => {
    it('should detect poor results when count is too low', () => {
      const results = [
        { confidenceScore: 0.8 },
        { confidenceScore: 0.7 },
      ];

      const avgConfidence = queryRefinementService.calculateAverageConfidence(results);
      const shouldRefine = queryRefinementService.shouldRefine(results, avgConfidence);

      console.log('[Test] Low result count test:', {
        count: results.length,
        avgConfidence,
        shouldRefine,
      });

      expect(shouldRefine).toBe(true); // Only 2 results, threshold is 3
    });

    it('should detect poor results when confidence is too low', () => {
      const results = [
        { confidenceScore: 0.3 },
        { confidenceScore: 0.2 },
        { confidenceScore: 0.4 },
        { confidenceScore: 0.3 },
        { confidenceScore: 0.2 },
      ];

      const avgConfidence = queryRefinementService.calculateAverageConfidence(results);
      const shouldRefine = queryRefinementService.shouldRefine(results, avgConfidence);

      console.log('[Test] Low confidence test:', {
        count: results.length,
        avgConfidence,
        shouldRefine,
      });

      expect(avgConfidence).toBeLessThan(POOR_RESULTS_THRESHOLD.avgConfidence);
      expect(shouldRefine).toBe(true);
    });

    it('should NOT refine when results are good', () => {
      const results = [
        { confidenceScore: 0.9 },
        { confidenceScore: 0.8 },
        { confidenceScore: 0.85 },
        { confidenceScore: 0.75 },
        { confidenceScore: 0.8 },
      ];

      const avgConfidence = queryRefinementService.calculateAverageConfidence(results);
      const shouldRefine = queryRefinementService.shouldRefine(results, avgConfidence);

      console.log('[Test] Good results test:', {
        count: results.length,
        avgConfidence,
        shouldRefine,
      });

      expect(avgConfidence).toBeGreaterThan(POOR_RESULTS_THRESHOLD.avgConfidence);
      expect(shouldRefine).toBe(false);
    });
  });

  describe('Average Confidence Calculation', () => {
    it('should calculate average confidence correctly', () => {
      const results = [
        { confidenceScore: 0.8 },
        { confidenceScore: 0.6 },
        { confidenceScore: 0.4 },
        { confidenceScore: 0.2 },
        { confidenceScore: 1.0 },
      ];

      const avg = queryRefinementService.calculateAverageConfidence(results);

      console.log('[Test] Average confidence:', avg);

      expect(avg).toBeCloseTo(0.6, 2); // (0.8 + 0.6 + 0.4 + 0.2 + 1.0) / 5 = 0.6
    });

    it('should handle empty results', () => {
      const results: Array<{ confidenceScore?: number }> = [];

      const avg = queryRefinementService.calculateAverageConfidence(results);

      expect(avg).toBe(0);
    });

    it('should use default 0.5 for missing confidence scores', () => {
      const results = [
        { confidenceScore: 0.8 },
        {}, // No confidence score
        { confidenceScore: 0.6 },
      ];

      const avg = queryRefinementService.calculateAverageConfidence(results);

      console.log('[Test] Average with missing scores:', avg);

      expect(avg).toBeCloseTo((0.8 + 0.5 + 0.6) / 3, 2);
    });
  });

  describe('Query Generation', () => {
    it('should generate refined queries using LLM', async () => {
      mockGetOpenAIResponse.mockResolvedValue(
        'artificial intelligence developments 2025\nAI breakthroughs and innovations latest research'
      );

      const queries = await queryRefinementService.generateRefinedQueries(
        'AI stuff',
        '2025-10-18'
      );

      console.log('[Test] Generated queries:', queries);

      expect(queries).toHaveLength(2);
      expect(queries[0]).toContain('2025');
      expect(mockGetOpenAIResponse).toHaveBeenCalledTimes(1);
    });

    it('should parse queries even with numbering', async () => {
      mockGetOpenAIResponse.mockResolvedValue(
        '1. artificial intelligence breakthroughs 2025\n2. latest AI research developments'
      );

      const queries = await queryRefinementService.generateRefinedQueries('AI', '2025-10-18');

      console.log('[Test] Parsed queries:', queries);

      expect(queries).toHaveLength(2);
      expect(queries[0]).not.toMatch(/^[0-9]/); // Numbers should be removed
    });

    it('should handle LLM failures with fallback', async () => {
      mockGetOpenAIResponse.mockRejectedValue(new Error('API error'));

      const queries = await queryRefinementService.generateRefinedQueries(
        'quantum computing',
        '2025-10-18'
      );

      console.log('[Test] Fallback query:', queries);

      expect(queries).toHaveLength(1);
      expect(queries[0]).toContain('2025'); // Fallback adds current year
      expect(queries[0]).toContain('quantum computing');
    });
  });

  describe('Result Deduplication', () => {
    it('should deduplicate results by URL', () => {
      const results1: WebSearchDocument[] = [
        { title: 'A', url: 'https://example.com/page1', snippet: 'Content 1' },
        { title: 'B', url: 'https://example.com/page2', snippet: 'Content 2' },
      ];

      const results2: WebSearchDocument[] = [
        { title: 'A Duplicate', url: 'https://example.com/page1', snippet: 'Content 1 again' },
        { title: 'C', url: 'https://example.com/page3', snippet: 'Content 3' },
      ];

      const deduplicated = queryRefinementService.deduplicateResults(results1, results2);

      console.log('[Test] Deduplicated results:', deduplicated.map(r => r.url));

      expect(deduplicated).toHaveLength(3); // page1, page2, page3 (page1 duplicate removed)
      expect(deduplicated.find(r => r.url === 'https://example.com/page1')).toBeDefined();
      expect(deduplicated.find(r => r.url === 'https://example.com/page2')).toBeDefined();
      expect(deduplicated.find(r => r.url === 'https://example.com/page3')).toBeDefined();
    });

    it('should normalize URLs for deduplication (trailing slashes, case)', () => {
      const results1: WebSearchDocument[] = [
        { title: 'A', url: 'https://Example.com/Page/', snippet: 'Content' },
      ];

      const results2: WebSearchDocument[] = [
        { title: 'A', url: 'https://example.com/page', snippet: 'Content' },
      ];

      const deduplicated = queryRefinementService.deduplicateResults(results1, results2);

      console.log('[Test] Normalized deduplication:', deduplicated.map(r => r.url));

      expect(deduplicated).toHaveLength(1); // Should recognize as same URL
    });

    it('should preserve order from first result set', () => {
      const results1: WebSearchDocument[] = [
        { title: 'A', url: 'https://example.com/1', snippet: 'First' },
        { title: 'B', url: 'https://example.com/2', snippet: 'Second' },
      ];

      const results2: WebSearchDocument[] = [
        { title: 'C', url: 'https://example.com/3', snippet: 'Third' },
      ];

      const deduplicated = queryRefinementService.deduplicateResults(results1, results2);

      expect(deduplicated[0].url).toBe('https://example.com/1');
      expect(deduplicated[1].url).toBe('https://example.com/2');
      expect(deduplicated[2].url).toBe('https://example.com/3');
    });
  });
});
