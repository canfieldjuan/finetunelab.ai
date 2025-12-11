// LLM Configuration - Environment Variable Based
// Migrated from YAML to .env for consistency

export interface LLMConfig {
  provider: string;
  openai?: {
    api_key?: string;
    model: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
  };
  anthropic?: {
    api_key?: string;
    model: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
  };
  ollama?: {
    base_url?: string;
    model: string;
    temperature?: number;
    stream?: boolean;
  };
}

// Helper to get environment variable with fallback
function getEnv(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || '';
}

// Helper to get number from env with fallback
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Helper to get boolean from env
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

export function loadLLMConfig(): LLMConfig {
  const provider = getEnv('LLM_PROVIDER', 'openai');

  return {
    provider,
    openai: {
      api_key: getEnv('OPENAI_API_KEY'),
      model: getEnv('OPENAI_MODEL', 'gpt-4o-mini'),
      temperature: getEnvNumber('OPENAI_TEMPERATURE', 0.7),
      max_tokens: getEnvNumber('OPENAI_MAX_TOKENS', 2000),
      stream: getEnvBoolean('OPENAI_STREAM', true),
    },
    anthropic: {
      api_key: getEnv('ANTHROPIC_API_KEY'),
      model: getEnv('ANTHROPIC_MODEL', 'claude-3-5-sonnet-20241022'),
      temperature: getEnvNumber('ANTHROPIC_TEMPERATURE', 0.7),
      max_tokens: getEnvNumber('ANTHROPIC_MAX_TOKENS', 2000),
      stream: getEnvBoolean('ANTHROPIC_STREAM', true),
    },
    ollama: {
      base_url: getEnv('OLLAMA_BASE_URL', 'http://localhost:11434'),
      model: getEnv('OLLAMA_MODEL', 'llama3.1'),
      temperature: getEnvNumber('OLLAMA_TEMPERATURE', 0.7),
      stream: getEnvBoolean('OLLAMA_STREAM', true),
    },
  };
}
