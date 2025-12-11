/**
 * Tracing Configuration
 *
 * Centralized configuration for LLM operation tracing.
 * Controls whether tracing is enabled and how traces are batched.
 *
 * Phase 1.3: Configuration
 * Date: 2025-11-29
 */

import type { TraceServiceConfig } from '@/lib/tracing/types';

/**
 * Get tracing configuration from environment variables
 */
export const tracingConfig: TraceServiceConfig = {
  // Enable/disable tracing via environment variable
  // Defaults to true in production, can be disabled with ENABLE_TRACING=false
  enabled: process.env.ENABLE_TRACING !== 'false',

  // Number of traces to accumulate before writing to database
  // Higher = better performance, lower = more real-time visibility
  // Default: 10 traces
  batchSize: parseInt(process.env.TRACE_BATCH_SIZE || '10', 10),

  // Interval in milliseconds to flush batched traces
  // Ensures traces aren't held indefinitely if batch size not reached
  // Default: 1000ms (1 second)
  batchIntervalMs: parseInt(process.env.TRACE_BATCH_INTERVAL_MS || '1000', 10),

  // Enable debug logging for trace operations
  // Automatically enabled in development mode
  debug: process.env.NODE_ENV === 'development' || process.env.TRACE_DEBUG === 'true',
};

/**
 * Helper to check if tracing is enabled
 */
export function isTracingEnabled(): boolean {
  return tracingConfig.enabled;
}

/**
 * Helper to log trace debug messages
 */
export function traceDebugLog(context: string, data?: unknown): void {
  if (tracingConfig.debug) {
    console.log(`[Trace - ${context}]`, data || '');
  }
}
