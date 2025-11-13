/**
 * Application Configuration
 * All settings via environment variables - ZERO hardcoded values
 *
 * Usage:
 *   import { appConfig } from '@/lib/config/app';
 *   if (appConfig.debug.logging) { console.log(...); }
 */

// Environment Variable Helpers
const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

// Debug Configuration
export const debugConfig = {
  logging: getEnvBoolean('DEBUG_LOGGING', false),
  auth: getEnvBoolean('DEBUG_AUTH', false),
  api: getEnvBoolean('DEBUG_API', false),
} as const;

// Application Configuration
export const appConfig = {
  debug: debugConfig,
  environment: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;

// Configuration Export
export default appConfig;
