// Web Search Tool - Configuration
// Phase 4.1: Web search-specific configuration
// Date: October 10, 2025

import { webSearchConfig as globalConfig } from '../config';

/**
 * Web Search-specific configuration
 */
export const searchConfig = {
  enabled: globalConfig.enabled,
  primaryProvider: globalConfig.primaryProvider,
  fallbackProvider: globalConfig.fallbackProvider,
  maxResults: globalConfig.maxResults,
  requestTimeoutMs: globalConfig.requestTimeoutMs,
  minQueryLength: globalConfig.minQueryLength,
  maxQueryLength: globalConfig.maxQueryLength,
  rateLimitPerMinute: globalConfig.rateLimitPerMinute,
  logResults: globalConfig.logResults,

  cache: {
    enabled: globalConfig.cacheEnabled,
    ttlSeconds: globalConfig.cacheTTLSeconds,
  },

  providers: {
    brave: {
      apiKey: globalConfig.brave.apiKey,
      endpoint: globalConfig.brave.endpoint,
      filterAdultContent: process.env.SEARCH_BRAVE_FILTER_ADULT !== 'false',
      filterDuplicates: process.env.SEARCH_BRAVE_FILTER_DUPLICATES !== 'false',
    },
    serper: {
      apiKey: globalConfig.serper.apiKey,
      endpoint: globalConfig.serper.endpoint,
      location: process.env.SERPER_LOCATION || 'United States',
      gl: process.env.SERPER_GL || 'us',
      hl: process.env.SERPER_HL || 'en',
    },
    google: {
      apiKey: process.env.GOOGLE_SEARCH_API_KEY || '',
      cx: process.env.GOOGLE_SEARCH_CX || '',
      endpoint: process.env.GOOGLE_SEARCH_ENDPOINT || 'https://www.googleapis.com/customsearch/v1'
    },
    duckduckgo: {
      endpoint: process.env.DUCKDUCKGO_ENDPOINT || 'https://api.duckduckgo.com/'
    },
    bing: {
      apiKey: process.env.BING_SEARCH_API_KEY || '',
      endpoint: process.env.BING_SEARCH_ENDPOINT || 'https://api.bing.microsoft.com/v7.0/search'
    }
  },

  graphRag: {
    ingestResults: globalConfig.graphRag.ingestResults,
    groupId: globalConfig.graphRag.groupId,
    maxDocumentsPerRun: parseInt(process.env.SEARCH_INGEST_MAX_DOCS || '5'),
  },
};

export type SearchConfig = typeof searchConfig;
