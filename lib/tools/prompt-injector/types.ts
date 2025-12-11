// Prompt Injector Tool - Type Definitions
// Date: October 16, 2025

export interface PromptInjectionResult {
  prompt: string;
  response: string;
  status: 'success' | 'error';
  responseTimeMs: number;
  error?: string;
}

export interface BatchInjectionMetrics {
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  errorRate: number;
  successRate: number;
}

export interface BatchInjectionResult {
  results: PromptInjectionResult[];
  total: number;
  successCount: number;
  errorCount: number;
  startedAt: string;
  finishedAt: string;
  metrics?: BatchInjectionMetrics;
}

export interface InjectionOptions {
  endpoint: string;
  apiKey?: string;
  parallelism?: number;
  delayMs?: number;
  headers?: Record<string, string>;
}
