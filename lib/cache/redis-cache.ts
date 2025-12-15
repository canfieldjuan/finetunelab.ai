/**
 * Redis Cache Utility for API Response Caching
 *
 * Provides distributed caching with graceful fallback to in-memory cache
 * when Redis is unavailable.
 *
 * Features:
 * - Get/set with TTL
 * - JSON serialization/deserialization
 * - Graceful fallback when Redis unavailable
 * - Cache key generation with prefixes
 * - Cache invalidation by pattern
 * - Connection health monitoring
 *
 * Date: 2025-12-14
 */

import Redis from 'ioredis';
import { createRedisClient, isRedisConfigured, getRedisConnectionInfo } from '@/lib/training/redis-client';

// In-memory fallback cache
interface MemoryCacheEntry {
  data: string;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();

// Singleton Redis client
let redisClient: Redis | null = null;
let redisAvailable = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds

/**
 * Initialize or get Redis client
 */
function getRedisClient(): Redis | null {
  // Check if Redis caching is disabled via env
  if (process.env.DISABLE_REDIS_CACHE === 'true') {
    return null;
  }

  // Check if Redis is configured
  if (!isRedisConfigured()) {
    return null;
  }

  // Return existing client if available
  if (redisClient && redisAvailable) {
    return redisClient;
  }

  // Create new client
  try {
    redisClient = createRedisClient();

    // Set up event handlers
    redisClient.on('connect', () => {
      console.log('[RedisCache] Connected to', getRedisConnectionInfo());
      redisAvailable = true;
    });

    redisClient.on('error', (err) => {
      console.error('[RedisCache] Connection error:', err.message);
      redisAvailable = false;
    });

    redisClient.on('close', () => {
      console.log('[RedisCache] Connection closed');
      redisAvailable = false;
    });

    return redisClient;
  } catch (error) {
    console.error('[RedisCache] Failed to create client:', error);
    return null;
  }
}

/**
 * Check Redis health (with rate limiting)
 */
async function checkRedisHealth(): Promise<boolean> {
  const now = Date.now();

  // Rate limit health checks
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL_MS) {
    return redisAvailable;
  }

  lastHealthCheck = now;
  const client = getRedisClient();

  if (!client) {
    redisAvailable = false;
    return false;
  }

  try {
    await client.ping();
    redisAvailable = true;
    return true;
  } catch {
    redisAvailable = false;
    return false;
  }
}

/**
 * Generate a cache key with prefix
 */
export function generateCacheKey(
  prefix: string,
  identifier: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  let key = `${prefix}:${identifier}`;

  if (params) {
    const sortedParams = Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    if (sortedParams) {
      key += `:${sortedParams}`;
    }
  }

  return key;
}

/**
 * Get value from cache
 * Falls back to in-memory cache if Redis unavailable
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();

  // Try Redis first
  if (client && redisAvailable) {
    try {
      const value = await client.get(key);
      if (value) {
        console.log('[RedisCache] HIT:', key);
        return JSON.parse(value) as T;
      }
      console.log('[RedisCache] MISS:', key);
      return null;
    } catch (error) {
      console.error('[RedisCache] Get error:', error);
      // Fall through to memory cache
    }
  }

  // Fallback to memory cache
  const entry = memoryCache.get(key);
  if (entry) {
    if (Date.now() < entry.expiresAt) {
      console.log('[MemoryCache] HIT:', key);
      return JSON.parse(entry.data) as T;
    }
    // Expired
    memoryCache.delete(key);
  }

  console.log('[MemoryCache] MISS:', key);
  return null;
}

/**
 * Set value in cache with TTL
 * Falls back to in-memory cache if Redis unavailable
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlMs: number
): Promise<void> {
  const serialized = JSON.stringify(value);
  const client = getRedisClient();

  // Try Redis first
  if (client && redisAvailable) {
    try {
      // Redis PSETEX uses milliseconds
      await client.psetex(key, ttlMs, serialized);
      console.log('[RedisCache] SET:', key, 'TTL:', ttlMs, 'ms');
      return;
    } catch (error) {
      console.error('[RedisCache] Set error:', error);
      // Fall through to memory cache
    }
  }

  // Fallback to memory cache
  memoryCache.set(key, {
    data: serialized,
    expiresAt: Date.now() + ttlMs,
  });
  console.log('[MemoryCache] SET:', key, 'TTL:', ttlMs, 'ms');
}

/**
 * Delete a specific key from cache
 */
export async function cacheDelete(key: string): Promise<void> {
  const client = getRedisClient();

  // Delete from Redis
  if (client && redisAvailable) {
    try {
      await client.del(key);
      console.log('[RedisCache] DEL:', key);
    } catch (error) {
      console.error('[RedisCache] Delete error:', error);
    }
  }

  // Also delete from memory cache
  memoryCache.delete(key);
}

/**
 * Delete all keys matching a pattern
 * Pattern uses Redis glob-style: * matches any characters
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  let count = 0;
  const client = getRedisClient();

  // Delete from Redis using SCAN (safe for production)
  if (client && redisAvailable) {
    try {
      let cursor = '0';
      do {
        const [newCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;

        if (keys.length > 0) {
          await client.del(...keys);
          count += keys.length;
        }
      } while (cursor !== '0');

      console.log('[RedisCache] DEL pattern:', pattern, 'deleted:', count);
    } catch (error) {
      console.error('[RedisCache] Delete pattern error:', error);
    }
  }

  // Also clear matching keys from memory cache
  const memoryKeys = Array.from(memoryCache.keys());
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

  for (const key of memoryKeys) {
    if (regex.test(key)) {
      memoryCache.delete(key);
      count++;
    }
  }

  return count;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  redisAvailable: boolean;
  redisInfo: string;
  memoryCacheSize: number;
}> {
  await checkRedisHealth();

  return {
    redisAvailable,
    redisInfo: isRedisConfigured() ? getRedisConnectionInfo() : 'Not configured',
    memoryCacheSize: memoryCache.size,
  };
}

/**
 * Clear all caches (for testing/maintenance)
 */
export async function cacheClearAll(): Promise<void> {
  const client = getRedisClient();

  if (client && redisAvailable) {
    try {
      // Only clear keys with our prefix (safer than FLUSHDB)
      await cacheDeletePattern('api:*');
    } catch (error) {
      console.error('[RedisCache] Clear all error:', error);
    }
  }

  memoryCache.clear();
  console.log('[Cache] All caches cleared');
}

/**
 * Cleanup expired entries from memory cache
 * Call periodically to prevent memory leaks
 */
export function cleanupMemoryCache(): number {
  const now = Date.now();
  let cleaned = 0;

  const entries = Array.from(memoryCache.entries());
  for (const [key, entry] of entries) {
    if (now > entry.expiresAt) {
      memoryCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log('[MemoryCache] Cleaned', cleaned, 'expired entries');
  }

  return cleaned;
}

// Run cleanup every minute
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupMemoryCache, 60000);
}

// Export for testing
export { checkRedisHealth };
