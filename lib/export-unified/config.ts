/**
 * Unified Export System Configuration
 * All settings for the unified export system
 * Phase 1: Foundation
 */

import type { UnifiedExportConfig } from './interfaces';

/**
 * Get environment variable with type conversion
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Unified export system configuration
 * Combines settings from old conversation and analytics export systems
 */
export const unifiedExportConfig: UnifiedExportConfig = {
  // ============================================================================
  // General Settings
  // ============================================================================

  enabled: getEnvBoolean('UNIFIED_EXPORT_ENABLED', true),
  defaultFormat: 'json',
  defaultExpirationHours: getEnvNumber('UNIFIED_EXPORT_EXPIRATION_HOURS', 168), // 7 days

  // ============================================================================
  // Limits
  // ============================================================================

  maxConversationsPerExport: getEnvNumber('UNIFIED_EXPORT_MAX_CONVERSATIONS', 100),
  maxMessagesPerConversation: getEnvNumber('UNIFIED_EXPORT_MAX_MESSAGES', 1000),
  maxAnalyticsDataPoints: getEnvNumber('UNIFIED_EXPORT_MAX_ANALYTICS_POINTS', 10000),
  maxTracesPerExport: getEnvNumber('UNIFIED_EXPORT_MAX_TRACES', 5000),
  maxFileSizeMB: getEnvNumber('UNIFIED_EXPORT_MAX_FILE_SIZE_MB', 100),
  maxExportsPerUser: getEnvNumber('UNIFIED_EXPORT_MAX_PER_USER', 50),

  // ============================================================================
  // Storage Settings
  // ============================================================================

  storagePath: getEnvString('UNIFIED_EXPORT_STORAGE_PATH', '/tmp/exports'),
  storageType: (getEnvString('UNIFIED_EXPORT_STORAGE_TYPE', 'filesystem') as 'filesystem' | 'supabase_storage' | 's3'),
  useSupabaseStorage: getEnvBoolean('UNIFIED_EXPORT_USE_SUPABASE_STORAGE', false),
  cleanupEnabled: getEnvBoolean('UNIFIED_EXPORT_CLEANUP_ENABLED', true),

  // ============================================================================
  // Performance Settings
  // ============================================================================

  enableAsyncProcessing: getEnvBoolean('UNIFIED_EXPORT_ASYNC_PROCESSING', true),
  asyncProcessingThresholdMB: getEnvNumber('UNIFIED_EXPORT_ASYNC_THRESHOLD_MB', 10),
  enableCaching: getEnvBoolean('UNIFIED_EXPORT_CACHING', false),
  cacheTTLMinutes: getEnvNumber('UNIFIED_EXPORT_CACHE_TTL_MINUTES', 30),
};

/**
 * Validate configuration
 */
export function validateUnifiedExportConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate limits
  if (unifiedExportConfig.maxConversationsPerExport < 1) {
    errors.push('maxConversationsPerExport must be at least 1');
  }

  if (unifiedExportConfig.maxMessagesPerConversation < 1) {
    errors.push('maxMessagesPerConversation must be at least 1');
  }

  if (unifiedExportConfig.maxAnalyticsDataPoints < 1) {
    errors.push('maxAnalyticsDataPoints must be at least 1');
  }

  if (unifiedExportConfig.maxTracesPerExport < 1) {
    errors.push('maxTracesPerExport must be at least 1');
  }

  if (unifiedExportConfig.maxFileSizeMB < 1) {
    errors.push('maxFileSizeMB must be at least 1');
  }

  if (unifiedExportConfig.maxExportsPerUser < 1) {
    errors.push('maxExportsPerUser must be at least 1');
  }

  // Validate expiration
  if (unifiedExportConfig.defaultExpirationHours < 1) {
    errors.push('defaultExpirationHours must be at least 1');
  }

  // Validate async threshold
  if (unifiedExportConfig.asyncProcessingThresholdMB < 1) {
    errors.push('asyncProcessingThresholdMB must be at least 1');
  }

  // Validate storage type
  const validStorageTypes = ['filesystem', 'supabase_storage', 's3'];
  if (!validStorageTypes.includes(unifiedExportConfig.storageType)) {
    errors.push(`Invalid storage type: ${unifiedExportConfig.storageType}. Must be one of: ${validStorageTypes.join(', ')}`);
  }

  // Validate cache TTL
  if (unifiedExportConfig.cacheTTLMinutes < 1) {
    errors.push('cacheTTLMinutes must be at least 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export format to MIME type mapping
 */
export const MIME_TYPES: Record<string, string> = {
  csv: 'text/csv',
  json: 'application/json',
  jsonl: 'application/x-ndjson',
  markdown: 'text/markdown',
  txt: 'text/plain',
  html: 'text/html',
  pdf: 'application/pdf',
};

/**
 * Export format to file extension mapping
 */
export const FILE_EXTENSIONS: Record<string, string> = {
  csv: 'csv',
  json: 'json',
  jsonl: 'jsonl',
  markdown: 'md',
  txt: 'txt',
  html: 'html',
  pdf: 'pdf',
};

/**
 * Default export options for backward compatibility
 */
export const DEFAULT_EXPORT_OPTIONS = {
  includeMetadata: true,
  includeSystemMessages: false,
  compressionFormat: 'none' as const,
  theme: 'light' as const,
};

/**
 * Configuration for different export types
 */
export const EXPORT_TYPE_CONFIG = {
  conversation: {
    supportedFormats: ['csv', 'json', 'jsonl', 'markdown', 'txt'] as const,
    defaultFormat: 'json' as const,
    requiresTemplate: false,
  },
  analytics: {
    supportedFormats: ['csv', 'json', 'html', 'pdf'] as const,
    defaultFormat: 'json' as const,
    requiresTemplate: false,
    templateFormats: ['html', 'pdf'] as const,
  },
  trace: {
    supportedFormats: ['csv', 'json'] as const,
    defaultFormat: 'csv' as const,
    requiresTemplate: false,
  },
  custom: {
    supportedFormats: ['csv', 'json', 'jsonl'] as const,
    defaultFormat: 'json' as const,
    requiresTemplate: false,
  },
};

/**
 * Analytics export sub-types
 */
export const ANALYTICS_EXPORT_SUBTYPES = [
  'overview',
  'timeseries',
  'complete',
  'model_comparison',
  'tool_usage',
  'quality_trends',
] as const;

/**
 * Template audiences
 */
export const TEMPLATE_AUDIENCES = [
  'executive',
  'engineering',
  'onboarding',
  'custom',
] as const;

/**
 * Export status transitions
 */
export const EXPORT_STATUS_TRANSITIONS = {
  pending: ['processing', 'failed'],
  processing: ['completed', 'failed'],
  completed: ['expired'],
  failed: [],
  expired: [],
} as const;

/**
 * Get supported formats for an export type
 */
export function getSupportedFormats(exportType: string): readonly string[] {
  const config = EXPORT_TYPE_CONFIG[exportType as keyof typeof EXPORT_TYPE_CONFIG];
  return config?.supportedFormats || [];
}

/**
 * Check if format is supported for export type
 */
export function isFormatSupported(exportType: string, format: string): boolean {
  const supportedFormats = getSupportedFormats(exportType);
  return supportedFormats.includes(format as never);
}

/**
 * Get default format for export type
 */
export function getDefaultFormat(exportType: string): string {
  const config = EXPORT_TYPE_CONFIG[exportType as keyof typeof EXPORT_TYPE_CONFIG];
  return config?.defaultFormat || 'json';
}

/**
 * Check if export type requires template
 */
export function requiresTemplate(exportType: string, format: string): boolean {
  const config = EXPORT_TYPE_CONFIG[exportType as keyof typeof EXPORT_TYPE_CONFIG];
  if (!config) return false;

  if ('templateFormats' in config) {
    return (config.templateFormats as readonly string[]).includes(format);
  }

  return config.requiresTemplate;
}

export default unifiedExportConfig;
