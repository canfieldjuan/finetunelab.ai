/**
 * DAG Cache Manager
 *
 * Content-addressable caching system for DAG job outputs
 * Cache key = hash(job_type + input_data + config + code_version)
 *
 * Phase: Phase 2 - Node Caching & Isolation
 * Date: 2025-10-28
 */

import crypto from 'crypto';
import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import type { JobConfig } from '../training/dag-orchestrator';

// ============================================================================
// Types
// ============================================================================

export interface CacheKey {
  jobType: string;
  inputHash: string;
  configHash: string;
  codeVersion: string;
}

export interface CacheEntry {
  id: string;
  cacheKey: string;
  jobType: string;
  executionId: string;
  jobId: string;
  output: unknown;
  artifactIds: string[];
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  cacheSize: number;
}

// ============================================================================
// Cache Key Computation
// ============================================================================

export class CacheKeyComputer {
  /**
   * Compute deterministic hash of a value
   */
  static computeHash(value: unknown): string {
    const normalized = JSON.stringify(value, Object.keys(value as object).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Compute cache key for a job
   */
  static computeCacheKey(
    jobConfig: JobConfig,
    dependencyOutputs: Record<string, unknown>,
    codeVersion: string = 'v1.0.0'
  ): CacheKey {
    console.log('[CacheKey] Computing cache key for job:', jobConfig.id);

    const inputHash = this.computeHash(dependencyOutputs);
    const configHash = this.computeHash(jobConfig.config);

    console.log('[CacheKey] Hashes computed:', {
      jobType: jobConfig.type,
      inputHash: inputHash.substring(0, 16) + '...',
      configHash: configHash.substring(0, 16) + '...',
      codeVersion,
    });

    return {
      jobType: jobConfig.type,
      inputHash,
      configHash,
      codeVersion,
    };
  }

  /**
   * Convert cache key to string for database storage
   */
  static cacheKeyToString(key: CacheKey): string {
    return `${key.jobType}:${key.inputHash}:${key.configHash}:${key.codeVersion}`;
  }
}

// ============================================================================
// Cache Manager
// ============================================================================

export class CacheManager {
  private supabase: SupabaseClient;
  private enabled: boolean;

  constructor(supabaseUrl?: string, supabaseKey?: string, enabled: boolean = true) {
    this.supabase = createClient();
    this.enabled = enabled;

    console.log('[CacheManager] Initialized. Caching enabled:', this.enabled);
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable caching
   */
  enable(): void {
    console.log('[CacheManager] Enabling cache');
    this.enabled = true;
  }

  /**
   * Disable caching
   */
  disable(): void {
    console.log('[CacheManager] Disabling cache');
    this.enabled = false;
  }

  /**
   * Get cached entry for a cache key
   */
  async get(cacheKey: CacheKey): Promise<CacheEntry | null> {
    if (!this.enabled) {
      console.log('[CacheManager] Cache disabled, returning null');
      return null;
    }

    const keyString = CacheKeyComputer.cacheKeyToString(cacheKey);
    console.log('[CacheManager] Cache lookup:', keyString.substring(0, 50) + '...');

    const { data, error } = await this.supabase
      .from('dag_cache')
      .select('*')
      .eq('cache_key', keyString)
      .single();

    if (error || !data) {
      console.log('[CacheManager] Cache MISS');
      return null;
    }

    console.log('[CacheManager] Cache HIT. Entry ID:', data.id);

    await this.updateAccessStats(data.id);

    return {
      id: data.id,
      cacheKey: data.cache_key,
      jobType: data.job_type,
      executionId: data.execution_id,
      jobId: data.job_id,
      output: data.output,
      artifactIds: data.artifact_ids || [],
      createdAt: new Date(data.created_at),
      lastAccessedAt: new Date(data.last_accessed_at),
      accessCount: data.access_count,
    };
  }

  /**
   * Update cache access statistics
   */
  private async updateAccessStats(cacheId: string): Promise<void> {
    await this.supabase
      .from('dag_cache')
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: this.supabase.rpc('increment_access_count', { cache_id: cacheId }),
      })
      .eq('id', cacheId);
  }

  /**
   * Store entry in cache
   */
  async set(
    cacheKey: CacheKey,
    executionId: string,
    jobId: string,
    output: unknown,
    artifactIds: string[] = []
  ): Promise<CacheEntry> {
    if (!this.enabled) {
      console.log('[CacheManager] Cache disabled, skipping storage');
      throw new Error('Cache is disabled');
    }

    const keyString = CacheKeyComputer.cacheKeyToString(cacheKey);
    console.log('[CacheManager] Storing cache entry:', keyString.substring(0, 50) + '...');

    const { data, error } = await this.supabase
      .from('dag_cache')
      .insert({
        cache_key: keyString,
        job_type: cacheKey.jobType,
        execution_id: executionId,
        job_id: jobId,
        output,
        artifact_ids: artifactIds,
        access_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('[CacheManager] Failed to store cache entry:', error);
      throw new Error(`Cache storage failed: ${error.message}`);
    }

    console.log('[CacheManager] Cache entry stored. ID:', data.id);

    return {
      id: data.id,
      cacheKey: data.cache_key,
      jobType: data.job_type,
      executionId: data.execution_id,
      jobId: data.job_id,
      output: data.output,
      artifactIds: data.artifact_ids || [],
      createdAt: new Date(data.created_at),
      lastAccessedAt: new Date(data.last_accessed_at),
      accessCount: data.access_count,
    };
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  async invalidate(pattern: string): Promise<number> {
    console.log('[CacheManager] Invalidating cache entries matching:', pattern);

    const { data, error } = await this.supabase
      .from('dag_cache')
      .delete()
      .like('cache_key', `%${pattern}%`)
      .select('id');

    if (error) {
      console.error('[CacheManager] Invalidation error:', error);
      throw new Error(`Cache invalidation failed: ${error.message}`);
    }

    const count = data?.length || 0;
    console.log('[CacheManager] Invalidated', count, 'cache entries');

    return count;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const { count: totalEntries, error: countError } = await this.supabase
      .from('dag_cache')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to get cache stats: ${countError.message}`);
    }

    return {
      totalEntries: totalEntries || 0,
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      cacheSize: 0,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let cacheInstance: CacheManager | null = null;

export function getCacheManager(): CacheManager {
  if (!cacheInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for CacheManager');
    }

    cacheInstance = new CacheManager(supabaseUrl, supabaseKey);
  }

  return cacheInstance;
}

export default CacheManager;

