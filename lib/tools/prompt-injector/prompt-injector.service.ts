// Prompt Injector Tool - Service Implementation
// Date: October 16, 2025

import type { InjectionOptions, PromptInjectionResult, BatchInjectionResult } from './types';

async function sendPrompt(
  prompt: string,
  options: InjectionOptions
): Promise<PromptInjectionResult> {
  const { endpoint, apiKey, headers = {} } = options;
  const start = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        ...headers,
      },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    return {
      prompt,
      response: data.response || '',
      status: 'success',
      responseTimeMs: Date.now() - start,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      prompt,
      response: '',
      status: 'error',
      responseTimeMs: Date.now() - start,
      error: errMsg || 'Unknown error',
    };
  }
}

export async function injectBatch(
  prompts: string[],
  options: InjectionOptions
): Promise<BatchInjectionResult> {
  const startedAt = new Date().toISOString();
  const results: PromptInjectionResult[] = [];
  const parallelism = options.parallelism && options.parallelism > 0 ? options.parallelism : 1;
  const delayMs = options.delayMs || 0;

  // Helper for concurrency
  async function processBatch(batch: string[]) {
    return await Promise.all(batch.map(prompt => sendPrompt(prompt, options)));
  }

  let idx = 0;
  while (idx < prompts.length) {
    const batch = prompts.slice(idx, idx + parallelism);
    const batchResults = await processBatch(batch);
    results.push(...batchResults);
    idx += parallelism;
    if (delayMs > 0 && idx < prompts.length) {
      await new Promise(res => setTimeout(res, delayMs));
    }
  }

  const finishedAt = new Date().toISOString();

  // Metrics aggregation
  const latencies = results.map(r => r.responseTimeMs);
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const total = results.length;
  const metrics = {
    avgLatencyMs: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    minLatencyMs: latencies.length ? Math.min(...latencies) : 0,
    maxLatencyMs: latencies.length ? Math.max(...latencies) : 0,
    errorRate: total ? errorCount / total : 0,
    successRate: total ? successCount / total : 0,
  };

  return {
    results,
    total,
    successCount,
    errorCount,
    startedAt,
    finishedAt,
    metrics,
  };
}
