/**
 * Data Retention Configuration
 *
 * Central configuration for data retention policies.
 * Phase 4.2: Data Retention Policy
 * Date: 2025-12-16
 */

export const RETENTION_PERIODS = {
  // LLM traces - 90 days (balance between debugging and storage)
  LLM_TRACES: 90,

  // Anomaly detections - 90 days after resolution
  ANOMALY_DETECTIONS: 90,

  // A/B test assignments - 180 days after experiment completion
  AB_EXPERIMENT_ASSIGNMENTS: 180,

  // Cohort snapshots - 365 days for year-over-year analysis
  USER_COHORT_SNAPSHOTS: 365,

  // Analytics cache - 7 days (ephemeral data)
  ANALYTICS_METRICS_CACHE: 7,
} as const;

export const RETENTION_DESCRIPTIONS = {
  llm_traces: 'LLM request traces for debugging and performance analysis',
  anomaly_detections: 'Resolved anomaly alerts and detection history',
  ab_experiment_assignments: 'A/B test user assignments for completed experiments',
  user_cohort_snapshots: 'Historical cohort metrics for trend analysis',
  analytics_metrics_cache: 'Temporary metrics cache with TTL expiration',
} as const;

/**
 * Cleanup schedule configuration
 * Determines how often automated cleanup runs
 */
export const CLEANUP_SCHEDULE = {
  // Run daily at 2 AM UTC
  CRON_EXPRESSION: '0 2 * * *',

  // Maximum execution time (5 minutes)
  TIMEOUT_MS: 300000,

  // Enable automatic cleanup (set to false for manual-only mode)
  AUTO_CLEANUP_ENABLED: true,

  // Batch size for deletes (prevent long-running transactions)
  DELETE_BATCH_SIZE: 1000,
} as const;

/**
 * Alert thresholds for retention monitoring
 */
export const RETENTION_ALERTS = {
  // Warn if cleanup hasn't run in X days
  MAX_DAYS_SINCE_CLEANUP: 3,

  // Warn if table has data older than retention + buffer
  RETENTION_BUFFER_DAYS: 7,

  // Warn if cleanup deletes unusually large amount
  UNUSUAL_DELETION_THRESHOLD: 100000,

  // Minimum rows to trigger storage warning
  MIN_ROWS_FOR_WARNING: 1000000,
} as const;

/**
 * Storage cost estimates (approximate)
 */
export const STORAGE_COST_ESTIMATES = {
  // Average bytes per row for each table type
  BYTES_PER_ROW: {
    llm_traces: 2048, // ~2KB (includes JSON payloads)
    anomaly_detections: 512, // ~512B
    ab_experiment_assignments: 256, // ~256B
    user_cohort_snapshots: 1024, // ~1KB
    analytics_metrics_cache: 512, // ~512B
  },

  // Cost per GB per month (approximate for Supabase/Postgres)
  COST_PER_GB_MONTH: 0.125,
} as const;

/**
 * Calculate estimated monthly storage cost
 */
export function estimateStorageCost(
  tableName: keyof typeof STORAGE_COST_ESTIMATES.BYTES_PER_ROW,
  rowCount: number
): number {
  const bytesPerRow = STORAGE_COST_ESTIMATES.BYTES_PER_ROW[tableName] || 512;
  const totalBytes = bytesPerRow * rowCount;
  const totalGB = totalBytes / (1024 * 1024 * 1024);
  return totalGB * STORAGE_COST_ESTIMATES.COST_PER_GB_MONTH;
}

/**
 * Calculate potential savings from retention policy
 */
export function estimateSavings(
  tableName: keyof typeof STORAGE_COST_ESTIMATES.BYTES_PER_ROW,
  currentRows: number,
  retentionDays: number,
  totalDaysOfData: number
): number {
  if (totalDaysOfData <= retentionDays) return 0;

  const estimatedRowsAfterCleanup = (currentRows * retentionDays) / totalDaysOfData;

  const currentCost = estimateStorageCost(tableName, currentRows);
  const costAfterCleanup = estimateStorageCost(tableName, estimatedRowsAfterCleanup);

  return Math.max(0, currentCost - costAfterCleanup);
}
