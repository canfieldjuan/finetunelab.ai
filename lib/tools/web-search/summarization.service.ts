// Summarization service for web search results
// Uses existing LLM infrastructure to generate concise summaries

import { getOpenAIResponse } from '@/lib/llm/openai';
import type {
  WebSearchDocument,
  SearchResultSummary,
  SummarizationOptions,
} from './types';

// Default configuration for summarization
const DEFAULT_SUMMARIZATION_OPTIONS: SummarizationOptions = {
  enabled: true,
  maxSummaryLength: 150,
  provider: 'openai',
  model: 'gpt-4o-mini',
};

export class SummarizationService {
  private config: SummarizationOptions;

  constructor(options?: Partial<SummarizationOptions>) {
    this.config = { ...DEFAULT_SUMMARIZATION_OPTIONS, ...options };
    console.log('[SummarizationService] Initialized with config:', this.config);
  }

  /**
   * Summarize a single search result snippet
   * Falls back to original snippet on error
   */
  async summarizeResult(
    document: WebSearchDocument,
    query: string
  ): Promise<string> {
    if (!this.config.enabled) {
      console.log('[SummarizationService] Summarization disabled, returning original snippet');
      return document.snippet;
    }

    try {
      console.log('[SummarizationService] Summarizing result:', {
        url: document.url,
        originalLength: document.snippet.length,
        query,
      });

      const prompt = this.buildSummarizationPrompt(document, query);
      const summary = await this.callSummarizationAPI(prompt);

      console.log('[SummarizationService] Success:', {
        url: document.url,
        originalLength: document.snippet.length,
        summaryLength: summary.length,
      });

      return summary;
    } catch (error) {
      console.error('[SummarizationService] Error:', error);
      console.log('[SummarizationService] Falling back to original snippet');
      return document.snippet;
    }
  }

  /**
   * Summarize multiple search results in batch
   * Processes all results in parallel for better performance
   */
  async summarizeBatch(
    documents: WebSearchDocument[],
    query: string
  ): Promise<SearchResultSummary[]> {
    console.log('[SummarizationService] Batch summarizing:', {
      count: documents.length,
      query,
    });

    const startTime = Date.now();

    const summaries = await Promise.all(
      documents.map(async (doc, index) => {
        const summary = await this.summarizeResult(doc, query);

        return {
          id: `summary-${Date.now()}-${index}`,
          query,
          resultUrl: doc.url,
          resultTitle: doc.title,
          originalSnippet: doc.snippet,
          summary,
          source: doc.source,
          publishedAt: doc.publishedAt,
          createdAt: new Date().toISOString(),
          isIngested: false,
          isSaved: false,
        } as SearchResultSummary;
      })
    );

    const duration = Date.now() - startTime;
    console.log('[SummarizationService] Batch complete:', {
      count: summaries.length,
      durationMs: duration,
      avgPerResult: Math.round(duration / summaries.length),
    });

    return summaries;
  }

  /**
   * Build a summarization prompt optimized for search results
   */
  private buildSummarizationPrompt(
    document: WebSearchDocument,
    query: string
  ): string {
    // Use fullContent if available (from deep search), otherwise fall back to snippet
    const content = document.fullContent || document.snippet;
    const contentType = document.fullContent ? 'Full Article Content' : 'Snippet';

    return `Summarize this search result for the query "${query}" in ${this.config.maxSummaryLength} characters or less.

Focus on key facts and relevance to the query. Be concise and factual.

Title: ${document.title}
Source: ${document.source || 'Unknown'}
Content Type: ${contentType}
Content: ${content}

Summary (max ${this.config.maxSummaryLength} chars):`;
  }

  /**
   * Call the LLM API for summarization
   * Currently uses OpenAI, can be extended for other providers
   */
  private async callSummarizationAPI(prompt: string): Promise<string> {
    const messages = [
      {
        role: 'system' as const,
        content:
          'You are a precise summarization assistant. Create concise, factual summaries that capture the most important information. Never add information not present in the source.',
      },
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    const maxTokens = Math.ceil(this.config.maxSummaryLength / 3);

    const response = await getOpenAIResponse(
      messages,
      this.config.model || 'gpt-4o-mini',
      0.3,
      maxTokens
    );

    return response.trim();
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(options: Partial<SummarizationOptions>): void {
    this.config = { ...this.config, ...options };
    console.log('[SummarizationService] Config updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): SummarizationOptions {
    return { ...this.config };
  }
}

// Export singleton instance with default config
export const summarizationService = new SummarizationService();
