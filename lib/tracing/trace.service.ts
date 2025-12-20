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
    // Get user ID from session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      traceDebugLog('startTrace', 'No user session, returning no-op context');
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
      userId: session.user.id,
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
  traceDebugLog('endTrace', { traceId: context.traceId, spanId: context.spanId, status: result.status });

  if (!isTracingEnabled()) {
    traceDebugLog('endTrace', 'Tracing disabled, skipping');
    return;
  }

  try {
    // Get session for auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      traceDebugLog('endTrace', 'No session, skipping');
      return;
    }

    // Calculate duration
    const durationMs = calculateDuration(context.startTime, result.endTime);

    // Calculate total tokens if both input and output provided
    const totalTokens =
      result.inputTokens !== undefined && result.outputTokens !== undefined
        ? result.inputTokens + result.outputTokens
        : undefined;

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
      cost_usd: result.costUsd || null,
      error_message: result.errorMessage || null,
      error_type: result.errorType || null,
      input_data: result.inputData || null,
      output_data: result.outputData || null,
      metadata: result.metadata || null,
    };

    // Send trace end to API (non-blocking)
    sendTraceEnd(session.access_token, traceUpdate).catch(error => {
      console.error('[Trace Service] Error ending trace:', error);
    });

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

  await endTrace(context, {
    endTime: new Date(),
    status: 'failed',
    errorMessage: error.message,
    errorType: error.name,
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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  await fetch('/api/analytics/traces', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trace_id: context.traceId,
      span_id: context.spanId,
      parent_trace_id: context.parentSpanId || null,
      span_name: params.spanName,
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

  // Start flush timer if not already running
  if (!batchFlushTimer) {
    batchFlushTimer = setTimeout(() => {
      flushTraceBatch(accessToken).catch(error => {
        console.error('[Trace Service] Error flushing batch:', error);
      });
    }, tracingConfig.batchIntervalMs);
  }

  // Flush immediately if batch is full
  if (traceBatch.length >= tracingConfig.batchSize) {
    if (batchFlushTimer) {
      clearTimeout(batchFlushTimer);
      batchFlushTimer = null;
    }
    await flushTraceBatch(accessToken);
  }
}

/**
 * Flush batched traces to API
 */
async function flushTraceBatch(accessToken: string): Promise<void> {
  if (traceBatch.length === 0) return;

  const batch = [...traceBatch];
  traceBatch = [];

  traceDebugLog('flushTraceBatch', { count: batch.length });

  // Send each trace in the batch
  // In a production system, you might want to support bulk inserts
  for (const trace of batch) {
    try {
      await fetch('/api/analytics/traces', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trace),
      });
    } catch (error) {
      console.error('[Trace Service] Error sending trace:', error);
      // Continue with remaining traces even if one fails
    }
  }

  traceDebugLog('flushTraceBatch complete', { count: batch.length });
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
