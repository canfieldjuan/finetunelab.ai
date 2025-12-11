// DateTime Tool - Configuration
// Phase 3.1: DateTime-specific configuration
// Date: October 10, 2025

import { datetimeConfig as globalConfig } from '../config';

/**
 * DateTime-specific configuration
 */
export const datetimeConfig = {
  ...globalConfig,
  
  // Output format options
  includeMilliseconds: process.env.DATETIME_INCLUDE_MS === 'true',
  includeTimezone: process.env.DATETIME_INCLUDE_TZ !== 'false', // Default: true
  
  // Locale settings
  locale: process.env.DATETIME_LOCALE || 'en-US',
  
  // Feature flags
  enableConversion: process.env.DATETIME_ENABLE_CONVERSION !== 'false',
  enableFormatting: process.env.DATETIME_ENABLE_FORMATTING !== 'false',
};

export type DateTimeConfig = typeof datetimeConfig;
