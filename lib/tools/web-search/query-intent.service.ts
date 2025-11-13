/**
 * Query Intent Analysis Service
 * Automatically detects whether a query requires deep search vs quick answer
 * Date: 2025-10-25
 */

export interface QueryIntent {
  needsDeepSearch: boolean;
  confidence: number; // 0-1
  reasoning: string;
  suggestedAutoRefine: boolean;
  suggestsDeepResearch: boolean; // New flag for proposing deep research
}

export class QueryIntentService {
  // Keywords for deep search (content enrichment)
  private readonly researchKeywords = [
    'analyze', 'analysis', 'research', 'investigate', 'study', 'examine',
    'explore', 'deep dive', 'in-depth', 'comprehensive', 'detailed',
    'compare', 'comparison', 'versus', 'vs', 'difference', 'similarities',
    'evaluate', 'assessment', 'review', 'pros and cons', 'advantages',
    'disadvantages', 'trade-offs', 'better', 'best',
    'explain', 'how does', 'why does', 'how to', 'tutorial', 'guide',
    'understand', 'learn about', 'what is the impact', 'implications',
    'trend', 'trends', 'pattern', 'patterns', 'overview', 'landscape',
    'state of', 'current situation', 'evolution', 'history',
    'opinion', 'perspective', 'viewpoint', 'debate', 'controversy',
    'arguments for', 'arguments against',
  ];

  // Keywords for proposing a full deep research session
  private readonly deepResearchKeywords = [
    'write a report on', 'create a summary of', 'give me a detailed breakdown',
    'tell me everything about', 'comprehensive report on', 'in-depth analysis of'
  ];

  // Keywords indicating quick factual queries (don't need deep search)
  private readonly quickAnswerKeywords = [
    'when is', 'what time', 'when did', 'date', 'schedule',
    'weather', 'temperature', 'stock price', 'score', 'result',
    'definition of', 'what is the', 'who is', 'where is',
    'address', 'phone number', 'hours', 'open', 'closed',
    'price of', 'cost of', 'how much',
  ];

  // Length thresholds
  private readonly SHORT_QUERY_LENGTH = 5; // words
  private readonly LONG_QUERY_LENGTH = 10; // words

  /**
   * Analyze a search query to determine intent
   */
  analyzeQuery(query: string): QueryIntent {
    const normalizedQuery = query.toLowerCase().trim();
    const wordCount = normalizedQuery.split(/\s+/).length;

    // Score components
    let researchScore = 0;
    let quickAnswerScore = 0;
    let deepResearchScore = 0;

    // Check for research keywords
    for (const keyword of this.researchKeywords) {
      if (normalizedQuery.includes(keyword)) {
        researchScore += 1;
      }
    }

    // Check for deep research keywords
    for (const keyword of this.deepResearchKeywords) {
      if (normalizedQuery.includes(keyword)) {
        deepResearchScore += 1;
      }
    }

    // Check for quick answer keywords
    for (const keyword of this.quickAnswerKeywords) {
      if (normalizedQuery.includes(keyword)) {
        quickAnswerScore += 1;
      }
    }

    // Query length scoring
    if (wordCount >= this.LONG_QUERY_LENGTH) {
      researchScore += 0.5; // Longer queries often need deeper analysis
    }
    if (wordCount >= 15) { // Very long queries might imply a deep research request
        deepResearchScore += 0.5;
    }
    if (wordCount <= this.SHORT_QUERY_LENGTH) {
      quickAnswerScore += 0.5; // Short queries often need quick facts
    }

    // Question marks and complexity
    if (normalizedQuery.includes('?')) {
      if (normalizedQuery.split('?').length > 2) {
        researchScore += 1;
      }
    }

    // Determine intent based on scores
    const totalScore = researchScore + quickAnswerScore + deepResearchScore;
    let needsDeepSearch = false;
    let suggestsDeepResearch = false;
    let confidence = 0;
    let reasoning = '';
    let suggestedAutoRefine = false;

    if (deepResearchScore > 0) {
        suggestsDeepResearch = true;
        needsDeepSearch = true; // Deep research implies deep search for the initial step
        confidence = Math.min(deepResearchScore / (totalScore + 1), 0.95);
        reasoning = `Deep research query detected (score: ${deepResearchScore.toFixed(1)}). Proposing a full research session.`;
    } else if (totalScore === 0) {
      needsDeepSearch = wordCount > this.SHORT_QUERY_LENGTH;
      confidence = 0.5;
      reasoning = 'No clear intent keywords detected. Using query length heuristic.';
      suggestedAutoRefine = true;
    } else if (researchScore > quickAnswerScore) {
      needsDeepSearch = true;
      confidence = Math.min(researchScore / (totalScore + 1), 0.95);
      reasoning = `Research/analysis query detected (score: ${researchScore.toFixed(1)} vs ${quickAnswerScore.toFixed(1)}). Deep search recommended.`;
    } else {
      needsDeepSearch = false;
      confidence = Math.min(quickAnswerScore / (totalScore + 1), 0.95);
      reasoning = `Quick factual query detected (score: ${quickAnswerScore.toFixed(1)} vs ${researchScore.toFixed(1)}). Snippets sufficient.`;
    }

    console.log('[QueryIntent]', {
      query: query.substring(0, 50),
      needsDeepSearch,
      suggestsDeepResearch,
      confidence: confidence.toFixed(2),
    });

    return {
      needsDeepSearch,
      confidence,
      reasoning,
      suggestedAutoRefine,
      suggestsDeepResearch,
    };
  }
}

export const queryIntentService = new QueryIntentService();
