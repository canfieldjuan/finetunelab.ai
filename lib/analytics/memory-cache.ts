/**
 * Simple In-Memory Cache with TTL
 *
 * Used for caching analytics data to reduce database load under concurrent requests.
 * This cache is per-process (not shared across instances) and cleared on restart.
 *
 * Date: 2025-12-14
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0 };
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly defaultTtlMs: number;
  private readonly maxSize: number;

  constructor(defaultTtlMs = 60000, maxSize = 1000) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxSize = maxSize;

    // Run cleanup every minute to remove expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get a value from the cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Set a value in the cache with optional TTL
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttlMs ?? this.defaultTtlMs);

    // Evict oldest entries if at max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      expiresAt,
      createdAt: now,
    });

    this.stats.size = this.cache.size;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * Clear all entries matching a prefix
   */
  clearByPrefix(prefix: string): number {
    let count = 0;
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: string } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) : '0';
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.size = this.cache.size;
      console.log(`[MemoryCache] Cleaned ${cleaned} expired entries, ${this.cache.size} remaining`);
    }
  }

  /**
   * Evict oldest entries when at capacity
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log('[MemoryCache] Evicted oldest entry due to capacity');
    }
  }

  /**
   * Shutdown the cache (clear interval)
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton instance with 5-minute default TTL for analytics
// Analytics data doesn't change frequently, so longer TTL is appropriate
const analyticsCache = new MemoryCache(
  parseInt(process.env.ANALYTICS_CACHE_TTL_MS || '300000', 10), // 5 minutes default
  parseInt(process.env.ANALYTICS_CACHE_MAX_SIZE || '500', 10)   // 500 entries max
);

/**
 * Generate a cache key for analytics data
 */
export function generateAnalyticsCacheKey(
  userId: string,
  endpoint: string,
  params: Record<string, string | number | boolean | undefined>
): string {
  const sortedParams = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  return `analytics:${userId}:${endpoint}:${sortedParams}`;
}

/**
 * Get the singleton analytics cache instance
 */
export function getAnalyticsCache(): MemoryCache {
  return analyticsCache;
}

export default MemoryCache;
