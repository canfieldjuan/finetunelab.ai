// Batch Testing - Type Definitions
// Date: October 18, 2025

/**
 * Batch test run record - tracks overall test execution
 */
export interface BatchTestRun {
  id: string;
  user_id: string;
  model_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_prompts: number;
  completed_prompts: number;
  failed_prompts: number;
  started_at: string;
  completed_at?: string;
  config: BatchTestConfig;
  error?: string;
}

/**
 * Configuration for batch test execution
 */
export interface BatchTestConfig {
  model_name: string;
  huggingface_api_key?: string;  // Optional: For HuggingFace adapter fallback
  prompt_limit: number;
  concurrency: number;
  delay_ms: number;
  source_path: string;
  benchmark_id?: string;  // Optional: Link to benchmark for task-specific evaluation
}

/**
 * Individual test result for a single prompt
 */
export interface BatchTestResult {
  test_run_id: string;
  prompt: string;
  response: string;
  conversation_id: string;
  latency_ms: number;
  success: boolean;
  error?: string;
}
