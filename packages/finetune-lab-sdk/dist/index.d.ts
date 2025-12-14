/**
 * FineTune Lab SDK Types
 * Date: 2025-12-12
 */
interface FinetuneLabClientConfig {
    /** API key (or set FINETUNE_LAB_API_KEY env var) */
    apiKey?: string;
    /** API base URL (or set FINETUNE_LAB_API_URL env var) */
    baseUrl?: string;
    /** Request timeout in milliseconds (default 60000) */
    timeout?: number;
}
interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
interface PredictRequest {
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
interface PredictResponse {
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
interface BatchTestConfig {
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
interface BatchTestRunResponse {
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
interface BatchTestStatusResponse {
    testId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    totalPrompts: number;
    completedPrompts: number;
    failedPrompts: number;
    startedAt?: string;
    completedAt?: string;
    error?: string;
}
interface BatchTestCancelResponse {
    success: boolean;
    testId: string;
    message: string;
}
interface TraceFilters {
    /** Max traces to return (default 50) */
    limit?: number;
    /** Pagination offset */
    offset?: number;
    /** Filter by conversation ID */
    conversationId?: string;
    /** Filter by trace ID */
    traceId?: string;
}
interface Trace {
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
interface TracesResponse {
    traces: Trace[];
    count: number;
    hasMore: boolean;
}
interface CreateTraceRequest {
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
interface AnalyticsDataFilters {
    /** Start date (ISO format) */
    startDate?: string;
    /** End date (ISO format) */
    endDate?: string;
    /** Data granularity */
    granularity?: 'hour' | 'day' | 'week';
}
interface AnalyticsDataResponse {
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
interface FinetuneLabErrorDetails {
    message: string;
    type?: string;
    code?: number;
    param?: string;
}

/**
 * FineTune Lab API Client
 * Date: 2025-12-12
 *
 * Authenticated client for inference, batch testing, and analytics.
 */

declare class FinetuneLabError extends Error {
    readonly statusCode: number;
    readonly type?: string;
    readonly details?: FinetuneLabErrorDetails;
    constructor(message: string, statusCode?: number, details?: FinetuneLabErrorDetails);
}
declare class BatchTestClient {
    private client;
    constructor(client: FinetuneLabClient);
    /**
     * Run a batch test
     */
    run(config: BatchTestConfig): Promise<BatchTestRunResponse>;
    /**
     * Get batch test status
     */
    status(testId: string): Promise<BatchTestStatusResponse>;
    /**
     * Cancel a running batch test
     */
    cancel(testId: string): Promise<BatchTestCancelResponse>;
}
declare class AnalyticsClient {
    private client;
    constructor(client: FinetuneLabClient);
    /**
     * Get traces
     */
    traces(filters?: TraceFilters): Promise<TracesResponse>;
    /**
     * Create a trace
     */
    createTrace(trace: CreateTraceRequest): Promise<{
        id: string;
    }>;
    /**
     * Get aggregated analytics data
     */
    data(filters?: AnalyticsDataFilters): Promise<AnalyticsDataResponse>;
}
declare class FinetuneLabClient {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeout;
    /** Batch testing operations (testing scope) */
    readonly batchTest: BatchTestClient;
    /** Analytics operations (production scope) */
    readonly analytics: AnalyticsClient;
    constructor(config?: FinetuneLabClientConfig);
    /**
     * Make an authenticated request to the API
     */
    request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint: string, body?: unknown): Promise<T>;
    /**
     * Run inference on a model (production scope)
     */
    predict(request: PredictRequest): Promise<PredictResponse>;
}

export { type AnalyticsDataFilters, type AnalyticsDataResponse, type BatchTestCancelResponse, type BatchTestConfig, type BatchTestRunResponse, type BatchTestStatusResponse, type CreateTraceRequest, FinetuneLabClient, type FinetuneLabClientConfig, FinetuneLabError, type FinetuneLabErrorDetails, type Message, type PredictRequest, type PredictResponse, type Trace, type TraceFilters, type TracesResponse };
