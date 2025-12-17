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

// ============================================================================
// SCHEDULED EVALUATIONS TYPES
// Added: 2025-12-16
// Purpose: Support recurring automated batch test evaluations
// Breaking Changes: NONE (new types only)
// ============================================================================

/**
 * Schedule type - defines how often evaluations run
 */
export type ScheduleType = 'hourly' | 'daily' | 'weekly' | 'custom';

/**
 * Scheduled evaluation record - stores recurring evaluation configuration
 */
export interface ScheduledEvaluation {
  id: string;
  user_id: string;

  // Schedule identification
  name: string;
  description?: string;

  // Schedule configuration
  schedule_type: ScheduleType;
  cron_expression?: string;
  timezone: string;

  // Test configuration
  test_suite_id: string;
  model_id: string;
  batch_test_config: BatchTestConfig;

  // Status tracking
  is_active: boolean;
  last_run_at?: string;
  next_run_at: string;
  last_run_status?: 'success' | 'failed' | 'cancelled';
  last_run_id?: string;
  consecutive_failures: number;

  // Alerting configuration
  alert_on_failure: boolean;
  alert_on_regression: boolean;
  regression_threshold_percent: number;

  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Scheduled evaluation run record - tracks execution history
 */
export interface ScheduledEvaluationRun {
  id: string;
  scheduled_evaluation_id: string;
  batch_test_run_id?: string;

  // Execution tracking
  status: 'triggered' | 'running' | 'completed' | 'failed' | 'cancelled';
  triggered_at: string;
  started_at?: string;
  completed_at?: string;

  // Results summary (denormalized for quick queries)
  total_prompts?: number;
  successful_prompts?: number;
  failed_prompts?: number;
  avg_latency_ms?: number;
  avg_quality_score?: number;

  // Regression detection (Phase 2 feature)
  regression_detected: boolean;
  regression_details?: Record<string, unknown>;
  baseline_run_id?: string;

  // Error tracking
  error_message?: string;
  error_details?: Record<string, unknown>;

  created_at: string;
}
