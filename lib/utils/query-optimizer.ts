/**
 * Query Optimizer Utilities
 *
 * Provides performance optimization utilities for database queries including:
 * - Pagination helpers
 * - Query result caching
 * - Performance monitoring
 * - Batch query optimization
 *
 * Phase 4 Task 4.1: Performance Optimization
 * Date: 2025-10-25
 */

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface QueryPerformanceMetrics {
  queryName: string;
  duration: number;
  resultCount: number;
  cached: boolean;
  timestamp: Date;
}

// Default pagination settings
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 1000;

/**
 * Calculate pagination range for Supabase queries
 */
export function calculatePaginationRange(
  page: number,
  pageSize: number
): { from: number; to: number } {
  console.log('[QueryOptimizer] Calculating pagination range:', { page, pageSize });

  const validatedPageSize = Math.min(pageSize, MAX_PAGE_SIZE);
  const from = (page - 1) * validatedPageSize;
  const to = from + validatedPageSize - 1;

  return { from, to };
}

/**
 * Build paginated result from Supabase query
 */
export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PaginationResult<T> {
  console.log('[QueryOptimizer] Building paginated result:', {
    dataLength: data.length,
    total,
    page,
    pageSize
  });

  const validatedPageSize = Math.min(pageSize, MAX_PAGE_SIZE);
  const totalPages = Math.ceil(total / validatedPageSize);

  return {
    data,
    total,
    page,
    pageSize: validatedPageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

/**
 * Track query performance for monitoring
 */
export function trackQueryPerformance(
  queryName: string,
  startTime: number,
  resultCount: number,
  cached: boolean = false
): QueryPerformanceMetrics {
  const duration = performance.now() - startTime;

  const metrics: QueryPerformanceMetrics = {
    queryName,
    duration,
    resultCount,
    cached,
    timestamp: new Date()
  };

  console.log('[QueryOptimizer] Performance:', metrics);

  if (duration > 1000) {
    console.warn('[QueryOptimizer] Slow query detected:', queryName, `${duration.toFixed(2)}ms`);
  }

  return metrics;
}

// Simple in-memory cache
const queryCache = new Map<string, { data: unknown; expiry: number }>();

export interface CacheOptions {
  ttl: number; // Time to live in milliseconds
}

/**
 * Generate cache key from query parameters
 */
export function generateCacheKey(
  queryName: string,
  params: Record<string, unknown>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');

  return `${queryName}:${sortedParams}`;
}

/**
 * Get cached query result
 */
export function getCachedResult<T>(cacheKey: string): T | null {
  const cached = queryCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expiry) {
    console.log('[QueryOptimizer] Cache expired for:', cacheKey);
    queryCache.delete(cacheKey);
    return null;
  }

  console.log('[QueryOptimizer] Cache hit for:', cacheKey);
  return cached.data as T;
}

/**
 * Cache query result
 */
export function cacheResult<T>(
  cacheKey: string,
  data: T,
  options: CacheOptions = { ttl: 300000 } // Default 5 minutes
): void {
  console.log('[QueryOptimizer] Caching result for:', cacheKey, 'TTL:', options.ttl);

  queryCache.set(cacheKey, {
    data,
    expiry: Date.now() + options.ttl
  });
}

/**
 * Clear cached results matching pattern
 */
export function clearCachePattern(pattern: string): number {
  console.log('[QueryOptimizer] Clearing cache pattern:', pattern);

  let cleared = 0;
  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key);
      cleared++;
    }
  }

  console.log('[QueryOptimizer] Cleared', cleared, 'cache entries');
  return cleared;
}

/**
 * Batch process array in chunks to avoid overwhelming database
 */
export function chunkArray<T>(array: T[], chunkSize: number = 100): T[][] {
  console.log('[QueryOptimizer] Chunking array of', array.length, 'items into chunks of', chunkSize);

  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }

  return chunks;
}

/**
 * Execute function with automatic retry on failure
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log('[QueryOptimizer] Attempt', attempt, 'of', maxRetries);
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn('[QueryOptimizer] Attempt', attempt, 'failed:', lastError.message);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError;
}
