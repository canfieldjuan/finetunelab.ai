/**
 * Guardrails Configuration
 * All settings via environment variables - ZERO hardcoded values
 */

import type { GuardrailsConfig, PIIType, ContentModerationCategories } from './types';

// ============================================================================
// Environment Variable Helpers
// ============================================================================

const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const getEnvString = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

const getEnvArray = <T extends string>(key: string, defaultValue: T[]): T[] => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.split(',').map(s => s.trim()) as T[];
};

// ============================================================================
// Default Categories to Block
// ============================================================================

const DEFAULT_BLOCK_CATEGORIES: (keyof ContentModerationCategories)[] = [
  'hate',
  'hate/threatening',
  'harassment/threatening',
  'self-harm/intent',
  'self-harm/instructions',
  'sexual/minors',
  'violence/graphic',
];

// ============================================================================
// Default PII Types to Redact
// ============================================================================

const DEFAULT_PII_TYPES: PIIType[] = [
  'ssn',
  'credit_card',
  'api_key',
  'password',
];

// ============================================================================
// Configuration Object
// ============================================================================

export const guardrailsConfig: GuardrailsConfig = {
  enabled: getEnvBoolean('GUARDRAILS_ENABLED', true),

  promptInjection: {
    enabled: getEnvBoolean('GUARDRAILS_PROMPT_INJECTION_ENABLED', true),
    usePatternDetection: getEnvBoolean('GUARDRAILS_USE_PATTERN_DETECTION', true),
    useLLMDetection: getEnvBoolean('GUARDRAILS_USE_LLM_DETECTION', false),
    blockOnDetection: getEnvBoolean('GUARDRAILS_BLOCK_ON_INJECTION', true),
    confidenceThreshold: getEnvNumber('GUARDRAILS_INJECTION_THRESHOLD', 0.7),
  },

  contentModeration: {
    enabled: getEnvBoolean('GUARDRAILS_CONTENT_MODERATION_ENABLED', true),
    provider: getEnvString('GUARDRAILS_MODERATION_PROVIDER', 'auto') as 'openai' | 'pattern' | 'auto',
    blockCategories: getEnvArray('GUARDRAILS_BLOCK_CATEGORIES', DEFAULT_BLOCK_CATEGORIES),
    scoreThreshold: getEnvNumber('GUARDRAILS_MODERATION_THRESHOLD', 0.7),
  },

  piiRedaction: {
    enabled: getEnvBoolean('GUARDRAILS_PII_REDACTION_ENABLED', true),
    redactInLogs: getEnvBoolean('GUARDRAILS_REDACT_PII_IN_LOGS', true),
    redactInResponses: getEnvBoolean('GUARDRAILS_REDACT_PII_IN_RESPONSES', false),
    typesToRedact: getEnvArray('GUARDRAILS_PII_TYPES', DEFAULT_PII_TYPES),
  },

  blocking: {
    blockOnViolation: getEnvBoolean('GUARDRAILS_BLOCK_ON_VIOLATION', true),
    blockMessage: getEnvString(
      'GUARDRAILS_BLOCK_MESSAGE',
      'Your request was blocked due to a policy violation. Please rephrase your message.'
    ),
    allowBypass: getEnvBoolean('GUARDRAILS_ALLOW_BYPASS', false),
    bypassRoles: getEnvArray('GUARDRAILS_BYPASS_ROLES', []),
  },

  logging: {
    logViolations: getEnvBoolean('GUARDRAILS_LOG_VIOLATIONS', true),
    logAllChecks: getEnvBoolean('GUARDRAILS_LOG_ALL_CHECKS', false),
    redactSensitiveData: getEnvBoolean('GUARDRAILS_REDACT_LOGS', true),
  },

  // Severity thresholds for violation classification
  severityThresholds: {
    critical: getEnvNumber('GUARDRAILS_SEVERITY_CRITICAL', 0.9),
    high: getEnvNumber('GUARDRAILS_SEVERITY_HIGH', 0.7),
  },
};

// ============================================================================
// Configuration Validation
// ============================================================================

export function validateGuardrailsConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate thresholds
  if (guardrailsConfig.promptInjection.confidenceThreshold < 0 ||
      guardrailsConfig.promptInjection.confidenceThreshold > 1) {
    errors.push('GUARDRAILS_INJECTION_THRESHOLD must be between 0 and 1');
  }

  if (guardrailsConfig.contentModeration.scoreThreshold < 0 ||
      guardrailsConfig.contentModeration.scoreThreshold > 1) {
    errors.push('GUARDRAILS_MODERATION_THRESHOLD must be between 0 and 1');
  }

  // Validate provider
  const validProviders = ['openai', 'pattern', 'auto'];
  if (!validProviders.includes(guardrailsConfig.contentModeration.provider)) {
    errors.push(`GUARDRAILS_MODERATION_PROVIDER must be one of: ${validProviders.join(', ')}`);
  }

  // Check OpenAI API key if using OpenAI moderation
  if (guardrailsConfig.contentModeration.enabled &&
      (guardrailsConfig.contentModeration.provider === 'openai' ||
       guardrailsConfig.contentModeration.provider === 'auto')) {
    const apiKey = process.env.OPENAI_MODERATION_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      errors.push('OpenAI API key required for content moderation (OPENAI_API_KEY or OPENAI_MODERATION_API_KEY)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Export
// ============================================================================

export default guardrailsConfig;
