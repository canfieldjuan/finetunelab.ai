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

  /** Total cost in USD (auto-calculated if not provided) */
  costUsd?: number;

  /** Time to first token in milliseconds (streaming only) */
  ttftMs?: number;

  /** Token generation throughput (tokens per second) */
  tokensPerSecond?: number;

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
  ttft_ms?: number | null;
  tokens_per_second?: number | null;
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

/**
 * Structured input data format for LLM calls
 * Stored in input_data JSONB field with size limits
 */
export interface LLMInputData {
  /** System prompt (truncated to 5KB) */
  systemPrompt?: string;

  /** User message (truncated to 5KB) */
  userMessage?: string;

  /** Recent conversation history (last 5 messages only) */
  conversationHistory?: Array<{
    role: string;
    content: string;
  }>;

  /** LLM parameters used */
  parameters: {
    temperature: number;
    maxTokens: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };

  /** Tool definitions sent to LLM (names and descriptions only) */
  toolDefinitions?: Array<{
    name: string;
    description: string;
  }>;
}

/**
 * Structured output data format for LLM calls
 * Stored in output_data JSONB field with size limits
 */
export interface LLMOutputData {
  /** Response content (truncated to 10KB) */
  content: string;

  /** Extended thinking/reasoning (truncated to 10KB) */
  reasoning?: string;

  /** Stop reason from API ('stop', 'length', 'tool_calls', etc.) */
  stopReason?: string;

  /** Alias for stopReason */
  finishReason?: string;

  /** Tool calls made during generation */
  toolCallsMade?: Array<{
    name: string;
    success: boolean;
  }>;
}

/**
 * Structured output data format for RAG retrieval
 * Stored in output_data JSONB field
 */
export interface RAGOutputData {
  /** Top N retrieved chunks with scores */
  topChunks: Array<{
    /** Fact text (truncated to 500 chars each) */
    fact: string;
    /** Confidence score (0-1) */
    score: number;
    /** Source description */
    sourceDescription?: string;
    /** Entity name from knowledge graph */
    entityName?: string;
  }>;

  /** Total number of candidates considered */
  totalCandidates: number;

  /** Average confidence across all chunks */
  avgConfidence: number;
}

/**
 * Structured input data for tool calls
 * Stored in input_data JSONB field with size limits
 */
export interface ToolCallInputData {
  /** Tool name */
  toolName: string;

  /** Tool arguments (truncated to 5KB) */
  arguments: Record<string, unknown>;

  /** Tool description for context */
  toolDescription?: string;
}

/**
 * Structured output data for tool calls
 * Stored in output_data JSONB field with size limits
 */
export interface ToolCallOutputData {
  /** Tool execution result (truncated to 10KB) */
  result: unknown;

  /** Execution status */
  executionStatus: 'success' | 'failed';

  /** Execution time in milliseconds */
  executionTimeMs?: number;

  /** Error details if failed */
  errorDetails?: string;
}
