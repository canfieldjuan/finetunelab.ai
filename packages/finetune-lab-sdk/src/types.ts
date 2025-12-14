/**
 * FineTune Lab SDK Types
 * Date: 2025-12-12
 */

// ============================================================================
// Client Configuration
// ============================================================================

export interface FinetuneLabClientConfig {
  /** API key (or set FINETUNE_LAB_API_KEY env var) */
  apiKey?: string;
  /** API base URL (or set FINETUNE_LAB_API_URL env var) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default 60000) */
  timeout?: number;
}

// ============================================================================
// Predict API Types
// ============================================================================

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PredictRequest {
  /** Model ID (e.g., "gpt-4", "claude-3-sonnet") */
  model: string;
  /** Conversation messages */
  messages: Message[];
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Whether to stream response */
  stream?: boolean;
}

export interface PredictResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// Batch Testing Types
// ============================================================================

export interface BatchTestConfig {
  /** Model ID from registered models */
  modelId: string;
  /** Test suite ID (recommended) */
  testSuiteId?: string;
  /** Dataset ID (alternative) */
  datasetId?: string;
  /** File path to prompts (alternative) */
  sourcePath?: string;
  /** Maximum prompts to test (default 25) */
  promptLimit?: number;
  /** Concurrent requests (default 3) */
  concurrency?: number;
  /** Delay between requests in ms (default 1000) */
  delayMs?: number;
  /** Optional name for the test run */
  name?: string;
}

export interface BatchTestRunResponse {
  success: boolean;
  testId: string;
  status: string;
  results?: {
    totalPrompts: number;
    successful: number;
    failed: number;
    avgLatencyMs?: number;
    totalTokens?: number;
  };
  analyticsUrl?: string;
}

export interface BatchTestStatusResponse {
  testId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalPrompts: number;
  completedPrompts: number;
  failedPrompts: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface BatchTestCancelResponse {
  success: boolean;
  testId: string;
  message: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface TraceFilters {
  /** Max traces to return (default 50) */
  limit?: number;
  /** Pagination offset */
  offset?: number;
  /** Filter by conversation ID */
  conversationId?: string;
  /** Filter by trace ID */
  traceId?: string;
}

export interface Trace {
  id: string;
  userId: string;
  conversationId?: string;
  messageId?: string;
  traceId: string;
  parentTraceId?: string;
  spanId: string;
  spanName: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  operationType?: string;
  modelName?: string;
  modelProvider?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  status?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface TracesResponse {
  traces: Trace[];
  count: number;
  hasMore: boolean;
}

export interface CreateTraceRequest {
  traceId: string;
  spanId: string;
  spanName: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  operationType?: string;
  modelName?: string;
  modelProvider?: string;
  inputTokens?: number;
  outputTokens?: number;
  status?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface AnalyticsDataFilters {
  /** Start date (ISO format) */
  startDate?: string;
  /** End date (ISO format) */
  endDate?: string;
  /** Data granularity */
  granularity?: 'hour' | 'day' | 'week';
}

export interface AnalyticsDataResponse {
  data: Array<{
    date: string;
    requestCount: number;
    tokenCount: number;
    avgLatencyMs: number;
    errorRate: number;
  }>;
  summary: {
    totalRequests: number;
    totalTokens: number;
    avgLatencyMs: number;
    errorRate: number;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export interface FinetuneLabErrorDetails {
  message: string;
  type?: string;
  code?: number;
  param?: string;
}
