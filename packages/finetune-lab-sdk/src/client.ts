/**
 * FineTune Lab API Client
 * Date: 2025-12-12
 *
 * Authenticated client for inference, batch testing, and analytics.
 */

import type {
  FinetuneLabClientConfig,
  PredictRequest,
  PredictResponse,
  BatchTestConfig,
  BatchTestRunResponse,
  BatchTestStatusResponse,
  BatchTestCancelResponse,
  TraceFilters,
  TracesResponse,
  CreateTraceRequest,
  AnalyticsDataFilters,
  AnalyticsDataResponse,
  FinetuneLabErrorDetails,
} from './types';

// ============================================================================
// Error Class
// ============================================================================

export class FinetuneLabError extends Error {
  public readonly statusCode: number;
  public readonly type?: string;
  public readonly details?: FinetuneLabErrorDetails;

  constructor(
    message: string,
    statusCode: number = 0,
    details?: FinetuneLabErrorDetails
  ) {
    super(message);
    this.name = 'FinetuneLabError';
    this.statusCode = statusCode;
    this.type = details?.type;
    this.details = details;
  }
}

// ============================================================================
// Batch Test Client
// ============================================================================

class BatchTestClient {
  constructor(private client: FinetuneLabClient) {}

  /**
   * Run a batch test
   */
  async run(config: BatchTestConfig): Promise<BatchTestRunResponse> {
    const payload = {
      config: {
        model_id: config.modelId,
        test_suite_id: config.testSuiteId,
        dataset_id: config.datasetId,
        source_path: config.sourcePath,
        prompt_limit: config.promptLimit ?? 25,
        concurrency: config.concurrency ?? 3,
        delay_ms: config.delayMs ?? 1000,
        name: config.name,
      },
    };

    const response = await this.client.request<Record<string, unknown>>(
      'POST',
      '/api/batch-testing/run',
      payload
    );

    return {
      success: (response.success as boolean) ?? true,
      testId: (response.testId as string) ?? (response.test_id as string) ?? '',
      status: (response.status as string) ?? 'started',
      results: response.results as BatchTestRunResponse['results'],
      analyticsUrl: response.analyticsUrl as string | undefined,
    };
  }

  /**
   * Get batch test status
   */
  async status(testId: string): Promise<BatchTestStatusResponse> {
    const response = await this.client.request<Record<string, unknown>>(
      'GET',
      `/api/batch-testing/status/${testId}`
    );

    return {
      testId,
      status: (response.status as BatchTestStatusResponse['status']) ?? 'pending',
      totalPrompts: (response.total_prompts as number) ?? 0,
      completedPrompts: (response.completed_prompts as number) ?? 0,
      failedPrompts: (response.failed_prompts as number) ?? 0,
      startedAt: response.started_at as string | undefined,
      completedAt: response.completed_at as string | undefined,
      error: response.error as string | undefined,
    };
  }

  /**
   * Cancel a running batch test
   */
  async cancel(testId: string): Promise<BatchTestCancelResponse> {
    const response = await this.client.request<Record<string, unknown>>(
      'POST',
      '/api/batch-testing/cancel',
      { test_id: testId }
    );

    return {
      success: (response.success as boolean) ?? true,
      testId,
      message: (response.message as string) ?? 'Cancelled',
    };
  }
}

// ============================================================================
// Analytics Client
// ============================================================================

class AnalyticsClient {
  constructor(private client: FinetuneLabClient) {}

  /**
   * Get traces
   */
  async traces(filters?: TraceFilters): Promise<TracesResponse> {
    const params = new URLSearchParams();

    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    if (filters?.conversationId) params.set('conversation_id', filters.conversationId);
    if (filters?.traceId) params.set('trace_id', filters.traceId);

    const query = params.toString();
    const endpoint = query ? `/api/analytics/traces?${query}` : '/api/analytics/traces';

    return this.client.request<TracesResponse>('GET', endpoint);
  }

  /**
   * Create a trace
   */
  async createTrace(trace: CreateTraceRequest): Promise<{ id: string }> {
    const payload = {
      trace_id: trace.traceId,
      span_id: trace.spanId,
      span_name: trace.spanName,
      start_time: trace.startTime,
      end_time: trace.endTime,
      duration_ms: trace.durationMs,
      operation_type: trace.operationType,
      model_name: trace.modelName,
      model_provider: trace.modelProvider,
      input_tokens: trace.inputTokens,
      output_tokens: trace.outputTokens,
      status: trace.status,
      error_message: trace.errorMessage,
      metadata: trace.metadata,
    };

    return this.client.request<{ id: string }>('POST', '/api/analytics/traces', payload);
  }

  /**
   * Get aggregated analytics data
   */
  async data(filters?: AnalyticsDataFilters): Promise<AnalyticsDataResponse> {
    const params = new URLSearchParams();

    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    if (filters?.granularity) params.set('granularity', filters.granularity);

    const query = params.toString();
    const endpoint = query ? `/api/analytics/data?${query}` : '/api/analytics/data';

    return this.client.request<AnalyticsDataResponse>('GET', endpoint);
  }
}

// ============================================================================
// Main Client
// ============================================================================

const DEFAULT_BASE_URL = 'https://app.finetunelab.com';
const DEFAULT_TIMEOUT = 60000;

export class FinetuneLabClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  /** Batch testing operations (testing scope) */
  public readonly batchTest: BatchTestClient;

  /** Analytics operations (production scope) */
  public readonly analytics: AnalyticsClient;

  constructor(config: FinetuneLabClientConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.FINETUNE_LAB_API_KEY ?? '';
    this.baseUrl = (config.baseUrl ?? process.env.FINETUNE_LAB_API_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;

    if (!this.apiKey) {
      throw new FinetuneLabError(
        'API key required. Pass apiKey in config or set FINETUNE_LAB_API_KEY environment variable.',
        400
      );
    }

    this.batchTest = new BatchTestClient(this);
    this.analytics = new AnalyticsClient(this);
  }

  /**
   * Make an authenticated request to the API
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'finetune-lab-sdk/0.2.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetails: FinetuneLabErrorDetails | undefined;

        try {
          const errorData = await response.json() as Record<string, unknown>;
          const errObj = (errorData.error ?? errorData) as FinetuneLabErrorDetails;
          errorDetails = errObj;
        } catch {
          // Ignore JSON parse errors
        }

        throw new FinetuneLabError(
          errorDetails?.message ?? `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorDetails
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof FinetuneLabError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new FinetuneLabError(`Request timed out after ${this.timeout}ms`, 408);
        }
        throw new FinetuneLabError(error.message, 0);
      }

      throw new FinetuneLabError('Unknown error occurred', 0);
    }
  }

  /**
   * Run inference on a model (production scope)
   */
  async predict(request: PredictRequest): Promise<PredictResponse> {
    if (request.stream) {
      throw new FinetuneLabError('Streaming not yet supported in SDK', 400);
    }

    const payload = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: false,
    };

    return this.request<PredictResponse>('POST', '/api/v1/predict', payload);
  }
}
