/**
 * Redis-based Rate Limiter
 * Implements sliding window rate limiting for analytics tools
 * Date: 2026-01-02
 * Phase 2: Rate Limiting
 *
 * Usage:
 *   import { checkRateLimit } from '@/lib/rate-limiting/rate-limiter';
 *
 *   const result = await checkRateLimit({
 *     userId: 'user-123',
 *     action: 'evaluate_messages',
 *     limit: 10,
 *     windowMs: 60000, // 1 minute
 *   });
 *
 *   if (!result.allowed) {
 *     throw new Error(`Rate limit exceeded. Try again in ${result.retryAfterMs}ms`);
 *   }
 */

import { createRedisClient, isRedisConfigured } from '@/lib/training/redis-client';
import type { RateLimitConfig, RateLimitResult } from './types';

/**
 * Check if a request is allowed under rate limiting rules
 * Uses Redis sliding window algorithm for accurate rate limiting
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const {
    userId,
    action,
    limit,
    windowMs,
  } = config;

  // If Redis is not configured, allow request (graceful degradation)
  if (!isRedisConfigured()) {
    console.warn('[RateLimiter] Redis not configured, rate limiting disabled');
    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(Date.now() + windowMs),
      retryAfterMs: 0,
    };
  }

  const key = `ratelimit:${action}:${userId}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  let redis;
  try {
    redis = createRedisClient();

    // Sliding window algorithm using sorted sets
    // 1. Remove old entries outside the window
    await redis.zremrangebyscore(key, '-inf', windowStart);

    // 2. Count requests in current window
    const count = await redis.zcard(key);

    // 3. Check if limit exceeded
    if (count >= limit) {
      // Get oldest request timestamp to calculate retry time
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTimestamp = oldest.length > 0 ? parseInt(oldest[1], 10) : now;
      const retryAfterMs = Math.max(0, (oldestTimestamp + windowMs) - now);

      await redis.quit();

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(oldestTimestamp + windowMs),
        retryAfterMs,
      };
    }

    // 4. Add current request to window
    await redis.zadd(key, now, `${now}-${Math.random()}`);

    // 5. Set expiry on key (cleanup)
    await redis.expire(key, Math.ceil(windowMs / 1000) + 10);

    const remaining = limit - count - 1;
    const resetAt = new Date(now + windowMs);

    await redis.quit();

    return {
      allowed: true,
      remaining,
      resetAt,
      retryAfterMs: 0,
    };

  } catch (error) {
    console.error('[RateLimiter] Error checking rate limit:', error);

    // On error, allow request (fail open for availability)
    if (redis) {
      try {
        await redis.quit();
      } catch (_e) {
        // Ignore quit errors
      }
    }

    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(Date.now() + windowMs),
      retryAfterMs: 0,
    };
  }
}

/**
 * Get rate limit status without incrementing the counter
 * Useful for checking limits before expensive operations
 */
export async function getRateLimitStatus(
  userId: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  // If Redis is not configured, return allowed status
  if (!isRedisConfigured()) {
    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(Date.now() + windowMs),
      retryAfterMs: 0,
    };
  }

  const key = `ratelimit:${action}:${userId}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  let redis;
  try {
    redis = createRedisClient();

    // Remove old entries
    await redis.zremrangebyscore(key, '-inf', windowStart);

    // Count current requests
    const count = await redis.zcard(key);

    await redis.quit();

    const allowed = count < limit;
    const remaining = Math.max(0, limit - count);

    if (!allowed) {
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTimestamp = oldest.length > 0 ? parseInt(oldest[1], 10) : now;
      const retryAfterMs = Math.max(0, (oldestTimestamp + windowMs) - now);

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(oldestTimestamp + windowMs),
        retryAfterMs,
      };
    }

    return {
      allowed: true,
      remaining,
      resetAt: new Date(now + windowMs),
      retryAfterMs: 0,
    };

  } catch (error) {
    console.error('[RateLimiter] Error getting rate limit status:', error);

    if (redis) {
      try {
        await redis.quit();
      } catch (_e) {
        // Ignore quit errors
      }
    }

    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(Date.now() + windowMs),
      retryAfterMs: 0,
    };
  }
}

/**
 * Reset rate limit for a user/action
 * Useful for testing or manual overrides
 */
export async function resetRateLimit(userId: string, action: string): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  const key = `ratelimit:${action}:${userId}`;

  let redis;
  try {
    redis = createRedisClient();
    await redis.del(key);
    await redis.quit();
  } catch (error) {
    console.error('[RateLimiter] Error resetting rate limit:', error);
    if (redis) {
      try {
        await redis.quit();
      } catch (_e) {
        // Ignore quit errors
      }
    }
  }
}
