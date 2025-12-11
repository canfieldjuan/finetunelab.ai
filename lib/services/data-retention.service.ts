/**
 * Data Retention Service
 *
 * Manages automated data cleanup and retention policies.
 * Phase 4.2: Data Retention Policy
 * Date: 2025-12-16
 */

import { createClient } from '@/lib/supabase/client';

// ==================== Type Definitions ====================

export interface RetentionConfig {
  id: string;
  table_name: string;
  retention_days: number;
  enabled: boolean;
  last_cleanup_at?: string;
  total_rows_deleted: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface RetentionStatistics {
  table_name: string;
  retention_days: number;
  enabled: boolean;
  last_cleanup_at?: string;
  total_rows_deleted: number;
  current_row_count: number;
  oldest_record_age_days: number;
}

export interface CleanupResult {
  table_name: string;
  deleted_count: number;
  retention_days: number;
  cutoff_date: string;
  execution_time_ms: number;
}

// ==================== Configuration Management ====================

/**
 * Get all retention policies
 */
export async function getRetentionPolicies(): Promise<RetentionConfig[]> {
  console.log('[RetentionService] Fetching retention policies');

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('data_retention_config')
      .select('*')
      .order('table_name');

    if (error) throw error;

    console.log('[RetentionService] Retrieved', data?.length || 0, 'policies');
    return (data as RetentionConfig[]) || [];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to fetch policies';
    console.error('[RetentionService] Fetch error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Update retention policy for a table
 */
export async function updateRetentionPolicy(
  tableName: string,
  updates: {
    retention_days?: number;
    enabled?: boolean;
  }
): Promise<RetentionConfig> {
  console.log('[RetentionService] Updating policy for:', tableName);

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('data_retention_config')
      .update(updates)
      .eq('table_name', tableName)
      .select()
      .single();

    if (error) throw error;

    console.log('[RetentionService] Policy updated successfully');
    return data as RetentionConfig;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to update policy';
    console.error('[RetentionService] Update error:', errorMsg);
    throw new Error(errorMsg);
  }
}

// ==================== Statistics & Monitoring ====================

/**
 * Get retention statistics for all tables
 */
export async function getRetentionStatistics(): Promise<RetentionStatistics[]> {
  console.log('[RetentionService] Fetching retention statistics');

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .rpc('get_retention_statistics');

    if (error) throw error;

    console.log('[RetentionService] Retrieved statistics for', data?.length || 0, 'tables');
    return (data as RetentionStatistics[]) || [];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to fetch statistics';
    console.error('[RetentionService] Statistics error:', errorMsg);
    throw new Error(errorMsg);
  }
}

// ==================== Cleanup Operations ====================

/**
 * Run all retention policies
 */
export async function runAllRetentionPolicies(): Promise<CleanupResult[]> {
  console.log('[RetentionService] Running all retention policies');

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .rpc('run_all_retention_policies');

    if (error) throw error;

    const totalDeleted = (data as CleanupResult[])?.reduce(
      (sum, r) => sum + r.deleted_count,
      0
    ) || 0;

    console.log('[RetentionService] Cleanup complete. Total rows deleted:', totalDeleted);
    return (data as CleanupResult[]) || [];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to run retention policies';
    console.error('[RetentionService] Cleanup error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Run retention policy for specific table
 */
export async function runTableRetentionPolicy(
  tableName: string
): Promise<{ deleted_count: number; retention_days: number; cutoff_date: string }> {
  console.log('[RetentionService] Running retention policy for:', tableName);

  try {
    const supabase = createClient();

    let functionName: string;
    switch (tableName) {
      case 'llm_traces':
        functionName = 'cleanup_old_llm_traces';
        break;
      case 'anomaly_detections':
        functionName = 'cleanup_old_anomalies';
        break;
      case 'ab_experiment_assignments':
        functionName = 'cleanup_old_experiment_assignments';
        break;
      case 'user_cohort_snapshots':
        functionName = 'cleanup_old_cohort_snapshots';
        break;
      default:
        throw new Error(`Unknown table: ${tableName}`);
    }

    const { data, error } = await supabase.rpc(functionName);

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;

    console.log('[RetentionService] Deleted', result?.deleted_count || 0, 'rows from', tableName);
    return result || { deleted_count: 0, retention_days: 0, cutoff_date: new Date().toISOString() };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to run table cleanup';
    console.error('[RetentionService] Table cleanup error:', errorMsg);
    throw new Error(errorMsg);
  }
}

// ==================== Utility Functions ====================

/**
 * Calculate storage savings from retention policy
 */
export function calculateStorageSavings(stats: RetentionStatistics[]): {
  totalRowsManaged: number;
  totalRowsDeleted: number;
  averageRetentionDays: number;
  estimatedStorageSavedMB: number;
} {
  console.log('[RetentionService] Calculating storage savings');

  const totalRowsManaged = stats.reduce((sum, s) => sum + s.current_row_count, 0);
  const totalRowsDeleted = stats.reduce((sum, s) => sum + s.total_rows_deleted, 0);
  const averageRetentionDays = stats.length > 0
    ? Math.round(stats.reduce((sum, s) => sum + s.retention_days, 0) / stats.length)
    : 0;

  // Rough estimate: 1KB per row average
  const estimatedStorageSavedMB = Math.round(totalRowsDeleted / 1024);

  return {
    totalRowsManaged,
    totalRowsDeleted,
    averageRetentionDays,
    estimatedStorageSavedMB
  };
}

/**
 * Check if any table needs cleanup (has old data)
 */
export function needsCleanup(stats: RetentionStatistics[]): boolean {
  return stats.some(s => s.enabled && s.oldest_record_age_days > s.retention_days);
}

/**
 * Get tables that need cleanup
 */
export function getTablesNeedingCleanup(stats: RetentionStatistics[]): string[] {
  return stats
    .filter(s => s.enabled && s.oldest_record_age_days > s.retention_days)
    .map(s => s.table_name);
}

/**
 * Format cleanup result for display
 */
export function formatCleanupResult(result: CleanupResult): string {
  return `${result.table_name}: Deleted ${result.deleted_count.toLocaleString()} rows ` +
    `(retention: ${result.retention_days} days, took ${result.execution_time_ms.toFixed(0)}ms)`;
}
