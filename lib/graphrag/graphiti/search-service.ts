/**
 * Search Service
 * Handles searching and retrieving information from knowledge graph
 */

import { getGraphitiClient, type GraphitiSearchParams, type GraphitiSearchResult } from './client';
import { graphragConfig } from '../config';
import type { SearchResult, SearchSource } from '../types';

// ============================================================================
// Search Service
// ============================================================================

export class SearchService {
  private client = getGraphitiClient();

  /**
   * Search knowledge graph with hybrid search
   */
  async search(query: string, userId: string): Promise<SearchResult> {
    const startTime = Date.now();

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

    return {
      context,
      sources,
      metadata: {
        searchMethod: graphragConfig.search.searchMethod,
        resultsCount: graphitiResult.edges.length,
        queryTime: Date.now() - startTime,
      },
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

    return {
      context,
      sources,
      metadata: {
        searchMethod: 'hybrid',
        resultsCount: filteredEdges.length,
        queryTime: Date.now() - startTime,
      },
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
