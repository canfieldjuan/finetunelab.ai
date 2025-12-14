/**
 * API Key Usage Logger
 * Logs detailed per-request usage data for API key authenticated endpoints
 * Date: 2025-12-12
 *
 * Usage:
 *   import { logApiKeyUsage } from '@/lib/auth/api-key-usage-logger';
 *
 *   // Fire-and-forget logging (non-blocking)
 *   logApiKeyUsage({
 *     apiKeyId: validation.keyId,
 *     userId: validation.userId,
 *     endpoint: '/api/v1/predict',
 *     method: 'POST',
 *     scopeUsed: 'production',
 *     statusCode: 200,
 *     latencyMs: 150,
 *     inputTokens: 100,
 *     outputTokens: 50,
 *   }).catch(console.error);
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface ApiKeyUsageLogParams {
  // Required fields
  apiKeyId: string;
  userId: string;
  endpoint: string;
  method: string;

  // Optional context
  scopeUsed?: string;

  // Timing
  latencyMs?: number;

  // Token usage (for LLM endpoints)
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;

  // Model info (for predict endpoint)
  modelId?: string;
  modelProvider?: string;

  // Status
  statusCode?: number;
  status?: 'pending' | 'success' | 'error';
  errorType?: string;
  errorMessage?: string;

  // Client info
  clientIp?: string;
  userAgent?: string;

  // Additional metadata
  metadata?: Record<string, unknown>;
}

// ============================================================================
// LOGGER IMPLEMENTATION
// ============================================================================

/**
 * Logs API key usage to the database
 * This is a fire-and-forget async function - call without awaiting
 *
 * @param params - Usage log parameters
 */
export async function logApiKeyUsage(params: ApiKeyUsageLogParams): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('[ApiKeyUsageLogger] Missing Supabase environment variables');
      return;
    }

    // Use service role client to bypass RLS for server-side logging
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine status from statusCode if not provided
    let status = params.status;
    if (!status && params.statusCode) {
      status = params.statusCode >= 200 && params.statusCode < 400 ? 'success' : 'error';
    }

    // Calculate total tokens if not provided
    const tokenSum = (params.inputTokens ?? 0) + (params.outputTokens ?? 0);
    const totalTokens = params.totalTokens ?? (tokenSum > 0 ? tokenSum : null);

    const { error } = await supabase
      .from('api_key_usage_logs')
      .insert({
        api_key_id: params.apiKeyId,
        user_id: params.userId,
        endpoint: params.endpoint,
        method: params.method,
        scope_used: params.scopeUsed || null,
        latency_ms: params.latencyMs || null,
        input_tokens: params.inputTokens || null,
        output_tokens: params.outputTokens || null,
        total_tokens: totalTokens,
        model_id: params.modelId || null,
        model_provider: params.modelProvider || null,
        status: status || 'success',
        status_code: params.statusCode || null,
        error_type: params.errorType || null,
        error_message: params.errorMessage || null,
        client_ip: params.clientIp || null,
        user_agent: params.userAgent || null,
        request_metadata: params.metadata || {},
      });

    if (error) {
      console.warn('[ApiKeyUsageLogger] Failed to log usage:', error.message);
    }
  } catch (err) {
    // Fire-and-forget: don't throw, just log warning
    console.warn('[ApiKeyUsageLogger] Error logging usage:', err);
  }
}

/**
 * Helper to extract client info from request headers
 *
 * @param headers - Request headers
 * @returns Client IP and User-Agent
 */
export function extractClientInfo(headers: Headers): {
  clientIp: string | null;
  userAgent: string | null;
} {
  // Try multiple headers for IP (proxies set various headers)
  const clientIp =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    null;

  const userAgent = headers.get('user-agent') || null;

  return { clientIp, userAgent };
}

/**
 * Convenience function to log a successful API request
 */
export function logSuccessfulRequest(
  params: Omit<ApiKeyUsageLogParams, 'status' | 'errorType' | 'errorMessage'> & {
    statusCode?: number;
  }
): void {
  logApiKeyUsage({
    ...params,
    status: 'success',
    statusCode: params.statusCode ?? 200,
  }).catch(err => {
    console.warn('[ApiKeyUsageLogger] Failed to log success:', err);
  });
}

/**
 * Convenience function to log a failed API request
 */
export function logFailedRequest(
  params: Omit<ApiKeyUsageLogParams, 'status'> & {
    statusCode: number;
    errorType?: string;
    errorMessage?: string;
  }
): void {
  logApiKeyUsage({
    ...params,
    status: 'error',
  }).catch(err => {
    console.warn('[ApiKeyUsageLogger] Failed to log error:', err);
  });
}
