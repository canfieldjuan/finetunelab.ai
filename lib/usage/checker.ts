/**
 * Usage Enforcement Library
 * Core functions for checking and recording usage
 * Date: 2025-10-24
 */

import { createClient } from '@supabase/supabase-js';
import type {
  UsageMetricType,
  CanPerformResult,
  UsageCheckResult,
  RecordUsageRequest,
} from './types';

/**
 * Check if user can perform an action based on usage limits
 */
export async function canPerformAction(
  userId: string,
  metricType: UsageMetricType,
  increment: number = 1
): Promise<CanPerformResult> {
  console.log('[UsageChecker] Checking if user can perform action:', {
    userId,
    metricType,
    increment,
  });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call database function to check usage
    const { data, error } = await supabase.rpc('check_usage_limit', {
      p_user_id: userId,
      p_metric_type: metricType,
      p_increment: increment,
    });

    if (error) {
      console.error('[UsageChecker] Error checking usage limit:', error);
      // On error, allow action but log the issue
      return {
        allowed: true,
        current: 0,
        limit: -1,
        percentage: 0,
        reason: 'Error checking limit - allowing action',
      };
    }

    const result = data as UsageCheckResult;
    console.log('[UsageChecker] Usage check result:', result);

    // Build response
    const response: CanPerformResult = {
      allowed: result.allowed,
      current: result.current,
      limit: result.limit,
      percentage: result.percentage,
    };

    if (!result.allowed) {
      response.reason = `Usage limit exceeded: ${result.current}/${result.limit} ${metricType}`;
    }

    return response;
  } catch (error) {
    console.error('[UsageChecker] Unexpected error:', error);
    // On error, allow action to prevent blocking users
    return {
      allowed: true,
      current: 0,
      limit: -1,
      percentage: 0,
      reason: 'Error checking limit - allowing action',
    };
  }
}

/**
 * Record usage after an action is performed
 */
export async function recordUsageEvent(
  request: RecordUsageRequest
): Promise<void> {
  console.log('[UsageChecker] Recording usage event:', {
    userId: request.userId,
    metricType: request.metricType,
    value: request.value || 1,
  });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call database function to record usage
    const { error } = await supabase.rpc('record_usage', {
      p_user_id: request.userId,
      p_metric_type: request.metricType,
      p_value: request.value || 1,
      p_resource_type: request.resourceType || null,
      p_resource_id: request.resourceId || null,
      p_metadata: request.metadata || {},
    });

    if (error) {
      console.error('[UsageChecker] Error recording usage:', error);
      // Don't throw - usage recording failure shouldn't break the app
    } else {
      console.log('[UsageChecker] Usage recorded successfully');
    }
  } catch (error) {
    console.error('[UsageChecker] Unexpected error recording usage:', error);
    // Don't throw - usage recording failure shouldn't break the app
  }
}

/**
 * Get current usage with limits for a user
 */
export async function getCurrentUsageWithLimits(
  userId: string
): Promise<Record<string, UsageCheckResult>> {
  console.log('[UsageChecker] Getting current usage with limits:', userId);

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.rpc('get_usage_with_limits', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[UsageChecker] Error getting usage:', error);
      return {};
    }

    console.log('[UsageChecker] Retrieved usage data:', data);
    return data || {};
  } catch (error) {
    console.error('[UsageChecker] Unexpected error:', error);
    return {};
  }
}

/**
 * Refresh the materialized view for current usage
 * Call this periodically or after bulk operations
 */
export async function refreshUsageView(): Promise<void> {
  console.log('[UsageChecker] Refreshing usage materialized view');

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase.rpc('refresh_current_usage_summary');

    if (error) {
      console.error('[UsageChecker] Error refreshing view:', error);
    } else {
      console.log('[UsageChecker] Usage view refreshed successfully');
    }
  } catch (error) {
    console.error('[UsageChecker] Unexpected error:', error);
  }
}
