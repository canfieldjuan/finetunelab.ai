import reputationData from './reputation.json';
import type { WebSearchDocument } from './types';

// Weights for the scoring model
const WEIGHTS = {
  keywordRelevance: 0.6, // 60% weight
  sourceReputation: 0.2, // 20% weight
  recency: 0.2,          // 20% weight
};

// Keywords that indicate the user wants recent information
const RECENCY_KEYWORDS = [
  'latest', 'recent', 'new', 'current', 'today', 'now',
  'this week', 'this month', 'this year', '2025', '2024',
  'breaking', 'update', 'announcement', 'released',
];

export class ScoringService {
  /**
   * Calculate a confidence score for a search result (0-1 scale)
   * Higher score = more relevant and trustworthy
   */
  calculateConfidence(
    document: WebSearchDocument,
    query: string
  ): number {
    const keywordScore = this.calculateKeywordRelevance(document, query);
    const reputationScore = this.calculateSourceReputation(document);
    const recencyScore = this.calculateRecencyScore(document, query);

    const confidenceScore =
      keywordScore * WEIGHTS.keywordRelevance +
      reputationScore * WEIGHTS.sourceReputation +
      recencyScore * WEIGHTS.recency;

    console.log(`[ScoringService] Scored ${document.url}:`, {
      confidence: confidenceScore.toFixed(3),
      keyword: keywordScore.toFixed(3),
      reputation: reputationScore.toFixed(3),
      recency: recencyScore.toFixed(3),
    });

    return Math.max(0, Math.min(1, confidenceScore));
  }

  /**
   * Calculate keyword relevance score (0-1)
   * Measures how well the result matches the query terms
   */
  private calculateKeywordRelevance(
    document: WebSearchDocument,
    query: string
  ): number {
    const queryTerms = this.tokenize(query.toLowerCase());
    const titleText = this.tokenize(document.title.toLowerCase());
    const snippetText = this.tokenize(document.snippet.toLowerCase());

    if (queryTerms.length === 0) {
      return 0.5; // Neutral score if no valid query terms
    }

    // Count how many query terms appear in title and snippet
    let titleMatches = 0;
    let snippetMatches = 0;

    for (const term of queryTerms) {
      if (titleText.includes(term)) {
        titleMatches++;
      }
      if (snippetText.includes(term)) {
        snippetMatches++;
      }
    }

    // Title matches are weighted more heavily
    const titleScore = titleMatches / queryTerms.length;
    const snippetScore = snippetMatches / queryTerms.length;

    const relevanceScore = titleScore * 0.7 + snippetScore * 0.3;

    return Math.max(0, Math.min(1, relevanceScore));
  }

  /**
   * Calculate source reputation score (0-1)
   * Based on domain trust lists
   */
  private calculateSourceReputation(document: WebSearchDocument): number {
    try {
      const url = new URL(document.url);
      const domain = url.hostname.toLowerCase().replace(/^www\./, '');

      // Check high trust domains
      for (const trustedDomain of reputationData.highTrust) {
        if (domain.endsWith(trustedDomain)) {
          return reputationData.trustScores.highTrust;
        }
      }

      // Check medium trust domains
      for (const mediumDomain of reputationData.mediumTrust) {
        if (domain.endsWith(mediumDomain)) {
          return reputationData.trustScores.mediumTrust;
        }
      }

      // Check low trust keywords in domain
      for (const lowTrustKeyword of reputationData.lowTrust) {
        if (domain.includes(lowTrustKeyword)) {
          return reputationData.trustScores.lowTrust;
        }
      }

      // Unknown domain - neutral score
      return reputationData.trustScores.unknown;
    } catch {
      // Invalid URL - return neutral score
      return reputationData.trustScores.unknown;
    }
  }

  /**
   * Calculate recency score (0-1)
   * Higher score if query wants recent info and result is recent
   */
  private calculateRecencyScore(
    document: WebSearchDocument,
    query: string
  ): number {
    const queryLower = query.toLowerCase();
    const wantsRecent = RECENCY_KEYWORDS.some(keyword =>
      queryLower.includes(keyword)
    );

    // If query doesn't ask for recent info, return neutral score
    if (!wantsRecent) {
      return 0.5;
    }

    // If no publication date, return low score for recency queries
    if (!document.publishedAt) {
      return 0.3;
    }

    try {
      const publishedDate = new Date(document.publishedAt);
      const now = new Date();
      const daysSincePublished = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);

      // Scoring based on age
      if (daysSincePublished < 7) {
        return 1.0; // Published within a week
      } else if (daysSincePublished < 30) {
        return 0.8; // Published within a month
      } else if (daysSincePublished < 90) {
        return 0.6; // Published within 3 months
      } else if (daysSincePublished < 365) {
        return 0.4; // Published within a year
      } else {
        return 0.2; // Older than a year
      }
    } catch {
      // Invalid date - return low score
      return 0.3;
    }
  }

  /**
   * Simple tokenizer - splits text into words and filters out common stop words
   */
  private tokenize(text: string): string[] {
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at',
      'to', 'for', 'of', 'as', 'by', 'is', 'was', 'are', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
      'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'can', 'this', 'that', 'these', 'those', 'what', 'which',
    ]);

    return text
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Score multiple documents and return them with confidence scores attached
   */
  scoreBatch(
    documents: WebSearchDocument[],
    query: string
  ): WebSearchDocument[] {
    console.log(`[ScoringService] Scoring ${documents.length} results for query: "${query}"`);
    
    const startTime = Date.now();
    
    const scoredDocuments = documents.map(doc => ({
      ...doc,
      confidenceScore: this.calculateConfidence(doc, query),
    }));

    const duration = Date.now() - startTime;
    console.log(`[ScoringService] Scoring complete in ${duration}ms`);

    return scoredDocuments;
  }
}

export const scoringService = new ScoringService();
