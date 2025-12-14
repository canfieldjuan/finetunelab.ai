/**
 * FineTune Lab SDK
 * Date: 2025-12-12
 *
 * Official SDK for FineTune Lab API.
 *
 * @example
 * ```typescript
 * import { FinetuneLabClient } from '@finetune-lab/sdk';
 *
 * const client = new FinetuneLabClient({ apiKey: 'wak_xxx' });
 *
 * // Inference
 * const response = await client.predict({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 *
 * // Batch Testing
 * const test = await client.batchTest.run({
 *   modelId: 'gpt-4',
 *   testSuiteId: 'suite_123',
 * });
 *
 * // Analytics
 * const traces = await client.analytics.traces({ limit: 10 });
 * ```
 */

export { FinetuneLabClient, FinetuneLabError } from './client';

export type {
  // Client config
  FinetuneLabClientConfig,
  // Predict types
  Message,
  PredictRequest,
  PredictResponse,
  // Batch testing types
  BatchTestConfig,
  BatchTestRunResponse,
  BatchTestStatusResponse,
  BatchTestCancelResponse,
  // Analytics types
  TraceFilters,
  Trace,
  TracesResponse,
  CreateTraceRequest,
  AnalyticsDataFilters,
  AnalyticsDataResponse,
  // Error types
  FinetuneLabErrorDetails,
} from './types';
