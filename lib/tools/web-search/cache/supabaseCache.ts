import { createHash } from 'crypto';

import { supabase } from '@/lib/supabaseClient';
import type {
  CacheLookupOptions,
  CacheSavePayload,
  CachedSearchEntry,
  WebSearchDocument,
} from '../types';

const TABLE_NAME = 'search_summaries';

interface CacheRecord {
  id: string;
  query_hash: string;
  query_text: string;
  provider: string;
  max_results: number;
  result_count: number;
  results: WebSearchDocument[];
  raw_response: unknown;
  latency_ms: number;
  fetched_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

function computeQueryHash(query: string, provider: string, maxResults: number): string {
  return createHash('sha256')
    .update(`${provider}::${maxResults}::${query}`)
    .digest('hex');
}

function mapRecord(record: CacheRecord): CachedSearchEntry {
  return {
    id: record.id,
    query: record.query_text,
    queryHash: record.query_hash,
    provider: record.provider,
    maxResults: record.max_results,
    resultCount: record.result_count,
    results: record.results,
    raw: record.raw_response,
    expiresAt: record.expires_at,
    fetchedAt: record.fetched_at,
    createdAt: record.created_at,
  };
}

export async function getCachedSearch(options: CacheLookupOptions): Promise<CachedSearchEntry | null> {
  const queryHash = computeQueryHash(options.query, options.provider, options.maxResults);

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('query_hash', queryHash)
    .eq('provider', options.provider)
    .eq('max_results', options.maxResults)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[WebSearch][Cache] Failed to read cache:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  const record = mapRecord(data as unknown as CacheRecord);
  const now = Date.now();
  const expiresAt = new Date(record.expiresAt).getTime();

  if (Number.isNaN(expiresAt) || expiresAt <= now) {
    return null;
  }

  return record;
}

export async function saveSearchResult(payload: CacheSavePayload): Promise<void> {
  const { query, provider, maxResults, results, raw, ttlSeconds, latencyMs } = payload;
  const queryHash = computeQueryHash(query, provider, maxResults);
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert({
      query_hash: queryHash,
      query_text: query,
      provider,
      max_results: maxResults,
      result_count: results.length,
      results,
      raw_response: raw,
      latency_ms: latencyMs,
      fetched_at: nowIso,
      expires_at: expiresAt,
      updated_at: nowIso,
    }, {
      onConflict: 'query_hash,provider,max_results',
    });

  if (error) {
    console.error('[WebSearch][Cache] Failed to save cache entry:', error);
  }
}

export async function purgeExpiredEntries(): Promise<number> {
  const nowIso = new Date().toISOString();
  const { count, error } = await supabase
    .from(TABLE_NAME)
    .delete({ count: 'exact' })
    .lt('expires_at', nowIso);

  if (error) {
    console.error('[WebSearch][Cache] Failed to purge expired cache entries:', error);
    return 0;
  }

  return count ?? 0;
}
