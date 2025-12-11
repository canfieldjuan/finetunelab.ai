// Batch Testing - Type Definitions
// Date: October 18, 2025
// Updated: December 3, 2025 - Added test suite types

/**
 * Test suite record - stores test prompts and expected answers
 */
export interface TestSuite {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  prompts: string[];
  expected_answers?: string[];  // Optional: Ground truth answers for validation
  prompt_count: number;
  created_at: string;
  updated_at: string;
}

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
 * Session tag configuration for analytics tracking
 */
export interface SessionTag {
  session_id: string;
  experiment_name?: string;
}

/**
 * LLM Judge configuration for quality evaluation
 */
export interface JudgeConfig {
  enabled: boolean;
  model: string;
  criteria: string[];
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
  test_run_name?: string;  // Optional: Custom name for the test run
  test_suite_name?: string;  // Automatically populated from test suite
  custom_name?: string;  // Generated or custom name stored in database
  session_tag?: SessionTag;  // Optional: Session tagging for analytics
  judge_config?: JudgeConfig;  // Optional: LLM judge for quality evaluation
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
