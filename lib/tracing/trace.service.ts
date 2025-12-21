/**
 * Trace Service
 *
 * Central service for capturing and managing LLM operation traces.
 * Provides automatic trace lifecycle management with hierarchical support.
 *
 * Features:
 * - Unique trace/span ID generation
 * - Automatic duration calculation
 * - Hierarchical parent-child relationships
 * - Batched writes for performance
 * - Graceful degradation (never blocks main flow)
 * - Usage metering integration (tracks root traces for billing)
 *
 * Phase 1.1: Core Trace Service
 * Date: 2025-11-29
 * Updated: 2025-12-18 - Added usage metering
 */

import { supabase } from '@/lib/supabaseClient';
import { tracingConfig, isTracingEnabled, traceDebugLog } from '@/lib/config/tracing.config';
import { recordRootTraceUsage } from '@/lib/billing/usage-meter.service';
import { categorizeError } from './error-categorizer';
import type {
  TraceContext,
  StartTraceParams,
  TraceResult,
  TraceRecord,
} from './types';

/**
 * Batch queue for trace records
 */
let traceBatch: Partial<TraceRecord>[] = [];
let batchFlushTimer: NodeJS.Timeout | null = null;

/**
 * Generate unique trace ID
 * Format: trace_{timestamp}_{random}
 */
export function generateTraceId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `trace_${timestamp}_${random}`;
}

/**
 * Generate unique span ID
 * Format: span_{timestamp}_{random}
 */
export function generateSpanId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `span_${timestamp}_${random}`;
}

/**
 * Calculate duration in milliseconds between two dates
 */
export function calculateDuration(startTime: Date, endTime: Date): number {
  return endTime.getTime() - startTime.getTime();
}

/**
 * Start a new trace span
 *
 * @param params - Parameters for the trace span
 * @returns TraceContext to use for ending the trace
 */
export async function startTrace(params: StartTraceParams): Promise<TraceContext> {
  traceDebugLog('startTrace', { spanName: params.spanName, operationType: params.operationType });

  // If tracing is disabled, return a no-op context
  if (!isTracingEnabled()) {
    traceDebugLog('startTrace', 'Tracing disabled, returning no-op context');
    return createNoOpContext(params);
  }

  try {
    // Get user ID from params (server-side) or session (client-side)
    let userId = params.userId;

    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }

    if (!userId) {
      traceDebugLog('startTrace', 'No userId provided and no user session, returning no-op context');
      return createNoOpContext(params);
    }

    // Generate IDs
    const traceId = params.parentContext?.traceId || generateTraceId();
    const spanId = generateSpanId();
    const parentSpanId = params.parentContext?.spanId;

    // Create context
    const context: TraceContext = {
      traceId,
      spanId,
      parentSpanId,
      userId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      startTime: new Date(),
      spanName: params.spanName,
      operationType: params.operationType,
    };

    // Send trace start to API (non-blocking)
    sendTraceStart(context, params).catch(error => {
      // Log error but don't throw - never block main flow
      console.error('[Trace Service] Error starting trace:', error);
    });

    // Log trace IDs for debugging (helpful for searching traces)
    console.log(`[Trace] Started trace - Trace ID: ${traceId}, Conversation ID: ${params.conversationId || 'N/A'}`);

    traceDebugLog('startTrace complete', { traceId, spanId });
    return context;

  } catch (error) {
    // If anything fails, return no-op context
    console.error('[Trace Service] Error in startTrace:', error);
    return createNoOpContext(params);
  }
}

/**
 * End a trace span
 *
 * @param context - The trace context from startTrace
 * @param result - Result data including end time and status
 */
export async function endTrace(context: TraceContext, result: TraceResult): Promise<void> {
  console.log(`[TRACE DEBUG] endTrace called for span_id: ${context.spanId}, status: ${result.status}`);
  traceDebugLog('endTrace', { traceId: context.traceId, spanId: context.spanId, status: result.status });

  const tracingEnabled = isTracingEnabled();
  console.log(`[TRACE DEBUG] Tracing enabled: ${tracingEnabled}`);
  if (!tracingEnabled) {
    console.log(`[TRACE DEBUG] Tracing disabled - skipping endTrace for ${context.spanId}`);
    traceDebugLog('endTrace', 'Tracing disabled, skipping');
    return;
  }

  try {
    // Get service role key for auth
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log(`[TRACE DEBUG] Service key present: ${!!serviceKey}`);
    if (!serviceKey) {
      console.log(`[TRACE DEBUG] No service key - skipping endTrace for ${context.spanId}`);
      traceDebugLog('endTrace', 'No service key, skipping');
      return;
    }

    // Calculate duration
    const durationMs = calculateDuration(context.startTime, result.endTime);

    // Calculate total tokens if both input and output provided
    const totalTokens =
      result.inputTokens !== undefined && result.outputTokens !== undefined
        ? result.inputTokens + result.outputTokens
        : undefined;

    // Auto-calculate cost if not provided but tokens available
    let costUsd = result.costUsd;
    if (!costUsd && result.inputTokens && result.outputTokens) {
      const modelName = result.metadata?.modelName as string | undefined;
      if (modelName) {
        try {
          const { calculateCost, matchModelToPricing } = await import('./pricing-config');
          const pricingKey = matchModelToPricing(modelName);
          costUsd = calculateCost(pricingKey, result.inputTokens, result.outputTokens);
          traceDebugLog('Auto-calculated cost', { modelName, costUsd });
        } catch (err) {
          traceDebugLog('Failed to auto-calculate cost', err);
        }
      }
    }

    // Auto-calculate token throughput if not provided
    let tokensPerSecond = result.tokensPerSecond;
    if (!tokensPerSecond && result.outputTokens && durationMs > 0) {
      tokensPerSecond = (result.outputTokens / durationMs) * 1000;
      traceDebugLog('Auto-calculated throughput', { tokensPerSecond });
    }

    // Create trace update payload
    const traceUpdate = {
      trace_id: context.traceId,
      span_id: context.spanId,
      span_name: context.spanName,
      parent_trace_id: context.parentSpanId || null,
      user_id: context.userId,
      conversation_id: context.conversationId || null,
      message_id: context.messageId || null,
      start_time: context.startTime.toISOString(),
      end_time: result.endTime.toISOString(),
      duration_ms: durationMs,
      operation_type: context.operationType,
      status: result.status,
      input_tokens: result.inputTokens || null,
      output_tokens: result.outputTokens || null,
      total_tokens: totalTokens || null,
      cost_usd: costUsd || null,
      ttft_ms: result.ttftMs || null,
      tokens_per_second: tokensPerSecond || null,
      cache_creation_input_tokens: result.cacheCreationInputTokens || null,
      cache_read_input_tokens: result.cacheReadInputTokens || null,
      retry_count: result.retryCount || null,
      retry_reason: result.retryReason || null,
      error_category: result.errorCategory || null,
      error_message: result.errorMessage || null,
      error_type: result.errorType || null,
      input_data: result.inputData || null,
      output_data: result.outputData || null,
      metadata: result.metadata || null,
    };

    console.log(`[TRACE DEBUG] Calling sendTraceEnd for span_id: ${context.spanId}, batch size will be: ${traceBatch.length + 1}`);

    // Send trace end to API (non-blocking)
    sendTraceEnd(serviceKey, traceUpdate).catch(error => {
      console.error('[Trace Service] Error ending trace:', error);
      console.error('[TRACE DEBUG] sendTraceEnd error details:', error);
    });

    console.log(`[TRACE DEBUG] sendTraceEnd called successfully for span_id: ${context.spanId}`);

    // USAGE METERING: Track root traces for billing
    // Only meter root traces (no parent) to count top-level operations
    if (!context.parentSpanId && result.status === 'completed') {
      recordRootTraceUsage({
        userId: context.userId,
        traceId: context.traceId,
        inputData: result.inputData,
        outputData: result.outputData,
        metadata: result.metadata as Record<string, unknown> | undefined,
      }).catch(error => {
        // Log but don't throw - metering shouldn't break tracing
        console.error('[Trace Service] Failed to meter usage:', error);
      });
    }

    traceDebugLog('endTrace complete', { durationMs, status: result.status });

  } catch (error) {
    // Never throw - graceful degradation
    console.error('[Trace Service] Error in endTrace:', error);
  }
}

/**
 * Capture an error in a trace span
 *
 * @param context - The trace context
 * @param error - The error that occurred
 */
export async function captureError(context: TraceContext, error: Error): Promise<void> {
  traceDebugLog('captureError', { traceId: context.traceId, error: error.message });

  // Auto-categorize error for analytics
  const categorized = categorizeError(undefined, error.message, error.name);

  await endTrace(context, {
    endTime: new Date(),
    status: 'failed',
    errorMessage: error.message,
    errorType: error.name,
    errorCategory: categorized.category,
  });
}

/**
 * Create a child span for nested operations
 *
 * @param parent - Parent trace context
 * @param spanName - Name for the child span
 * @param operationType - Operation type for child span
 * @returns New trace context for the child span
 */
export async function createChildSpan(
  parent: TraceContext,
  spanName: string,
  operationType: StartTraceParams['operationType'] = 'tool_call'
): Promise<TraceContext> {
  traceDebugLog('createChildSpan', { parentSpan: parent.spanName, childSpan: spanName });

  return await startTrace({
    spanName,
    operationType,
    parentContext: parent,
    conversationId: parent.conversationId,
    messageId: parent.messageId,
    userId: parent.userId,
  });
}

/**
 * Send trace start to API
 * Non-blocking helper function
 */
async function sendTraceStart(
  context: TraceContext,
  params: StartTraceParams
): Promise<void> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  await fetch(`${baseUrl}/api/analytics/traces`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trace_id: context.traceId,
      span_id: context.spanId,
      parent_trace_id: context.parentSpanId || null,
      span_name: params.spanName,
      user_id: context.userId,
      start_time: context.startTime.toISOString(),
      operation_type: params.operationType,
      model_name: params.modelName || null,
      model_provider: params.modelProvider || null,
      conversation_id: context.conversationId || null,
      message_id: context.messageId || null,
      session_tag: params.sessionTag || null,
      status: 'running',
      metadata: params.metadata || null,
    }),
  });
}

/**
 * Send trace end to API
 * Uses batching for performance
 */
async function sendTraceEnd(
  accessToken: string,
  traceUpdate: Record<string, unknown>
): Promise<void> {
  // Add to batch
  traceBatch.push(traceUpdate as Partial<TraceRecord>);

  console.log(`[TRACE DEBUG] Trace added to batch, batch size: ${traceBatch.length}, threshold: ${tracingConfig.batchSize}`);

  // Always flush immediately to avoid timer issues in serverless
  // The timer-based batching doesn't work reliably when requests complete quickly
  if (batchFlushTimer) {
    clearTimeout(batchFlushTimer);
    batchFlushTimer = null;
  }
  await flushTraceBatch(accessToken);
}

/**
 * Flush batched traces to API
 */
async function flushTraceBatch(accessToken: string): Promise<void> {
  if (traceBatch.length === 0) return;

  const batch = [...traceBatch];
  traceBatch = [];

  // Deduplicate by span_id - keep last occurrence (most recent state)
  const uniqueTraces = new Map<string, Partial<TraceRecord>>();
  for (const trace of batch) {
    if (trace.span_id) {
      if (uniqueTraces.has(trace.span_id)) {
        console.warn(`[Trace Service] Duplicate span_id in batch: ${trace.span_id} - keeping latest`);
      }
      uniqueTraces.set(trace.span_id, trace);
    }
  }

  const dedupedBatch = Array.from(uniqueTraces.values());

  console.log(`[TRACE DEBUG] flushTraceBatch called with ${batch.length} traces, ${dedupedBatch.length} after dedup`);
  traceDebugLog('flushTraceBatch', {
    originalCount: batch.length,
    dedupedCount: dedupedBatch.length,
    duplicates: batch.length - dedupedBatch.length
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  console.log(`[TRACE DEBUG] Sending traces to: ${baseUrl}/api/analytics/traces`);

  // Send each trace in the batch
  // In a production system, you might want to support bulk inserts
  for (const trace of dedupedBatch) {
    console.log(`[TRACE DEBUG] Sending trace POST for span_id: ${trace.span_id}, status: ${trace.status}`);
    try {
      const response = await fetch(`${baseUrl}/api/analytics/traces`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trace),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TRACE DEBUG] Trace POST failed for span_id: ${trace.span_id}, status: ${response.status}, error: ${errorText}`);
      } else {
        console.log(`[TRACE DEBUG] Trace POST succeeded for span_id: ${trace.span_id}`);
      }
    } catch (error) {
      console.error('[Trace Service] Error sending trace:', error);
      console.error(`[TRACE DEBUG] Fetch error for span_id: ${trace.span_id}:`, error);
      // Continue with remaining traces even if one fails
    }
  }

  console.log(`[TRACE DEBUG] flushTraceBatch complete, sent ${dedupedBatch.length} traces`);
  traceDebugLog('flushTraceBatch complete', { sent: dedupedBatch.length });
}

/**
 * Create a no-op trace context when tracing is disabled
 */
function createNoOpContext(params: StartTraceParams): TraceContext {
  return {
    traceId: params.parentContext?.traceId || 'noop',
    spanId: 'noop',
    parentSpanId: params.parentContext?.spanId,
    userId: 'noop',
    startTime: new Date(),
    spanName: params.spanName,
    operationType: params.operationType,
    conversationId: params.conversationId,
    messageId: params.messageId,
  };
}

/**
 * Trace Service singleton
 */
export const traceService = {
  startTrace,
  endTrace,
  captureError,
  createChildSpan,
  generateTraceId,
  generateSpanId,
  calculateDuration,
};
