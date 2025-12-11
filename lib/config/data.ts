/**
 * Data Configuration
 * All settings via environment variables - ZERO hardcoded values
 */

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const dataConfig = {
  fileSizeLimits: {
    /**
     * Maximum file size for filesystem write operations in bytes
     * Default: 10485760 (10 MB)
     */
    maxWriteSizeBytes: getEnvNumber('FILESYSTEM_MAX_WRITE_SIZE_BYTES', 10 * 1024 * 1024),
  },
} as const;
