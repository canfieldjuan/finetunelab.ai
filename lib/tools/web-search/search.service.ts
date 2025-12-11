import { randomUUID } from 'crypto';

import { supabase, supabaseAdmin } from '@/lib/supabaseClient';

import { purgeExpiredEntries, getCachedSearch, saveSearchResult } from './cache';
import { contentService } from './content.service';
import { 
  braveSearchProvider, 
  serperSearchProvider,
  googleSearchProvider,
  duckduckgoSearchProvider,
  bingSearchProvider
} from './new-providers';
import { providerRegistry } from './new-providers/provider.registry';
import { queryRefinementService } from './query-refinement.service';
import { scoringService } from './scoring.service';
import { searchConfig } from './search.config';
import { summarizationService } from './summarization.service';
import { searchStorageService } from './storage.service';
import { telemetryService } from './telemetry.service';
import type {
  ProviderResult,
  SearchOptions,
  WebSearchDocument,
  WebSearchProvider,
  WebSearchResponse,
  GraphRagDocument,
} from './types';

const MAX_PROVIDER_RESULTS = 20;

function clampResultCount(requested: number | undefined, fallback: number): number {
  if (!requested || Number.isNaN(requested)) {
    return fallback;
  }

  return Math.max(1, Math.min(requested, MAX_PROVIDER_RESULTS));
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

export class SearchService {
  private readonly config = searchConfig;

  constructor() {
    providerRegistry.register(braveSearchProvider);
    providerRegistry.register(serperSearchProvider);
    providerRegistry.register(googleSearchProvider);
    providerRegistry.register(duckduckgoSearchProvider);
    providerRegistry.register(bingSearchProvider);
  }

  private resolveProvider(name: string): WebSearchProvider | undefined {
    return providerRegistry.get(name);
  }

  async search(
    query: string,
    requestedMaxResults?: number,
    options: SearchOptions = {},
    userId?: string,
    conversationId?: string,
  ): Promise<WebSearchResponse> {
    if (!this.config.enabled) {
      throw new Error('[WebSearch] ConfigurationError: Web search is disabled. Set TOOL_WEBSEARCH_ENABLED=true to enable.');
    }

    const normalizedQuery = normalizeQuery(query);

    if (!normalizedQuery) {
      throw new Error('[WebSearch] ValidationError: Query parameter is required');
    }

    if (normalizedQuery.length < this.config.minQueryLength) {
      throw new Error(`[WebSearch] ValidationError: Query must be at least ${this.config.minQueryLength} characters long`);
    }

    if (normalizedQuery.length > this.config.maxQueryLength) {
      throw new Error(`[WebSearch] ValidationError: Query exceeds maximum length of ${this.config.maxQueryLength} characters`);
    }

    const maxResults = clampResultCount(requestedMaxResults, this.config.maxResults);

    await this.maybePurgeExpiredCache();

    const providerOverride = options.providerOverride?.toLowerCase();
    const skipCache = options.skipCache === true;

    if (this.config.cache.enabled && !skipCache) {
      const cached = await getCachedSearch({
        query: normalizedQuery,
        provider: providerOverride || this.config.primaryProvider,
        maxResults,
      });

      if (cached) {
        if (this.config.logResults) {
          console.log('[WebSearch] Cache hit for query:', normalizedQuery);
        }

        return {
          query: normalizedQuery,
          results: cached.results,
          metadata: {
            provider: cached.provider,
            latencyMs: 0,
            cached: true,
            fetchedAt: cached.fetchedAt,
            resultCount: cached.resultCount,
          },
          raw: cached.raw,
        };
      }
    }

    const providersToTry = this.buildProviderOrder(providerOverride);

    let lastError: unknown = null;
    let providerResult: ProviderResult | null = null;

    for (const providerName of providersToTry) {
      const provider = this.resolveProvider(providerName);

      if (!provider) {
        continue;
      }

      try {
        if (this.config.logResults) {
          console.log(`[WebSearch] Query "${normalizedQuery}" via ${providerName}`);
        }

        const startTs = Date.now();
        const result = await provider.search({
          query: normalizedQuery,
          maxResults,
          timeoutMs: this.config.requestTimeoutMs,
        });
        const duration = Date.now() - startTs;
        this.recordProviderResult(providerName, duration, true, normalizedQuery.length);
        if (this.config.logResults) {
          const { p50, p95 } = this.getProviderLatencyStats(providerName);
          console.log(`[WebSearch] Provider ${providerName} latency: ${duration}ms (p50=${p50}ms, p95=${p95}ms)`);
        }

        if (result.results.length) {
          providerResult = result;
          break;
        }

        providerResult = result;
      } catch (error) {
        lastError = error;
        const errorCode = error instanceof Error ? error.message : 'Unknown error';
        this.recordProviderResult(providerName, 0, false, normalizedQuery.length, errorCode);
        console.error(`[WebSearch] Provider ${providerName} failed:`, error);
      }
    }

    if (!providerResult) {
      const message = lastError instanceof Error ? lastError.message : 'No provider returned results';
      throw new Error(`[WebSearch] ExecutionError: Search failed - ${message}`);
    }

    // Phase 2 (Quality & Recall): Normalize URLs and de-duplicate results before caching/scoring
    try {
      const before = providerResult.results.length;
      providerResult.results = this.normalizeAndDedupeResults(providerResult.results);
      const after = providerResult.results.length;
      if (this.config.logResults) {
        console.log(`[WebSearch] Normalized & de-duplicated results: ${before} -> ${after}`);
      }
    } catch (normErr) {
      console.error('[WebSearch] Normalization/dedup failed, continuing with raw results:', normErr);
    }

    if (this.config.cache.enabled && !skipCache) {
      await saveSearchResult({
        query: normalizedQuery,
        provider: providerResult.provider,
        maxResults,
        results: providerResult.results,
        raw: providerResult.raw,
        ttlSeconds: this.config.cache.ttlSeconds,
        latencyMs: providerResult.latencyMs,
      });
    }

    // Deep search: Fetch full content from top results (adaptive top count)
    if (options.deepSearch && providerResult.results.length > 0) {
      try {
        // Phase 3: adapt how many documents to fetch based on query characteristics and list size
        const q = normalizedQuery.toLowerCase();
        const deepKeywords = ['analyze','analysis','compare','comparison','evaluate','research','comprehensive','overview'];
        let topCount = 3;
        if (q.length >= 60 || deepKeywords.some(k => q.includes(k))) {
          topCount = Math.min(5, providerResult.results.length);
        } else if (q.length <= 20) {
          topCount = Math.min(2, providerResult.results.length);
        } else {
          topCount = Math.min(3, providerResult.results.length);
        }

        const topResults = providerResult.results.slice(0, topCount);
        console.log(`[WebSearch] Deep search enabled. Fetching full content for ${topResults.length} results (adaptive).`);
        
        const fetchStartTime = Date.now();
        
        // Fetch full content in parallel for all top results
        const contentPromises = topResults.map(async (result, index) => {
          console.log(`[WebSearch] Fetching full content [${index + 1}/${topResults.length}]: ${result.url}`);
          try {
            const fullContent = await contentService.fetchAndClean(result.url);
            
            if (fullContent && fullContent.length > 100) {
              console.log(`[WebSearch] Successfully fetched ${fullContent.length} chars from: ${result.url}`);
              // Store full content in fullContent field, keep original snippet
              return { 
                ...result, 
                fullContent: fullContent 
              };
            }
            
            console.log(`[WebSearch] Content too short or empty, keeping original: ${result.url}`);
            return result;
          } catch (fetchError) {
            console.error(`[WebSearch] Error fetching ${result.url}:`, fetchError);
            return result;
          }
        });
        
        const enrichedResults = await Promise.all(contentPromises);
        const fetchDuration = Date.now() - fetchStartTime;
        
        const successCount = enrichedResults.filter(r => r.fullContent).length;
        console.log(`[WebSearch] Deep search complete in ${fetchDuration}ms. Enriched ${successCount}/${topResults.length} results.`);
        
        // Replace the top results with enriched versions
        providerResult.results = [
          ...enrichedResults,
          ...providerResult.results.slice(topCount),
        ];
      } catch (deepSearchError) {
        // Don't fail the search if deep search fails
        console.error('[WebSearch] Deep search failed, continuing with snippets:', deepSearchError);
      }
    }

    // Calculate confidence scores for all results
    try {
      console.log('[WebSearch] Calculating confidence scores...');
      providerResult.results = scoringService.scoreBatch(
        providerResult.results,
        normalizedQuery
      );
      
      // Sort results by confidence score (highest first)
      providerResult.results.sort((a, b) => {
        const scoreA = a.confidenceScore ?? 0.5;
        const scoreB = b.confidenceScore ?? 0.5;
        return scoreB - scoreA;
      });
      
      console.log('[WebSearch] Confidence scoring complete. Top score:', 
        providerResult.results[0]?.confidenceScore?.toFixed(3) ?? 'N/A'
      );
    } catch (scoringError) {
      // Don't fail the search if scoring fails
      console.error('[WebSearch] Confidence scoring failed, continuing without scores:', scoringError);
    }

    // Summarize results if requested (or if deepSearch is enabled)
    const shouldSummarize = options.summarize || options.deepSearch;
    if (shouldSummarize && providerResult.results.length > 0) {
      try {
        console.log('[WebSearch] Summarizing results:', providerResult.results.length);
        
        const summaries = await summarizationService.summarizeBatch(
          providerResult.results,
          normalizedQuery
        );

        // Attach summaries to results
        providerResult.results = providerResult.results.map((result, index) => ({
          ...result,
          summary: summaries[index]?.summary || result.snippet,
        }));

        console.log('[WebSearch] Summarization complete');

        // Save summaries to storage if user context is available
        if (userId && summaries.length > 0) {
          try {
            const saveResult = await searchStorageService.saveBatch(
              summaries,
              userId,
              conversationId
            );

            console.log('[WebSearch] Saved summaries:', saveResult);
          } catch (storageError) {
            // Don't fail the search if storage fails
            console.error('[WebSearch] Failed to save summaries:', storageError);
          }
        }
      } catch (summarizationError) {
        // Don't fail the search if summarization fails
        console.error('[WebSearch] Failed to summarize results:', summarizationError);
      }
    }

    // Auto-refine query if results are poor
    if (options.autoRefine && !skipCache) {
      const avgConfidence = queryRefinementService.calculateAverageConfidence(providerResult.results);
      const shouldRefine = queryRefinementService.shouldRefine(providerResult.results, avgConfidence);

      if (shouldRefine) {
        console.log('[WebSearch] Poor results detected. Attempting query refinement...');

        try {
          // Generate refined queries
          const refinedQueries = await queryRefinementService.generateRefinedQueries(
            normalizedQuery,
            new Date().toISOString().split('T')[0]
          );

          // Try the first refined query
          if (refinedQueries.length > 0) {
            console.log(`[WebSearch] Trying refined query: "${refinedQueries[0]}"`);

            const refinedResult = await this.search(
              refinedQueries[0],
              maxResults,
              { ...options, autoRefine: false, skipCache: true }, // Prevent infinite recursion
              userId,
              conversationId
            );

            // Check if refined results are better
            const refinedAvgConfidence = queryRefinementService.calculateAverageConfidence(
              refinedResult.results
            );

            if (refinedAvgConfidence > avgConfidence || refinedResult.results.length > providerResult.results.length) {
              console.log('[WebSearch] Refined query produced better results:', {
                originalConfidence: avgConfidence.toFixed(3),
                refinedConfidence: refinedAvgConfidence.toFixed(3),
                originalCount: providerResult.results.length,
                refinedCount: refinedResult.results.length,
              });

              // Merge and deduplicate results
              const mergedResults = queryRefinementService.deduplicateResults(
                refinedResult.results,
                providerResult.results
              );

              providerResult.results = mergedResults.slice(0, maxResults);
              console.log(`[WebSearch] Using ${providerResult.results.length} merged results`);
            } else {
              console.log('[WebSearch] Refined query did not improve results. Using original.');
            }
          }
        } catch (refinementError) {
          // Don't fail the search if refinement fails
          console.error('[WebSearch] Query refinement failed, using original results:', refinementError);
        }
      }
    }

    if (options.sortBy === 'date') {
      providerResult.results.sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateB - dateA;
      });
    } else {
      // Default to sorting by relevance (confidence score)
      providerResult.results.sort((a, b) => {
        const scoreA = a.confidenceScore ?? 0.5;
        const scoreB = b.confidenceScore ?? 0.5;
        return scoreB - scoreA;
      });
    }

    void this.maybeIngestToGraphRag(normalizedQuery, providerResult.results);

    const graphRagResults = await this.queryGraphRag(normalizedQuery);

    if (this.config.logResults) {
      console.log('[WebSearch] Result count:', providerResult.results.length);
    }

    return {
      query: normalizedQuery,
      results: providerResult.results,
      graphRagResults,
      metadata: {
        provider: providerResult.provider,
        latencyMs: providerResult.latencyMs,
        cached: false,
        fetchedAt: new Date().toISOString(),
        resultCount: providerResult.results.length,
      },
      raw: providerResult.raw,
    };
  }

  private async queryGraphRag(query: string): Promise<GraphRagDocument[] | undefined> {
    if (!this.config.graphRag.ingestResults) {
      return;
    }

    try {
      const { documentService } = await import('@/lib/graphrag');
      
      interface GraphRAGService {
        search: (query: string, options: { groupId: string | null }) => Promise<Array<{ 
          id: string; 
          title: string; 
          url: string; 
          snippet: string;
        }>>;
      }
      
      const results = await (documentService as unknown as GraphRAGService).search(query, {
        groupId: this.config.graphRag.groupId,
      });
      
      return results.map((r): GraphRagDocument => ({
        id: r.id,
        title: r.title,
        url: r.url,
        snippet: r.snippet,
      }));
    } catch (error) {
      console.error('[WebSearch] Failed to query GraphRAG:', error);
      return;
    }
  }

  private buildProviderOrder(providerOverride?: string): string[] {
    const ordered = new Set<string>();

    if (providerOverride && providerRegistry.get(providerOverride)) {
      ordered.add(providerOverride);
    }

    const { primaryProvider, fallbackProvider } = this.config;

    if (primaryProvider) {
      ordered.add(primaryProvider);
    }

    if (fallbackProvider && fallbackProvider !== primaryProvider) {
      ordered.add(fallbackProvider);
    }

    const list = providerRegistry.list().map(p => p.name);
    // Optional: telemetry-informed ordering (env toggle)
    if (process.env.SEARCH_TELEMETRY_ROUTING === 'true') {
      list.sort((a, b) => {
        const sa = this.getProviderLatencyStats(a);
        const sb = this.getProviderLatencyStats(b);
        if (sa.p95 !== sb.p95) return sa.p95 - sb.p95;
        if (sa.p50 !== sb.p50) return sa.p50 - sb.p50;
        return 0;
      });
    }
    return list;
  }

  // ================================
  // Phase 2 Helpers: Quality & Recall
  // ================================
  private normalizeAndDedupeResults(results: WebSearchDocument[]): WebSearchDocument[] {
    const seen = new Map<string, WebSearchDocument>();
    for (const doc of results) {
      const normUrl = this.normalizeUrl(doc.url);
      const key = this.canonicalKey(normUrl, doc.title);

      if (!seen.has(key)) {
        seen.set(key, { ...doc, url: normUrl });
        continue;
      }

      // Merge fields to retain the richest version
      const existing = seen.get(key)!;
      seen.set(key, this.mergeDocuments(existing, { ...doc, url: normUrl }));
    }
    return Array.from(seen.values());
  }

  private normalizeUrl(raw: string): string {
    try {
      const u = new URL(raw);
      // Drop fragment
      u.hash = '';
      // Lowercase host
      u.hostname = u.hostname.toLowerCase();
      // Remove common tracking params
      const drop = new Set([
        'utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id',
        'gclid','fbclid','igshid','mc_cid','mc_eid','ref','ref_src','ref_url'
      ]);
      const kept: string[] = [];
      u.searchParams.forEach((value, name) => {
        if (!drop.has(name)) {
          kept.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
        }
      });
      u.search = kept.length ? `?${kept.join('&')}` : '';
      // Normalize trailing slash for root only
      if (u.pathname === '') u.pathname = '/';
      return u.toString();
    } catch {
      return raw;
    }
  }

  private canonicalKey(url: string, title: string): string {
    try {
      const u = new URL(url);
      // Key on host + path, ignore query for canonicalization
      return `${u.hostname}${u.pathname}`.toLowerCase();
    } catch {
      // Fallback: domain-like token from URL string + title
      return `${url.split('?')[0].toLowerCase()}::${(title || '').trim().toLowerCase()}`;
    }
  }

  private mergeDocuments(a: WebSearchDocument, b: WebSearchDocument): WebSearchDocument {
    // Prefer summary/fullContent and longer snippet; keep earliest publishedAt; keep source if missing
    const pick = (x?: string, y?: string) => (x && x.length >= (y?.length || 0) ? x : (y || x));
    return {
      title: pick(a.title, b.title)!,
      url: a.url, // normalized identical
      snippet: pick(a.snippet, b.snippet) || (a.snippet || b.snippet || ''),
      publishedAt: a.publishedAt || b.publishedAt,
      source: a.source || b.source,
      imageUrl: a.imageUrl || b.imageUrl,
      summary: a.summary || b.summary,
      confidenceScore: a.confidenceScore ?? b.confidenceScore,
      fullContent: a.fullContent || b.fullContent,
    };
  }

  private async maybeIngestToGraphRag(query: string, results: WebSearchDocument[]): Promise<void> {
    // Early returns to avoid loading GraphRAG on client-side
    if (!this.config.graphRag.ingestResults) {
      return;
    }

    if (!results.length) {
      return;
    }

    const groupId = this.config.graphRag.groupId;
    if (!groupId) {
      console.warn('[WebSearch] GraphRAG ingestion is enabled but SEARCH_INGEST_GROUP_ID is not set. Skipping.');
      return;
    }

    try {
      // Dynamic import to avoid loading GraphRAG on client-side
      const { documentService } = await import('@/lib/graphrag');

      const topResults = results.slice(0, this.config.graphRag.maxDocumentsPerRun);
      const contentLines = topResults.map((item, index) => {
        const lines = [
          `${index + 1}. ${item.title} (${item.url})`,
          `   ${item.snippet}`,
        ];

        if (item.source) {
          lines.push(`   Source: ${item.source}`);
        }

        if (item.publishedAt) {
          lines.push(`   Published: ${item.publishedAt}`);
        }

        return lines.join('\n');
      });

      const fileContent = `# Web Search Snapshot\n\nQuery: ${query}\nGenerated: ${new Date().toISOString()}\n\n${contentLines.join('\n\n')}\n`;
      const fileName = `web-search-${Date.now()}-${randomUUID()}.md`;
      const file = new File([fileContent], fileName, { type: 'text/markdown' });

      await documentService.uploadAndProcess(supabase, {
        userId: groupId,
        file,
        metadata: {
          query,
          source: 'web_search_tool',
        },
      }, {
        groupId,
      });
    } catch (error) {
      console.error('[WebSearch] Failed to ingest results into GraphRAG:', error);
    }
  }

  private async maybePurgeExpiredCache(): Promise<void> {
    if (!this.config.cache.enabled) {
      return;
    }

    if (Math.random() > 0.05) {
      return;
    }

    try {
      await purgeExpiredEntries();
    } catch (error) {
      console.error('[WebSearch] Failed to purge cache:', error);
    }
  }

  // ================================
  // Phase 3: Provider Telemetry Helpers
  // ================================
  private recordProviderResult(name: string, latencyMs: number, success: boolean, queryLength: number = 0, errorCode?: string): void {
    void telemetryService.logSearch(name, latencyMs, success, queryLength, errorCode);
  }

  private getProviderLatencyStats(name: string): { p50: number; p95: number } {
    return telemetryService.getProviderStats(name);
  }
}

export const searchService = new SearchService();
