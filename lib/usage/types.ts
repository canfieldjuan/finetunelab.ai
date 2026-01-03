/**
 * Usage Enforcement Types
 * Date: 2025-10-24
 */

// Local JsonValue type to avoid circular import
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Types of usage metrics we enforce
 */
export type UsageMetricType =
  // Existing metrics
  | 'api_call'
  | 'storage_mb'
  | 'model_created'
  | 'training_job'
  | 'token_usage'
  // NEW: Critical resource metrics (added 2025-12-17)
  | 'batch_test_run'
  | 'scheduled_eval_run'
  | 'chat_message'
  | 'inference_call'
  | 'compute_minutes'
  // NEW: Usage tracking audit metrics (added 2026-01-02)
  | 'evaluation_run'
  | 'anomaly_detection'
  | 'analytics_assistant'
  | 'research_job'
  | 'graphrag_search';

/**
 * Result of checking if an action can be performed
 */
export interface CanPerformResult {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
  percentage: number;
}

/**
 * Result of usage check with detailed info
 */
export interface UsageCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  percentage: number;
  remaining: number;
  isUnlimited: boolean;
}

/**
 * Error response when limit is exceeded
 */
export interface UsageLimitError {
  error: string;
  code: 'USAGE_LIMIT_EXCEEDED';
  limitType: string;
  current: number;
  limit: number;
  percentage: number;
  message: string;
  upgradeUrl: string;
}

/**
 * Request to record usage
 */
export interface RecordUsageRequest {
  userId: string;
  metricType: UsageMetricType;
  value?: number;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, JsonValue>;
}
