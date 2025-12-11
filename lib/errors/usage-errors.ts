/**
 * Usage Limit Error Classes
 * Date: 2025-10-24
 */

import type { UsageLimitError } from '../usage/types';

/**
 * Error thrown when usage limit is exceeded
 */
export class UsageLimitExceededError extends Error {
  statusCode = 429; // Too Many Requests
  limitType: string;
  current: number;
  limit: number;
  percentage: number;
  upgradeUrl: string;

  constructor(
    limitType: string,
    current: number,
    limit: number,
    percentage: number
  ) {
    const message = `Usage limit exceeded for ${limitType}. Current: ${current}/${limit} (${percentage}%)`;
    super(message);

    this.name = 'UsageLimitExceededError';
    this.limitType = limitType;
    this.current = current;
    this.limit = limit;
    this.percentage = percentage;
    this.upgradeUrl = '/account';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UsageLimitExceededError);
    }
  }

  /**
   * Convert to API response format
   */
  toJSON(): UsageLimitError {
    return {
      error: 'Usage limit exceeded',
      code: 'USAGE_LIMIT_EXCEEDED',
      limitType: this.limitType,
      current: this.current,
      limit: this.limit,
      percentage: this.percentage,
      message: `You've exceeded your ${this.limitType} limit. Upgrade to continue.`,
      upgradeUrl: this.upgradeUrl,
    };
  }
}

/**
 * Helper function to create usage limit error response
 */
export function createUsageLimitResponse(
  limitType: string,
  current: number,
  limit: number,
  percentage: number
): UsageLimitError {
  return {
    error: 'Usage limit exceeded',
    code: 'USAGE_LIMIT_EXCEEDED',
    limitType,
    current,
    limit,
    percentage,
    message: `You've exceeded your ${limitType} limit (${current}/${limit}). Upgrade to continue.`,
    upgradeUrl: '/account',
  };
}
