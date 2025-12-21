/**
 * GraphRAG Service
 * Integrates document search with chat for context-aware responses
 */

import { searchService } from '../graphiti';
import { getGraphitiClient, type EmbedderConfig } from '../graphiti/client';
import { graphragConfig } from '../config';
import { classifyQuery } from '../utils/query-classifier';
import type { SearchSource, GraphRAGRetrievalMetadata } from '../types';
import type { TraceContext } from '@/lib/tracing/types';

// ============================================================================
// Types
// ============================================================================

export interface EnhanceOptions {
  maxSources?: number;
  minConfidence?: number;
  maxContextLength?: number;
  includeMetadata?: boolean;
  embedderConfig?: EmbedderConfig;
  traceContext?: TraceContext; // Optional parent trace context for observability
}

export interface EnhancedPrompt {
  prompt: string;
  contextUsed: boolean;
  sources?: SearchSource[];
  metadata?: GraphRAGRetrievalMetadata;
}

export interface Citation {
  source: string;
  content: string;
  confidence: number;
}

// ============================================================================
// GraphRAG Service
// ============================================================================

export class GraphRAGService {
  /**
   * Enhance user prompt with document context
   * Returns original prompt if GraphRAG disabled or no context found
   */
  async enhancePrompt(
    userId: string,
    userMessage: string,
    options: EnhanceOptions = {}
  ): Promise<EnhancedPrompt> {
    // Check if GraphRAG is enabled
    if (!graphragConfig.enabled) {
      console.log('[GraphRAG] Disabled in config, skipping enhancement');
      return {
        prompt: userMessage,
        contextUsed: false,
      };
    }

    // Validate inputs
    if (!userId || !userMessage.trim()) {
      return {
        prompt: userMessage,
        contextUsed: false,
      };
    }

    try {
      const {
        maxSources,
        minConfidence,
        maxContextLength,
        includeMetadata = true,
        embedderConfig,
        traceContext,
      } = options;

      // Set embedder config on client if provided
      if (embedderConfig) {
        const client = getGraphitiClient();
        client.setEmbedderConfig(embedderConfig);
      }

      // Check if query should skip search (tool-specific queries)
      const classification = classifyQuery(userMessage);
      if (classification.shouldSkipSearch) {
        console.log('[GraphRAG] Query classification:', {
          query: userMessage.slice(0, 50),
          isMath: classification.isMath,
          isDateTime: classification.isDateTime,
          isWebSearch: classification.isWebSearch,
          action: 'SKIP_SEARCH',
          reason: classification.reason,
        });
        return {
          prompt: userMessage,
          contextUsed: false,
        };
      }

      // Search knowledge graph for relevant context
      console.log('[GraphRAG] Query classification:', {
        query: userMessage.slice(0, 50),
        isToolSpecific: classification.isToolSpecific,
        action: 'SEARCH',
      });
      // Pass trace context to search service for child span creation
      const searchResult = await searchService.search(userMessage, userId, traceContext);

      let filteredSources = searchResult.sources || [];

      // DIAGNOSTIC: Log all sources BEFORE filtering
      console.log('[GraphRAG] Sources returned from search:', filteredSources.length);
      if (filteredSources.length > 0) {
        const scores = filteredSources.map(s => (s.confidence * 100).toFixed(1) + '%').join(', ');
        console.log('[GraphRAG] Confidence scores:', scores);
        console.log('[GraphRAG] Threshold:', typeof minConfidence === 'number' ? (minConfidence * 100).toFixed(1) + '%' : 'none');
      }

      if (typeof minConfidence === 'number') {
        const beforeFilter = filteredSources.length;
        filteredSources = filteredSources.filter(source => source.confidence >= minConfidence);
        console.log(`[GraphRAG] After threshold filter: ${filteredSources.length}/${beforeFilter} sources remaining`);
      }

      if (typeof maxSources === 'number' && maxSources > 0) {
        filteredSources = filteredSources.slice(0, maxSources);
      }

      // Check if we got useful results after filtering
      if (filteredSources.length === 0) {
        console.log('[GraphRAG] ❌ No relevant context found - all sources filtered out by threshold');
        console.log('[GraphRAG] 💡 TIP: Lower GRAPHRAG_SEARCH_THRESHOLD in .env.local to see more results');
        return {
          prompt: userMessage,
          contextUsed: false,
        };
      }

      // Format context from search results
      const formattedContext = this.formatContext(filteredSources);
      const limitedContext =
        typeof maxContextLength === 'number' && maxContextLength > 0
          ? formattedContext.slice(0, maxContextLength)
          : formattedContext;

      // Inject context into prompt
      const enhancedPrompt = this.injectContext(userMessage, limitedContext);

      console.log('[GraphRAG] Enhanced prompt with', filteredSources.length, 'sources');

      return {
        prompt: enhancedPrompt,
        contextUsed: true,
        sources: filteredSources,
        metadata: includeMetadata ? {
          ...searchResult.metadata,
          graph_used: true,
          nodes_retrieved: filteredSources.length,
          context_chunks_used: filteredSources.length,
          retrieval_time_ms: searchResult.metadata.queryTime,
          context_relevance_score: filteredSources.length > 0
            ? filteredSources.reduce((sum, s) => sum + s.confidence, 0) / filteredSources.length
            : 0,
          answer_grounded_in_graph: filteredSources.length > 0,
        } : undefined,
      };
    } catch (error) {
      // Check if it's a connection error (service not running)
      const isConnectionError = error instanceof Error &&
        (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed'));

      if (isConnectionError) {
        // Silent fallback when GraphRAG service isn't running
        console.log('[GraphRAG] Service unavailable, skipping enhancement');
      } else {
        console.error('[GraphRAG] Error enhancing prompt:', error);
      }

      // Fallback to original prompt on error
      return {
        prompt: userMessage,
        contextUsed: false,
      };
    }
  }

  /**
   * Format search results into readable context
   */
  private formatContext(sources: SearchSource[]): string {
    const contextParts = sources.map((source, index) => {
      return `[${index + 1}] ${source.fact}`;
    });

    return contextParts.join('\n\n');
  }

  /**
   * Inject context into user message
   */
  private injectContext(userMessage: string, context: string): string {
    return `You have access to the user's uploaded documents. Use this context to provide accurate answers.

CONTEXT FROM USER'S DOCUMENTS:
${context}

USER'S QUESTION:
${userMessage}

Instructions:
- Answer the question using the provided context
- If the context contains relevant information, use it in your response
- If the context doesn't help answer the question, say so and provide a general answer
- Be specific and cite facts from the context when applicable`;
  }

  /**
   * Format citations for display
   */
  formatCitations(sources: SearchSource[]): Citation[] {
    return sources.map(source => ({
      source: source.sourceDescription || source.entity || 'Unknown',
      content: source.fact,
      confidence: source.confidence,
    }));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const graphragService = new GraphRAGService();
