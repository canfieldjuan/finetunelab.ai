/**
 * API Configuration
 * All settings via environment variables - ZERO hardcoded values
 */

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const apiConfig = {
  rateLimit: {
    /**
     * Maximum number of requests allowed per API key within the rate limit window
     * Default: 100 requests per minute
     */
    perKey: getEnvNumber('API_RATE_LIMIT_PER_KEY', 100),

    /**
     * Rate limit time window in milliseconds
     * Default: 60000 (1 minute)
     */
    windowMs: getEnvNumber('API_RATE_LIMIT_WINDOW_MS', 60 * 1000),
  },

  timeouts: {
    /**
     * Timeout for model operations (add, update, etc.) in milliseconds
     * Default: 30000 (30 seconds)
     */
    modelOperation: getEnvNumber('API_MODEL_OPERATION_TIMEOUT_MS', 30000),

    /**
     * Timeout for health check requests in milliseconds
     * Default: 5000 (5 seconds)
     */
    healthCheck: getEnvNumber('API_HEALTH_CHECK_TIMEOUT_MS', 5000),

    /**
     * Timeout for quick health check requests in milliseconds
     * Default: 3000 (3 seconds)
     */
    healthCheckQuick: getEnvNumber('API_HEALTH_CHECK_QUICK_TIMEOUT_MS', 3000),
  },
} as const;
