import { scoringService } from '../scoring.service';
import type { WebSearchDocument } from '../types';

describe('ScoringService Unit Tests', () => {
  const mockQuery = 'latest artificial intelligence breakthroughs';

  const createMockDocument = (overrides: Partial<WebSearchDocument> = {}): WebSearchDocument => ({
    title: 'AI Research Paper',
    url: 'https://example.com/article',
    snippet: 'A research paper about artificial intelligence and machine learning.',
    source: 'Example News',
    ...overrides,
  });

  describe('Keyword Relevance Scoring', () => {
    it('should score high when title and snippet match query terms', () => {
      const doc = createMockDocument({
        title: 'Latest Artificial Intelligence Breakthroughs in 2025',
        snippet: 'Recent breakthroughs in artificial intelligence have revolutionized the field.',
      });

      const score = scoringService.calculateConfidence(doc, mockQuery);
      console.log('[Test] High keyword match score:', score);

      expect(score).toBeGreaterThan(0.6); // Should have high confidence
    });

    it('should score low when title and snippet do not match query', () => {
      const doc = createMockDocument({
        title: 'Cooking Recipes for Beginners',
        snippet: 'Learn how to cook delicious meals with simple ingredients.',
      });

      const score = scoringService.calculateConfidence(doc, mockQuery);
      console.log('[Test] Low keyword match score:', score);

      expect(score).toBeLessThan(0.5); // Should have low confidence
    });
  });

  describe('Source Reputation Scoring', () => {
    it('should score high for trusted domains like Wikipedia', () => {
      const doc = createMockDocument({
        url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
        title: 'Artificial intelligence - Wikipedia',
        snippet: 'Artificial intelligence (AI) is intelligence demonstrated by machines.',
      });

      const score = scoringService.calculateConfidence(doc, 'artificial intelligence');
      console.log('[Test] Wikipedia score:', score);

      expect(score).toBeGreaterThan(0.7); // High trust + keyword match
    });

    it('should score medium for medium-trust domains', () => {
      const doc = createMockDocument({
        url: 'https://medium.com/some-article',
        title: 'Understanding AI',
        snippet: 'AI is transforming the world.',
      });

      const score = scoringService.calculateConfidence(doc, 'AI');
      console.log('[Test] Medium.com score:', score);

      expect(score).toBeGreaterThan(0.3);
      expect(score).toBeLessThan(0.9);
    });

    it('should penalize domains with suspicious keywords in reputation score', () => {
      const doc = createMockDocument({
        url: 'https://clickbait-news.com/article',
        title: 'You Won\'t Believe This AI News!',
        snippet: 'This will shock you about AI.',
      });

      const score = scoringService.calculateConfidence(doc, 'AI news');
      console.log('[Test] Clickbait domain score:', score);

      // Even with keyword match, low-trust domains should score below high-trust ones
      expect(score).toBeLessThan(0.7); // Lower than Wikipedia's 0.9
      
      // But not completely penalized if keywords match
      expect(score).toBeGreaterThan(0.2);
    });
  });

  describe('Recency Scoring', () => {
    it('should score high for recent content when query asks for latest info', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 2); // 2 days ago

      const doc = createMockDocument({
        title: 'Latest AI News',
        snippet: 'Breaking news in artificial intelligence.',
        publishedAt: recentDate.toISOString(),
      });

      const score = scoringService.calculateConfidence(doc, 'latest AI news');
      console.log('[Test] Recent content with recency query score:', score);

      expect(score).toBeGreaterThan(0.6); // Recent + recency query = high score
    });

    it('should score lower for old content when query asks for latest info', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 2); // 2 years ago

      const doc = createMockDocument({
        title: 'AI Research',
        snippet: 'Artificial intelligence research from 2023.',
        publishedAt: oldDate.toISOString(),
      });

      const score = scoringService.calculateConfidence(doc, 'latest AI breakthroughs');
      console.log('[Test] Old content with recency query score:', score);

      expect(score).toBeLessThan(0.6); // Old content + recency query = lower score
    });

    it('should score neutral for missing date when not asking for recent info', () => {
      const doc = createMockDocument({
        title: 'Artificial Intelligence Overview',
        snippet: 'A comprehensive guide to AI concepts.',
      });

      const score = scoringService.calculateConfidence(doc, 'artificial intelligence overview');
      console.log('[Test] No date, no recency query score:', score);

      expect(score).toBeGreaterThan(0.4);
      expect(score).toBeLessThan(0.8);
    });
  });

  describe('Batch Scoring', () => {
    it('should score multiple documents and maintain correct order', () => {
      const docs: WebSearchDocument[] = [
        createMockDocument({
          url: 'https://wikipedia.org/wiki/AI',
          title: 'Latest Artificial Intelligence Breakthroughs',
          snippet: 'Recent AI breakthroughs and developments.',
        }),
        createMockDocument({
          url: 'https://example.com/old-article',
          title: 'Cooking recipes',
          snippet: 'How to cook pasta.',
        }),
        createMockDocument({
          url: 'https://arxiv.org/ai-paper',
          title: 'AI Research Paper on Machine Learning',
          snippet: 'Advanced artificial intelligence and machine learning techniques.',
        }),
      ];

      const scored = scoringService.scoreBatch(docs, mockQuery);

      console.log('[Test] Batch scores:', scored.map(d => ({
        url: d.url,
        score: d.confidenceScore?.toFixed(3),
      })));

      expect(scored.length).toBe(3);
      expect(scored[0].confidenceScore).toBeDefined();
      expect(scored[1].confidenceScore).toBeDefined();
      expect(scored[2].confidenceScore).toBeDefined();

      // Wikipedia and arxiv should score higher than cooking recipe
      expect(scored[0].confidenceScore!).toBeGreaterThan(scored[1].confidenceScore!);
      expect(scored[2].confidenceScore!).toBeGreaterThan(scored[1].confidenceScore!);
    });
  });
});
