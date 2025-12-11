/**
 * Redis Client Factory
 *
 * Provides unified Redis connection handling that works with:
 * - Local Redis (development)
 * - Upstash Redis via TCP connection (Vercel/production)
 *
 * BullMQ requires ioredis, so we use Upstash's TCP connection
 * (not REST API) for compatibility.
 */

import Redis, { RedisOptions } from 'ioredis';

export interface RedisClientConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}

/**
 * Get Redis connection options from environment variables
 * Supports both UPSTASH_REDIS_URL format and individual host/port config
 */
export function getRedisConfig(overrides?: RedisClientConfig): RedisOptions {
  // Priority 1: Upstash Redis URL (production/Vercel)
  // Format: rediss://default:password@host:port
  const upstashUrl = process.env.UPSTASH_REDIS_URL;
  if (upstashUrl) {
    return {
      // ioredis can parse the URL directly
      ...parseRedisUrl(upstashUrl),
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
    };
  }

  // Priority 2: Standard REDIS_URL (e.g., redis://localhost:6379)
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return {
      ...parseRedisUrl(redisUrl),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  // Priority 3: Individual environment variables with overrides
  const host = overrides?.host || process.env.REDIS_HOST || 'localhost';
  const port = overrides?.port || parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = overrides?.password || process.env.REDIS_PASSWORD;
  const db = overrides?.db ?? (process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0);

  return {
    host,
    port,
    password,
    db,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

/**
 * Parse Redis URL into connection options
 */
function parseRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  const isTls = parsed.protocol === 'rediss:';

  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || (isTls ? '6380' : '6379'), 10),
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
    tls: isTls ? {} : undefined,
  };
}

/**
 * Create a new Redis client instance
 */
export function createRedisClient(overrides?: RedisClientConfig): Redis {
  const config = getRedisConfig(overrides);
  return new Redis(config);
}

/**
 * Check if running with Upstash Redis
 */
export function isUpstashRedis(): boolean {
  return !!(process.env.UPSTASH_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL);
}

/**
 * Check if Redis is available (for conditional features)
 */
export function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_URL ||
    process.env.REDIS_URL ||
    process.env.REDIS_HOST
  );
}

/**
 * Get Redis connection info for logging (safe, no passwords)
 */
export function getRedisConnectionInfo(): string {
  if (process.env.UPSTASH_REDIS_URL) {
    const parsed = new URL(process.env.UPSTASH_REDIS_URL);
    return `Upstash Redis at ${parsed.hostname}:${parsed.port}`;
  }
  if (process.env.REDIS_URL) {
    const parsed = new URL(process.env.REDIS_URL);
    return `Redis at ${parsed.hostname}:${parsed.port}`;
  }
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || '6379';
  return `Redis at ${host}:${port}`;
}
