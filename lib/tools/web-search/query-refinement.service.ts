import { getOpenAIResponse } from '@/lib/llm/openai';

// Configuration for query refinement
const REFINEMENT_CONFIG = {
  model: 'gpt-4o-mini',
  temperature: 0.7, // Higher temperature for creative query variations
  maxTokens: 150,
};

// Threshold for determining "poor results"
export const POOR_RESULTS_THRESHOLD = {
  avgConfidence: 0.4, // Average confidence score below this triggers refinement
  minResultCount: 3,  // Fewer than this many results triggers refinement
};

export class QueryRefinementService {
  /**
   * Detect if search results are poor quality and need refinement
   */
  shouldRefine(
    results: Array<{ confidenceScore?: number }>,
    avgConfidence: number
  ): boolean {
    // Check if we have too few results
    if (results.length < POOR_RESULTS_THRESHOLD.minResultCount) {
      console.log('[QueryRefinement] Too few results:', results.length);
      return true;
    }

    // Check if average confidence is too low
    if (avgConfidence < POOR_RESULTS_THRESHOLD.avgConfidence) {
      console.log('[QueryRefinement] Low average confidence:', avgConfidence.toFixed(3));
      return true;
    }

    console.log('[QueryRefinement] Results are acceptable:', {
      count: results.length,
      avgConfidence: avgConfidence.toFixed(3),
    });
    return false;
  }

  /**
   * Calculate average confidence score from results
   */
  calculateAverageConfidence(
    results: Array<{ confidenceScore?: number }>
  ): number {
    if (results.length === 0) {
      return 0;
    }

    const topResults = results.slice(0, 5); // Check top 5 results
    const scores = topResults.map(r => r.confidenceScore ?? 0.5);
    const sum = scores.reduce((acc, score) => acc + score, 0);
    const avg = sum / scores.length;

    return avg;
  }

  /**
   * Generate refined search queries using LLM
   */
  async generateRefinedQueries(
    originalQuery: string,
    currentDate: string = new Date().toISOString().split('T')[0]
  ): Promise<string[]> {
    try {
      console.log('[QueryRefinement] Generating refined queries for:', originalQuery);

      const prompt = this.buildRefinementPrompt(originalQuery, currentDate);
      const response = await this.callLLM(prompt);

      // Parse the response to extract queries
      const queries = this.parseQueriesFromResponse(response);

      console.log('[QueryRefinement] Generated refined queries:', queries);
      return queries;
    } catch (error) {
      console.error('[QueryRefinement] Failed to generate refined queries:', error);
      // Return a simple fallback refinement
      return [this.createFallbackQuery(originalQuery, currentDate)];
    }
  }

  /**
   * Build the prompt for query refinement
   */
  private buildRefinementPrompt(
    originalQuery: string,
    currentDate: string
  ): string {
    return `The search query "${originalQuery}" returned low-quality or insufficient results.

Your task: Generate 2 alternative, more specific search queries that are more likely to find relevant, high-quality information.

Guidelines:
- Make queries more specific and detailed
- Add relevant context or keywords
- If the query seems to want recent info, include the current date context: ${currentDate}
- Keep queries natural and readable
- Each query should be on its own line
- Do not number the queries

Original query: ${originalQuery}

Generate 2 refined queries:`;
  }

  /**
   * Call the LLM to generate refined queries
   */
  private async callLLM(prompt: string): Promise<string> {
    const messages = [
      {
        role: 'system' as const,
        content: 'You are a search query optimization assistant. Generate improved, more specific search queries that will yield better results. Return only the queries, one per line, without numbering or explanation.',
      },
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    const response = await getOpenAIResponse(
      messages,
      REFINEMENT_CONFIG.model,
      REFINEMENT_CONFIG.temperature,
      REFINEMENT_CONFIG.maxTokens
    );

    return response.trim();
  }

  /**
   * Parse queries from LLM response
   */
  private parseQueriesFromResponse(response: string): string[] {
    // Split by newlines and filter out empty lines
    const lines = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Remove numbered prefixes like "1.", "2)", "Query 1:", etc.
        return line.replace(/^(Query |Alternative |Refined )?[0-9]+[:.)\-]\s*/i, '');
      })
      .filter(line => line.length > 0);

    // Take first 2 valid queries
    const queries = lines.slice(0, 2);

    // If we got fewer than 2 queries, ensure we have at least one
    if (queries.length === 0) {
      throw new Error('No valid queries parsed from LLM response');
    }

    return queries;
  }

  /**
   * Create a simple fallback query if LLM fails
   */
  private createFallbackQuery(
    originalQuery: string,
    currentDate: string
  ): string {
    // Simple heuristic: add current year to make it more specific
    const year = new Date(currentDate).getFullYear();
    return `${originalQuery} ${year}`;
  }

  /**
   * Merge and deduplicate results from multiple queries
   */
  deduplicateResults<T extends { url: string }>(
    ...resultSets: T[][]
  ): T[] {
    const seen = new Set<string>();
    const deduplicated: T[] = [];

    for (const resultSet of resultSets) {
      for (const result of resultSet) {
        const normalizedUrl = this.normalizeUrl(result.url);
        if (!seen.has(normalizedUrl)) {
          seen.add(normalizedUrl);
          deduplicated.push(result);
        }
      }
    }

    console.log('[QueryRefinement] Deduplication:', {
      total: resultSets.reduce((sum, set) => sum + set.length, 0),
      unique: deduplicated.length,
    });

    return deduplicated;
  }

  /**
   * Normalize URL for deduplication
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove trailing slashes and fragments
      const normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, '')}`;
      return normalized.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
}

export const queryRefinementService = new QueryRefinementService();
