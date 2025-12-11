// Intelligent Email Tool - Configuration
// Phase 1.1: Email tool configuration
// Date: October 24, 2025

export interface EmailConfig {
  enabled: boolean;
  provider: 'resend';
  apiKey?: string;
  defaultFrom?: string;
  timeout: number;
  maxRecipients: number;
}

/**
 * Email tool configuration
 * Loads from environment variables with safe defaults
 */
export const emailConfig: EmailConfig = {
  enabled: process.env.EMAIL_TOOL_ENABLED !== 'false',
  provider: 'resend',
  apiKey: process.env.RESEND_API_KEY,
  defaultFrom: process.env.EMAIL_DEFAULT_FROM,
  timeout: parseInt(process.env.EMAIL_TIMEOUT || '10000'),
  maxRecipients: parseInt(process.env.EMAIL_MAX_RECIPIENTS || '50'),
};

console.log('[EmailConfig] Initialized:', {
  enabled: emailConfig.enabled,
  provider: emailConfig.provider,
  hasApiKey: !!emailConfig.apiKey,
  defaultFrom: emailConfig.defaultFrom || 'not set',
  timeout: emailConfig.timeout,
  maxRecipients: emailConfig.maxRecipients,
});
