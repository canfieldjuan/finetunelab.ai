/**
 * Trace Type Definitions
 *
 * Defines types for LLM operation tracing and observability.
 * Used to capture hierarchical execution traces for debugging and analysis.
 *
 * Phase 1.2: Type Definitions
 * Date: 2025-11-29
 */

/**
 * Trace context representing an active trace span
 * Returned by startTrace() and used to correlate trace lifecycle
 */
export interface TraceContext {
  /** Unique identifier for the entire trace (shared across parent/child spans) */
  traceId: string;

  /** Unique identifier for this specific span */
  spanId: string;

  /** Parent span ID for nested operations (undefined for root spans) */
  parentSpanId?: string;

  /** User ID who initiated the operation */
  userId: string;

  /** Conversation ID if part of a chat conversation */
  conversationId?: string;

  /** Message ID if associated with a specific message */
  messageId?: string;

  /** When the span started */
  startTime: Date;

  /** Human-readable name for this span */
  spanName: string;

  /** Type of operation being traced */
  operationType: OperationType;
}

/**
 * Parameters to start a new trace span
 */
export interface StartTraceParams {
  /** Human-readable name (e.g., "llm.completion", "tool.web_search") */
  spanName: string;

  /** Type of operation being performed */
  operationType: OperationType;

  /** LLM model name (e.g., "gpt-4-turbo") */
  modelName?: string;

  /** Model provider (e.g., "openai", "anthropic") */
  modelProvider?: string;

  /** Conversation ID to link this trace to */
  conversationId?: string;

  /** Message ID to link this trace to */
  messageId?: string;

  /** Session tag for user-friendly trace search (format: chat_model_{uuid}_{counter}) */
  sessionTag?: string;

  /** Parent trace context for nested operations */
  parentContext?: TraceContext;

  /** Additional metadata to store with the trace */
  metadata?: Record<string, unknown>;
}

/**
 * Result data to end a trace span
 */
export interface TraceResult {
  /** When the span ended */
  endTime: Date;

  /** Final status of the operation */
  status: TraceStatus;

  /** Number of input tokens consumed */
  inputTokens?: number;

  /** Number of output tokens generated */
  outputTokens?: number;

  /** Total cost in USD */
  costUsd?: number;

  /** Input data (will be stored as JSONB, be mindful of size) */
  inputData?: unknown;

  /** Output data (will be stored as JSONB, be mindful of size) */
  outputData?: unknown;

  /** Error message if status is 'failed' */
  errorMessage?: string;

  /** Error type/category if status is 'failed' */
  errorType?: string;

  /** Additional metadata to merge with start metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Type of operation being traced
 */
export type OperationType =
  | 'llm_call'          // Direct LLM completion/chat call
  | 'tool_call'         // Tool/function execution
  | 'retrieval'         // Document/context retrieval
  | 'embedding'         // Embedding generation
  | 'prompt_generation' // Prompt construction
  | 'response_processing'; // Response parsing/processing

/**
 * Status of a trace span
 */
export type TraceStatus =
  | 'pending'    // Span created but not started
  | 'running'    // Span is actively executing
  | 'completed'  // Span finished successfully
  | 'failed'     // Span encountered an error
  | 'cancelled'; // Span was cancelled/aborted

/**
 * Complete trace record as stored in database
 */
export interface TraceRecord {
  id: string;
  user_id: string;
  conversation_id?: string | null;
  message_id?: string | null;
  trace_id: string;
  parent_trace_id?: string | null;
  span_id: string;
  span_name: string;
  start_time: string;
  end_time?: string | null;
  duration_ms?: number | null;
  operation_type: string;
  model_name?: string | null;
  model_provider?: string | null;
  status: string;
  error_message?: string | null;
  error_type?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  cost_usd?: number | null;
  input_data?: Record<string, unknown> | null;
  output_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Hierarchical trace structure for visualization
 */
export interface TraceHierarchy extends TraceRecord {
  children: TraceHierarchy[];
}

/**
 * Configuration options for trace service
 */
export interface TraceServiceConfig {
  /** Whether tracing is enabled (can be disabled via env var) */
  enabled: boolean;

  /** Number of traces to batch before writing to database */
  batchSize: number;

  /** Interval in milliseconds to flush batch (even if not full) */
  batchIntervalMs: number;

  /** Whether to log trace operations to console (dev mode) */
  debug: boolean;
}
