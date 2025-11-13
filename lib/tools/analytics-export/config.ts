/**
 * Analytics Export Tool - Configuration
 * Phase 6: LLM Integration
 * Date: October 25, 2025
 */

export const analyticsExportConfig = {
  enabled: true,
  
  // Default export settings
  defaultFormat: 'csv' as const,
  defaultType: 'overview' as const,
  
  // File retention and limits
  maxExportsPerUser: 50,
  defaultRetentionDays: 7,
  maxFileSizeMB: 100,
  
  // Export type availability
  availableTypes: [
    'overview',
    'timeseries',
    'complete',
    'model_comparison',
    'tool_usage',
    'quality_trends',
  ] as const,
  
  // Format availability
  availableFormats: ['csv', 'json', 'report'] as const,
  
  // Date range validation
  maxDateRangeDays: 365,
  defaultDateRangeDays: 30,
  
  // Performance settings
  enableCache: true,
  cacheTTLMinutes: 15,
};

export type AnalyticsExportConfig = typeof analyticsExportConfig;
