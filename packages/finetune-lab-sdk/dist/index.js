"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  FinetuneLabClient: () => FinetuneLabClient,
  FinetuneLabError: () => FinetuneLabError
});
module.exports = __toCommonJS(index_exports);

// src/client.ts
var FinetuneLabError = class extends Error {
  constructor(message, statusCode = 0, details) {
    super(message);
    this.name = "FinetuneLabError";
    this.statusCode = statusCode;
    this.type = details?.type;
    this.details = details;
  }
};
var BatchTestClient = class {
  constructor(client) {
    this.client = client;
  }
  /**
   * Run a batch test
   */
  async run(config) {
    const payload = {
      config: {
        model_id: config.modelId,
        test_suite_id: config.testSuiteId,
        dataset_id: config.datasetId,
        source_path: config.sourcePath,
        prompt_limit: config.promptLimit ?? 25,
        concurrency: config.concurrency ?? 3,
        delay_ms: config.delayMs ?? 1e3,
        name: config.name
      }
    };
    const response = await this.client.request(
      "POST",
      "/api/batch-testing/run",
      payload
    );
    return {
      success: response.success ?? true,
      testId: response.testId ?? response.test_id ?? "",
      status: response.status ?? "started",
      results: response.results,
      analyticsUrl: response.analyticsUrl
    };
  }
  /**
   * Get batch test status
   */
  async status(testId) {
    const response = await this.client.request(
      "GET",
      `/api/batch-testing/status/${testId}`
    );
    return {
      testId,
      status: response.status ?? "pending",
      totalPrompts: response.total_prompts ?? 0,
      completedPrompts: response.completed_prompts ?? 0,
      failedPrompts: response.failed_prompts ?? 0,
      startedAt: response.started_at,
      completedAt: response.completed_at,
      error: response.error
    };
  }
  /**
   * Cancel a running batch test
   */
  async cancel(testId) {
    const response = await this.client.request(
      "POST",
      "/api/batch-testing/cancel",
      { test_id: testId }
    );
    return {
      success: response.success ?? true,
      testId,
      message: response.message ?? "Cancelled"
    };
  }
};
var AnalyticsClient = class {
  constructor(client) {
    this.client = client;
  }
  /**
   * Get traces
   */
  async traces(filters) {
    const params = new URLSearchParams();
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.offset) params.set("offset", String(filters.offset));
    if (filters?.conversationId) params.set("conversation_id", filters.conversationId);
    if (filters?.traceId) params.set("trace_id", filters.traceId);
    const query = params.toString();
    const endpoint = query ? `/api/analytics/traces?${query}` : "/api/analytics/traces";
    return this.client.request("GET", endpoint);
  }
  /**
   * Create a trace
   */
  async createTrace(trace) {
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
      metadata: trace.metadata
    };
    return this.client.request("POST", "/api/analytics/traces", payload);
  }
  /**
   * Get aggregated analytics data
   */
  async data(filters) {
    const params = new URLSearchParams();
    if (filters?.startDate) params.set("startDate", filters.startDate);
    if (filters?.endDate) params.set("endDate", filters.endDate);
    if (filters?.granularity) params.set("granularity", filters.granularity);
    const query = params.toString();
    const endpoint = query ? `/api/analytics/data?${query}` : "/api/analytics/data";
    return this.client.request("GET", endpoint);
  }
};
var DEFAULT_BASE_URL = "https://app.finetunelab.com";
var DEFAULT_TIMEOUT = 6e4;
var FinetuneLabClient = class {
  constructor(config = {}) {
    this.apiKey = config.apiKey ?? process.env.FINETUNE_LAB_API_KEY ?? "";
    this.baseUrl = (config.baseUrl ?? process.env.FINETUNE_LAB_API_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    if (!this.apiKey) {
      throw new FinetuneLabError(
        "API key required. Pass apiKey in config or set FINETUNE_LAB_API_KEY environment variable.",
        400
      );
    }
    this.batchTest = new BatchTestClient(this);
    this.analytics = new AnalyticsClient(this);
  }
  /**
   * Make an authenticated request to the API
   */
  async request(method, endpoint, body) {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json",
          "User-Agent": "finetune-lab-sdk/0.2.0"
        },
        body: body ? JSON.stringify(body) : void 0,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        let errorDetails;
        try {
          const errorData = await response.json();
          const errObj = errorData.error ?? errorData;
          errorDetails = errObj;
        } catch {
        }
        throw new FinetuneLabError(
          errorDetails?.message ?? `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorDetails
        );
      }
      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof FinetuneLabError) {
        throw error;
      }
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new FinetuneLabError(`Request timed out after ${this.timeout}ms`, 408);
        }
        throw new FinetuneLabError(error.message, 0);
      }
      throw new FinetuneLabError("Unknown error occurred", 0);
    }
  }
  /**
   * Run inference on a model (production scope)
   */
  async predict(request) {
    if (request.stream) {
      throw new FinetuneLabError("Streaming not yet supported in SDK", 400);
    }
    const payload = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: false
    };
    return this.request("POST", "/api/v1/predict", payload);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FinetuneLabClient,
  FinetuneLabError
});
