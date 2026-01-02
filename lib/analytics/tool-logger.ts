/**
 * Analytics Tool Logger
 * Tracks tool execution performance and errors for analytics assistant
 * Date: 2026-01-02
 * Phase 4: Enhanced Logging
 *
 * Usage:
 *   import { startToolLog, completeToolLog, failToolLog } from '@/lib/analytics/tool-logger';
 *
 *   const logId = await startToolLog({ userId, toolName, args });
 *   try {
 *     const result = await executeTool();
 *     await completeToolLog(logId, { resultSummary });
 *     return result;
 *   } catch (error) {
 *     await failToolLog(logId, { errorType, errorMessage });
 *     throw error;
 *   }
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface StartToolLogParams {
  userId: string;
  toolName: string;
  args?: Record<string, unknown>;
}

export interface CompleteToolLogParams {
  resultSummary?: Record<string, unknown>;
}

export interface FailToolLogParams {
  errorType?: string;
  errorMessage?: string;
}

// ============================================================================
// SANITIZATION HELPERS
// ============================================================================

/**
 * Sanitize tool arguments to remove sensitive data
 * Truncates large values to prevent bloat
 */
function sanitizeArgs(args?: Record<string, unknown>): Record<string, unknown> | null {
  if (!args) return null;

  const sanitized: Record<string, unknown> = {};
  const MAX_STRING_LENGTH = 500;
  const MAX_ARRAY_LENGTH = 10;

  for (const [key, value] of Object.entries(args)) {
    // Skip sensitive keys
    if (key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('api_key')) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Truncate strings
    if (typeof value === 'string') {
      sanitized[key] = value.length > MAX_STRING_LENGTH
        ? value.slice(0, MAX_STRING_LENGTH) + '...[truncated]'
        : value;
      continue;
    }

    // Truncate arrays
    if (Array.isArray(value)) {
      sanitized[key] = value.length > MAX_ARRAY_LENGTH
        ? [...value.slice(0, MAX_ARRAY_LENGTH), `...[${value.length - MAX_ARRAY_LENGTH} more]`]
        : value;
      continue;
    }

    // Pass through other types
    sanitized[key] = value;
  }

  return sanitized;
}

/**
 * Sanitize result summary to remove large data
 * Keep only high-level summary info
 */
function sanitizeResultSummary(summary?: Record<string, unknown>): Record<string, unknown> | null {
  if (!summary) return null;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(summary)) {
    // Only include scalar values and small arrays
    if (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = { count: value.length };
    } else if (typeof value === 'object' && value !== null) {
      // For objects, only include count of keys
      sanitized[key] = { keys: Object.keys(value).length };
    }
  }

  return sanitized;
}

// ============================================================================
// LOGGER FUNCTIONS
// ============================================================================

/**
 * Start a tool execution log
 * Returns log ID for subsequent updates
 */
export async function startToolLog(params: StartToolLogParams): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('[ToolLogger] Missing Supabase environment variables');
      return null;
    }

    // Use service role client to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('analytics_tool_logs')
      .insert({
        user_id: params.userId,
        tool_name: params.toolName,
        args: sanitizeArgs(params.args),
        status: 'pending',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[ToolLogger] Failed to start tool log:', error.message);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.warn('[ToolLogger] Error starting tool log:', err);
    return null;
  }
}

/**
 * Complete a tool execution log
 * Updates status to 'success' and records completion time
 */
export async function completeToolLog(
  logId: string | null,
  params: CompleteToolLogParams = {}
): Promise<void> {
  if (!logId) return; // Graceful degradation if log wasn't started

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get started_at to calculate duration
    const { data: logData } = await supabase
      .from('analytics_tool_logs')
      .select('started_at')
      .eq('id', logId)
      .single();

    const completedAt = new Date();
    const durationMs = logData?.started_at
      ? completedAt.getTime() - new Date(logData.started_at).getTime()
      : null;

    const { error } = await supabase
      .from('analytics_tool_logs')
      .update({
        status: 'success',
        completed_at: completedAt.toISOString(),
        duration_ms: durationMs,
        result_summary: sanitizeResultSummary(params.resultSummary),
      })
      .eq('id', logId);

    if (error) {
      console.warn('[ToolLogger] Failed to complete tool log:', error.message);
    }
  } catch (err) {
    console.warn('[ToolLogger] Error completing tool log:', err);
  }
}

/**
 * Mark a tool execution as failed
 * Updates status to 'error' and records error details
 */
export async function failToolLog(
  logId: string | null,
  params: FailToolLogParams = {}
): Promise<void> {
  if (!logId) return; // Graceful degradation

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get started_at to calculate duration
    const { data: logData } = await supabase
      .from('analytics_tool_logs')
      .select('started_at')
      .eq('id', logId)
      .single();

    const completedAt = new Date();
    const durationMs = logData?.started_at
      ? completedAt.getTime() - new Date(logData.started_at).getTime()
      : null;

    const { error } = await supabase
      .from('analytics_tool_logs')
      .update({
        status: 'error',
        completed_at: completedAt.toISOString(),
        duration_ms: durationMs,
        error_type: params.errorType || 'unknown',
        error_message: params.errorMessage || 'Unknown error',
      })
      .eq('id', logId);

    if (error) {
      console.warn('[ToolLogger] Failed to mark tool as failed:', error.message);
    }
  } catch (err) {
    console.warn('[ToolLogger] Error failing tool log:', err);
  }
}

/**
 * Categorize errors into types for analytics
 */
export function categorizeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'unknown';
  }

  const message = error.message.toLowerCase();

  if (message.includes('unauthorized') || message.includes('forbidden')) {
    return 'auth_error';
  }

  if (message.includes('not found') || message.includes('does not exist')) {
    return 'not_found';
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }

  if (message.includes('network') || message.includes('fetch failed')) {
    return 'network_error';
  }

  if (message.includes('validation') || message.includes('invalid')) {
    return 'validation_error';
  }

  if (message.includes('rate limit')) {
    return 'rate_limit';
  }

  return 'execution_error';
}
