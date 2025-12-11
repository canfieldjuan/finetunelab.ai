// Dataset Manager Tool - Configuration
// Date: October 13, 2025

export const datasetConfig = {
  enabled: true,
  maxExportSize: 10000,
  defaultFormat: 'jsonl' as const,
  cacheTimeout: 300000,
  minRatingThreshold: 1,
  maxRatingThreshold: 5,
};
