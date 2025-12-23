/**
 * Search Service
 * Handles searching and retrieving information from knowledge graph
 */

import { getGraphitiClient, type GraphitiSearchParams, type GraphitiSearchResult } from './client';
import { graphragConfig } from '../config';
import type { SearchResult, SearchSource, GraphRAGRetrievalMetadata } from '../types';
import { traceService } from '@/lib/tracing/trace.service';
import type { TraceContext, RAGOutputData } from '@/lib/tracing/types';

// ============================================================================
// Search Service
// ============================================================================

export class SearchService {
  private client = getGraphitiClient();

  /**
   * Search knowledge graph with hybrid search
   */
  async search(query: string, userId: string, parentContext?: TraceContext): Promise<SearchResult> {
    const startTime = Date.now();
    let retrievalContext: TraceContext | undefined;

    // Start trace for GraphRAG retrieval if parent context provided
    if (parentContext) {
      try {
        retrievalContext = await traceService.createChildSpan(
          parentContext,
          'graphrag.retrieve',
          'retrieval'
        );
        console.log('[SearchService] Started GraphRAG retrieval trace');
      } catch (traceErr) {
        console.error('[SearchService] Failed to start retrieval trace:', traceErr);
      }
    }

    const params: GraphitiSearchParams = {
      query,
      group_ids: [userId],
      num_results: graphragConfig.search.topK,
    };

    console.log('[SearchService] Calling Graphiti with params:', params);

    const graphitiResult = await this.client.search(params);

    console.log('[SearchService] Graphiti returned:', {
      edgesCount: graphitiResult.edges?.length || 0,
      firstEdge: graphitiResult.edges?.[0] ? {
        fact: graphitiResult.edges[0].fact?.slice(0, 100),
        score: graphitiResult.edges[0].score
      } : null
    });

    // Build context and sources from results
    const context = this.buildContext(graphitiResult);
    const sources = this.extractSources(graphitiResult);

    console.log('[SearchService] Extracted sources:', sources.length);

    // Calculate relevance score from edges
    const relevanceScores = graphitiResult.edges.map(e => e.score || 0);
    const avgRelevance = relevanceScores.length > 0
      ? relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length
      : 0;

    const queryTime = Date.now() - startTime;

    // End retrieval trace with structured data
    if (retrievalContext) {
      try {
        const { truncateString, truncateRAGChunks } = await import('@/lib/tracing/trace-utils');

        const inputData = {
          query: truncateString(query, 500),
          searchMethod: graphragConfig.search.searchMethod,
          topK: graphragConfig.search.topK,
        };

        const outputData: RAGOutputData = {
          topChunks: truncateRAGChunks(
            graphitiResult.edges.map(edge => ({
              fact: edge.fact,
              score: edge.score || 0,
              sourceDescription: edge.source_description,
              entityName: edge.source_node?.name,
            })),
            5
          ),
          totalCandidates: graphitiResult.edges.length,
          avgConfidence: avgRelevance,
        };

        // Calculate context tokens (approximate)
        const contextTokens = context.length / 4;

        await traceService.endTrace(retrievalContext, {
          endTime: new Date(),
          status: 'completed',
          inputData,
          outputData,
          ragContext: {
            contextTokens: Math.ceil(contextTokens),
            retrievalLatencyMs: queryTime,
            chunkDeduplicationCount: 0, // Graphiti handles deduplication internally
            cacheHitCount: 0, // No caching layer yet
          },
          metadata: {
            userId,
            queryTimeMs: queryTime,
            sourcesCount: sources.length,
          },
        });
        console.log('[SearchService] Ended GraphRAG retrieval trace (success)');
      } catch (traceErr) {
        console.error('[SearchService] Failed to end retrieval trace:', traceErr);
      }
    }

    return {
      context,
      sources,
      metadata: {
        // Existing fields
        searchMethod: graphragConfig.search.searchMethod,
        resultsCount: graphitiResult.edges.length,
        queryTime,

        // New GraphRAG analytics fields
        graph_used: graphitiResult.edges.length > 0,
        nodes_retrieved: graphitiResult.edges.length,
        context_chunks_used: sources.length,
        retrieval_time_ms: queryTime,
        context_relevance_score: avgRelevance,
        answer_grounded_in_graph: sources.length > 0, // Will be refined post-response if needed
      } as GraphRAGRetrievalMetadata,
    };
  }

  /**
   * Search with custom options
   */
  async searchCustom(
    query: string,
    userId: string,
    options?: { topK?: number; threshold?: number }
  ): Promise<SearchResult> {
    const startTime = Date.now();

    const params: GraphitiSearchParams = {
      query,
      group_ids: [userId],
      num_results: options?.topK || graphragConfig.search.topK,
    };

    const graphitiResult = await this.client.search(params);

    // Filter by threshold if provided
    let filteredEdges = graphitiResult.edges;
    if (options?.threshold) {
      filteredEdges = graphitiResult.edges.filter(
        edge => (edge.score || 0) >= (options.threshold || 0)
      );
    }

    const context = this.buildContextFromEdges(filteredEdges);
    const sources = this.extractSourcesFromEdges(filteredEdges);

    // Calculate relevance score from filtered edges
    const relevanceScores = filteredEdges.map(e => e.score || 0);
    const avgRelevance = relevanceScores.length > 0
      ? relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length
      : 0;

    const queryTime = Date.now() - startTime;

    return {
      context,
      sources,
      metadata: {
        // Existing fields
        searchMethod: 'hybrid',
        resultsCount: filteredEdges.length,
        queryTime,

        // New GraphRAG analytics fields
        graph_used: filteredEdges.length > 0,
        nodes_retrieved: filteredEdges.length,
        context_chunks_used: sources.length,
        retrieval_time_ms: queryTime,
        context_relevance_score: avgRelevance,
        answer_grounded_in_graph: sources.length > 0,
      } as GraphRAGRetrievalMetadata,
    };
  }

  /**
   * Get entity relationships
   */
  async getRelatedEntities(entityName: string, userId: string): Promise<SearchResult> {
    const startTime = Date.now();

    const graphitiResult = await this.client.getEntityEdges(entityName, [userId]);

    const context = this.buildContext(graphitiResult);
    const sources = this.extractSources(graphitiResult);

    return {
      context,
      sources,
      metadata: {
        searchMethod: 'hybrid',
        resultsCount: graphitiResult.edges.length,
        queryTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Build context string from Graphiti results
   */
  private buildContext(result: GraphitiSearchResult): string {
    if (!result.edges.length) {
      return '';
    }

    return this.buildContextFromEdges(result.edges);
  }

  /**
   * Build context from edges
   */
  private buildContextFromEdges(edges: GraphitiSearchResult['edges']): string {
    const facts = edges.map((edge, index) => {
      const source = edge.source_description || 'Document';
      const confidence = edge.score ? ` (confidence: ${(edge.score * 100).toFixed(1)}%)` : '';
      return `${index + 1}. ${edge.fact}${confidence}\n   Source: ${source}`;
    });

    if (!facts.length) {
      return '';
    }

    return `Relevant information from knowledge graph:\n\n${facts.join('\n\n')}`;
  }

  /**
   * Extract sources from Graphiti results
   */
  private extractSources(result: GraphitiSearchResult): SearchSource[] {
    return this.extractSourcesFromEdges(result.edges);
  }

  /**
   * Extract sources from edges
   */
  private extractSourcesFromEdges(edges: GraphitiSearchResult['edges']): SearchSource[] {
    return edges.map(edge => ({
      entity: edge.source_node?.name || 'Unknown',
      relation: edge.name,
      fact: edge.fact,
      confidence: edge.score || 0,
      sourceDescription: edge.source_description,
    }));
  }

  /**
   * Format sources for citation
   */
  formatCitations(sources: SearchSource[]): string {
    if (!sources.length) {
      return '';
    }

    const citations = sources.map((source, index) => {
      const confidence = source.confidence > 0 
        ? ` (${(source.confidence * 100).toFixed(0)}% confidence)`
        : '';
      return `[${index + 1}] ${source.sourceDescription || source.entity}${confidence}`;
    });

    return `\n\nSources:\n${citations.join('\n')}`;
  }

  /**
   * Check if search results are relevant
   */
  hasRelevantResults(result: SearchResult, minConfidence = 0.5): boolean {
    return result.sources.some(source => source.confidence >= minConfidence);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const searchService = new SearchService();
