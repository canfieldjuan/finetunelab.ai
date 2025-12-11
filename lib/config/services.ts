/**
 * Services Configuration
 * All settings via environment variables - ZERO hardcoded values
 */

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const getEnvString = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

export const servicesConfig = {
  ollama: {
    /**
     * Ollama server port
     * Default: 11434
     */
    port: getEnvNumber('OLLAMA_PORT', 11434),

    /**
     * Ollama server host
     * Default: localhost
     */
    host: getEnvString('OLLAMA_HOST', 'localhost'),
  },

  redis: {
    /**
     * Redis server port for distributed job queue and state store
     * Default: 6379
     */
    port: getEnvNumber('REDIS_PORT', 6379),

    /**
     * Redis server host
     * Default: localhost
     */
    host: getEnvString('REDIS_HOST', 'localhost'),

    /**
     * Full Redis URL (takes priority over host/port)
     * Format: redis://[user:password@]host:port[/db]
     * For Upstash: rediss://default:token@host:port
     */
    url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || '',

    /**
     * Whether using Upstash Redis (auto-detected)
     */
    isUpstash: !!(process.env.UPSTASH_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL),
  },

  training: {
    /**
     * Training server base URL
     * Used across multiple components for API calls
     * Default: http://localhost:8000
     */
    serverUrl: getEnvString('TRAINING_SERVER_URL', 'http://localhost:8000'),
  },
} as const;
