/**
 * Agent Configuration
 * All settings via environment variables - ZERO hardcoded values
 *
 * Usage:
 *   import { agentConfig } from '@/lib/config/agent';
 *   const timeout = agentConfig.healthCheck.timeout;
 */

// Environment Variable Helpers
const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const getEnvString = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

// Agent Connection Configuration
export const agentConfig = {
  // Server URL and connectivity
  server: {
    url: getEnvString('NEXT_PUBLIC_TRAINING_SERVER_URL', 'http://localhost:8000'),
    host: getEnvString('NEXT_PUBLIC_AGENT_HOST', '0.0.0.0'),
    port: getEnvNumber('NEXT_PUBLIC_AGENT_PORT', 8000),
    module: getEnvString('AGENT_SERVER_MODULE', 'training_server:app'),
  },

  // Health check configuration
  healthCheck: {
    endpoint: getEnvString('NEXT_PUBLIC_AGENT_HEALTH_ENDPOINT', '/health'),
    timeout: getEnvNumber('NEXT_PUBLIC_AGENT_HEALTH_TIMEOUT_MS', 5000),
    pollInterval: getEnvNumber('NEXT_PUBLIC_AGENT_POLL_INTERVAL_MS', 30000),
    expectedService: getEnvString('AGENT_EXPECTED_SERVICE_NAME', 'FineTune Lab Training API'),
  },

  // Paths and directories
  paths: {
    projectRoot: getEnvString('AGENT_PROJECT_ROOT', '/path/to/web-ui'),
    trainingDir: getEnvString('AGENT_TRAINING_DIR', 'lib/training'),
    venvPath: getEnvString('AGENT_VENV_PATH', './trainer_venv/bin/uvicorn'),
  },

  // API endpoints
  endpoints: {
    filesystemModels: getEnvString('AGENT_FILESYSTEM_MODELS_ENDPOINT', '/api/filesystem/models'),
  },

  // UI configuration
  ui: {
    copyFeedbackDuration: getEnvNumber('AGENT_COPY_FEEDBACK_DURATION_MS', 2000),
  },

  // CLI commands
  cli: {
    startCommand: getEnvString('AGENT_CLI_START_COMMAND', 'ftl start'),
  },

  // Logging configuration
  logging: {
    logPath: getEnvString('AGENT_LOG_PATH', '/tmp/training_server*.log'),
  },
} as const;

// Configuration Export
export default agentConfig;
