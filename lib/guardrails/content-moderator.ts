/**
 * Content Moderator
 * Integrates with OpenAI Moderation API and provides fallback pattern-based moderation
 */

import type {
  ContentModerationResult,
  ContentModerationCategories,
  ContentModerationScores,
} from './types';
import { guardrailsConfig } from './config';

// ============================================================================
// Pattern-based Moderation (Fallback)
// ============================================================================

interface ContentPattern {
  pattern: RegExp;
  category: keyof ContentModerationCategories;
  weight: number;
}

const CONTENT_PATTERNS: ContentPattern[] = [
  // Hate speech patterns
  {
    pattern: /\b(kill\s+all|exterminate|genocide|ethnic\s+cleansing)\b/i,
    category: 'hate/threatening',
    weight: 0.9,
  },
  {
    pattern: /\b(racial\s+slur|hate\s+group|white\s+supremac|nazi)\b/i,
    category: 'hate',
    weight: 0.8,
  },

  // Violence patterns
  {
    pattern: /\b(how\s+to\s+make\s+a?\s*(bomb|explosive|weapon))\b/i,
    category: 'violence',
    weight: 0.95,
  },
  {
    pattern: /\b(murder|assassinate|torture)\s+(instructions?|guide|how\s+to)\b/i,
    category: 'violence/graphic',
    weight: 0.9,
  },

  // Self-harm patterns
  {
    pattern: /\b(how\s+to\s+(kill|harm)\s+(yourself|myself)|suicide\s+methods?)\b/i,
    category: 'self-harm/instructions',
    weight: 0.95,
  },
  {
    pattern: /\b(want\s+to\s+(die|end\s+it|kill\s+myself)|planning\s+suicide)\b/i,
    category: 'self-harm/intent',
    weight: 0.9,
  },

  // Harassment patterns
  {
    pattern: /\b(i\s+will\s+(find|hurt|kill)\s+you|threat(en)?\s+(your|you))\b/i,
    category: 'harassment/threatening',
    weight: 0.9,
  },
  {
    pattern: /\b(doxx(ing)?|reveal\s+(your\s+)?personal\s+info)\b/i,
    category: 'harassment',
    weight: 0.8,
  },

  // Sexual content patterns (general - not CSAM which requires immediate blocking)
  {
    pattern: /\b(explicit\s+sexual|pornograph(ic|y)|sexual\s+content)\b/i,
    category: 'sexual',
    weight: 0.7,
  },
];

// ============================================================================
// OpenAI Moderation API Response Type
// ============================================================================

interface OpenAIModerationResponse {
  id: string;
  model: string;
  results: Array<{
    flagged: boolean;
    categories: Record<string, boolean>;
    category_scores: Record<string, number>;
  }>;
}

// ============================================================================
// Content Moderator Class
// ============================================================================

export class ContentModerator {
  private config: typeof guardrailsConfig.contentModeration;
  private apiKey: string | null;

  constructor() {
    this.config = guardrailsConfig.contentModeration;
    this.apiKey = process.env.OPENAI_MODERATION_API_KEY || process.env.OPENAI_API_KEY || null;
  }

  /**
   * Moderate content using configured provider
   */
  async moderate(content: string): Promise<ContentModerationResult> {
    if (!this.config.enabled) {
      return this.getEmptyResult('pattern');
    }

    const provider = this.determineProvider();

    if (provider === 'openai') {
      try {
        return await this.moderateWithOpenAI(content);
      } catch (error) {
        console.error('[ContentModerator] OpenAI moderation failed, falling back to pattern:', error);
        return this.moderateWithPatterns(content);
      }
    }

    return this.moderateWithPatterns(content);
  }

  /**
   * Determine which provider to use
   */
  private determineProvider(): 'openai' | 'pattern' {
    if (this.config.provider === 'pattern') {
      return 'pattern';
    }

    if (this.config.provider === 'openai' || this.config.provider === 'auto') {
      if (this.apiKey) {
        return 'openai';
      }
    }

    return 'pattern';
  }

  /**
   * Moderate using OpenAI Moderation API
   */
  private async moderateWithOpenAI(content: string): Promise<ContentModerationResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ input: content }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Moderation API error: ${response.status} - ${error}`);
    }

    const data: OpenAIModerationResponse = await response.json();

    if (!data.results || data.results.length === 0) {
      throw new Error('No results from OpenAI Moderation API');
    }

    const result = data.results[0];

    // Convert OpenAI categories to our format
    const categories = this.convertOpenAICategories(result.categories);
    const categoryScores = this.convertOpenAIScores(result.category_scores);

    return {
      flagged: result.flagged,
      categories,
      categoryScores,
      provider: 'openai',
    };
  }

  /**
   * Convert OpenAI category names to our format
   */
  private convertOpenAICategories(
    categories: Record<string, boolean>
  ): ContentModerationCategories {
    return {
      'hate': categories['hate'] || false,
      'hate/threatening': categories['hate/threatening'] || false,
      'harassment': categories['harassment'] || false,
      'harassment/threatening': categories['harassment/threatening'] || false,
      'self-harm': categories['self-harm'] || false,
      'self-harm/intent': categories['self-harm/intent'] || false,
      'self-harm/instructions': categories['self-harm/instructions'] || false,
      'sexual': categories['sexual'] || false,
      'sexual/minors': categories['sexual/minors'] || false,
      'violence': categories['violence'] || false,
      'violence/graphic': categories['violence/graphic'] || false,
    };
  }

  /**
   * Convert OpenAI scores to our format
   */
  private convertOpenAIScores(
    scores: Record<string, number>
  ): ContentModerationScores {
    return {
      'hate': scores['hate'] || 0,
      'hate/threatening': scores['hate/threatening'] || 0,
      'harassment': scores['harassment'] || 0,
      'harassment/threatening': scores['harassment/threatening'] || 0,
      'self-harm': scores['self-harm'] || 0,
      'self-harm/intent': scores['self-harm/intent'] || 0,
      'self-harm/instructions': scores['self-harm/instructions'] || 0,
      'sexual': scores['sexual'] || 0,
      'sexual/minors': scores['sexual/minors'] || 0,
      'violence': scores['violence'] || 0,
      'violence/graphic': scores['violence/graphic'] || 0,
    };
  }

  /**
   * Moderate using pattern-based detection (fallback)
   */
  private moderateWithPatterns(content: string): ContentModerationResult {
    const categories = this.getEmptyCategories();
    const categoryScores = this.getEmptyScores();

    const normalizedContent = content.toLowerCase();

    for (const pattern of CONTENT_PATTERNS) {
      if (pattern.pattern.test(normalizedContent)) {
        categories[pattern.category] = true;
        categoryScores[pattern.category] = Math.max(
          categoryScores[pattern.category],
          pattern.weight
        );
      }
    }

    // Check if any category is flagged
    const flagged = Object.values(categories).some(v => v);

    return {
      flagged,
      categories,
      categoryScores,
      provider: 'pattern',
    };
  }

  /**
   * Check if result should block the request
   */
  shouldBlock(result: ContentModerationResult): boolean {
    if (!result.flagged) {
      return false;
    }

    // Check if any blocked category is flagged with score above threshold
    for (const category of this.config.blockCategories) {
      if (result.categories[category]) {
        const score = result.categoryScores[category];
        if (score >= this.config.scoreThreshold) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get explanation for moderation result
   */
  getExplanation(result: ContentModerationResult): string {
    if (!result.flagged) {
      return 'Content passed moderation.';
    }

    const flaggedCategories = Object.entries(result.categories)
      .filter(([, flagged]) => flagged)
      .map(([category]) => category);

    return `Content flagged for: ${flaggedCategories.join(', ')}. Provider: ${result.provider}`;
  }

  /**
   * Get empty categories object
   */
  private getEmptyCategories(): ContentModerationCategories {
    return {
      'hate': false,
      'hate/threatening': false,
      'harassment': false,
      'harassment/threatening': false,
      'self-harm': false,
      'self-harm/intent': false,
      'self-harm/instructions': false,
      'sexual': false,
      'sexual/minors': false,
      'violence': false,
      'violence/graphic': false,
    };
  }

  /**
   * Get empty scores object
   */
  private getEmptyScores(): ContentModerationScores {
    return {
      'hate': 0,
      'hate/threatening': 0,
      'harassment': 0,
      'harassment/threatening': 0,
      'self-harm': 0,
      'self-harm/intent': 0,
      'self-harm/instructions': 0,
      'sexual': 0,
      'sexual/minors': 0,
      'violence': 0,
      'violence/graphic': 0,
    };
  }

  /**
   * Get empty result
   */
  private getEmptyResult(provider: 'openai' | 'pattern'): ContentModerationResult {
    return {
      flagged: false,
      categories: this.getEmptyCategories(),
      categoryScores: this.getEmptyScores(),
      provider,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const contentModerator = new ContentModerator();
