/**
 * Rate Limiting Type Definitions
 * Date: 2026-01-02
 * Phase 2: Rate Limiting
 */

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** User ID to rate limit */
  userId: string;

  /** Action being rate limited (e.g., 'evaluate_messages', 'web_search') */
  action: string;

  /** Maximum number of requests allowed in the window */
  limit: number;

  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;

  /** Number of requests remaining in current window */
  remaining: number;

  /** When the rate limit window resets */
  resetAt: Date;

  /** Milliseconds until the client can retry (0 if allowed) */
  retryAfterMs: number;
}

/**
 * Predefined rate limit configurations for different actions
 */
export const RATE_LIMITS = {
  // LLM-as-judge evaluation (most expensive operation)
  EVALUATE_MESSAGES: {
    limit: 50,        // 50 evaluations per hour
    windowMs: 3600000, // 1 hour
  },

  // Web search (external API calls)
  WEB_SEARCH: {
    limit: 100,        // 100 searches per hour
    windowMs: 3600000, // 1 hour
  },

  // Analytics chat general (prevent abuse)
  ANALYTICS_CHAT: {
    limit: 200,        // 200 messages per hour
    windowMs: 3600000, // 1 hour
  },

  // Tool execution general
  TOOL_EXECUTION: {
    limit: 500,        // 500 tool calls per hour
    windowMs: 3600000, // 1 hour
  },
} as const;

/**
 * Rate limit action types
 */
export type RateLimitAction = keyof typeof RATE_LIMITS;
