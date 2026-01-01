/**
 * Demo Module Types
 * Type definitions for demo page functionality
 * Date: December 15, 2025
 */

// ============================================================================
// Demo Conversation Types
// ============================================================================

export interface DemoConversation {
  id: string;
  demo_user_id: string;
  session_id: string | null;
  experiment_name: string | null;
  model_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemoMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  content_json?: Record<string, unknown>;
  model_id?: string;
  latency_ms?: number;
  token_count?: number;
  created_at: string;
}

// ============================================================================
// Demo Batch Testing Types
// ============================================================================

export type DemoBatchTestStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface DemoBatchTestRun {
  id: string;
  demo_user_id: string;
  model_name: string;
  status: DemoBatchTestStatus;
  total_prompts: number;
  completed_prompts: number;
  failed_prompts: number;
  config: DemoBatchTestConfig;
  started_at: string;
  completed_at?: string;
  error?: string;
  archived: boolean;
  created_at: string;
}

export interface DemoBatchTestConfig {
  model_id: string;
  model_name?: string;
  test_suite_id: string;
  test_suite_name?: string;
  prompt_limit: number;
  concurrency?: number;
  delay_ms?: number;
  custom_name?: string;
  // For A/B comparison
  comparison_model_id?: string;
  comparison_model_name?: string;
  is_comparison_test?: boolean;
}

export interface DemoBatchTestResult {
  id: string;
  test_run_id: string;
  prompt: string;
  response?: string;
  latency_ms?: number;
  success: boolean;
  error?: string;
  model_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at: string;
}

// ============================================================================
// Demo Evaluation Types
// ============================================================================

export interface DemoEvaluation {
  id: string;
  message_id: string;
  demo_user_id: string;
  rating: number; // 1-5
  success: boolean;
  failure_tags?: string[];
  notes?: string;
  expected_behavior?: string;
  created_at: string;
}

export type FailureTag =
  | 'hallucination'
  | 'wrong_tool'
  | 'incomplete'
  | 'incorrect_info'
  | 'off_topic'
  | 'tone_issues';

// ============================================================================
// Demo Comparison Types (A/B Testing)
// ============================================================================

export type PreferenceChoice = 'a' | 'b' | 'tie' | null;
export type DisplayOrder = 'ab' | 'ba';

export interface ComparisonRating {
  clarity: number; // 1-5
  accuracy: number; // 1-5
  conciseness: number; // 1-5
  overall: number; // 1-5
}

export interface DemoComparison {
  id: string;
  demo_user_id: string;
  test_run_id?: string;
  prompt: string;
  // Model A
  model_a_id: string;
  model_a_name?: string;
  model_a_response?: string;
  model_a_latency_ms?: number;
  // Model B
  model_b_id: string;
  model_b_name?: string;
  model_b_response?: string;
  model_b_latency_ms?: number;
  // Results
  preferred_model: PreferenceChoice;
  model_a_rating?: ComparisonRating;
  model_b_rating?: ComparisonRating;
  // Blind comparison
  display_order: DisplayOrder;
  revealed: boolean;
  created_at: string;
}

// ============================================================================
// Demo Test Suite Types
// ============================================================================

export type TaskDomain = 'customer_support' | 'code_generation' | 'qa' | 'creative';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface TestPrompt {
  prompt: string;
  expected_answer?: string;
  category?: string;
}

export interface DemoTestSuite {
  id: string;
  name: string;
  description?: string;
  task_domain: TaskDomain;
  difficulty: Difficulty;
  prompts: TestPrompt[];
  prompt_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Demo Analytics Types
// ============================================================================

export interface DemoAnalyticsCache {
  id: string;
  cache_key: string;
  test_run_id?: string;
  analytics_data: DemoAnalyticsData;
  expires_at: string;
  created_at: string;
}

export interface DemoAnalyticsData {
  summary: {
    total_prompts: number;
    completed_prompts: number;
    failed_prompts: number;
    success_rate: number;
    avg_latency_ms: number;
    p95_latency_ms: number;
  };
  model_comparison?: {
    model_a: ModelStats;
    model_b: ModelStats;
    preference_breakdown: {
      model_a_wins: number;
      model_b_wins: number;
      ties: number;
    };
  };
  rating_distribution: Array<{ rating: number; count: number }>;
  latency_distribution: Array<{ bucket: string; count: number }>;
}

export interface ModelStats {
  model_id: string;
  model_name: string;
  avg_rating: number;
  avg_latency_ms: number;
  success_rate: number;
  total_responses: number;
}

// ============================================================================
// Demo Session Types
// ============================================================================

export interface DemoSession {
  session_id: string;
  experiment_name: string;
  conversation_count: number;
  conversation_ids: string[];
  model_ids: string[];
  created_at: string;
}

// ============================================================================
// Demo API Request/Response Types
// ============================================================================

export interface StartDemoTestRequest {
  test_suite_id: string;
  model_a_id: string;
  model_b_id: string;
  prompt_limit?: number;
  demo_user_id?: string;
}

export interface StartDemoTestResponse {
  test_run_id: string;
  status: DemoBatchTestStatus;
  total_prompts: number;
}

export interface DemoComparisonRequest {
  test_run_id: string;
  prompt: string;
  model_a_response: string;
  model_b_response: string;
  preferred_model: PreferenceChoice;
  model_a_rating?: ComparisonRating;
  model_b_rating?: ComparisonRating;
  display_order: DisplayOrder;
}

export interface DemoAnalyticsRequest {
  test_run_id: string;
  query: string;
}

// ============================================================================
// Demo Configuration Types
// ============================================================================

export interface DemoConfig {
  // Rate limiting
  max_tests_per_hour: number;
  max_prompts_per_test: number;
  // Models allowed for demo
  allowed_models: string[];
  // Default models for comparison
  default_base_model: string;
  default_tuned_model: string;
  // Cleanup
  data_retention_hours: number;
}

export const DEFAULT_DEMO_CONFIG: DemoConfig = {
  max_tests_per_hour: 10,
  max_prompts_per_test: 10,
  allowed_models: [
    'gpt-4o-mini',
    'gpt-4o',
    'claude-3-5-sonnet-20241022',
    'claude-3-haiku-20240307',
  ],
  default_base_model: 'gpt-4o-mini',
  default_tuned_model: 'gpt-4o', // Placeholder - would be a fine-tuned model
  data_retention_hours: 24,
};

// ============================================================================
// Demo State Types (for UI)
// ============================================================================

export type DemoStep =
  | 'welcome'
  | 'task_selection'
  | 'model_selection'
  | 'running_test'
  | 'rating'
  | 'results'
  | 'analytics';

export interface DemoState {
  step: DemoStep;
  selectedTaskDomain?: TaskDomain;
  selectedTestSuite?: DemoTestSuite;
  modelA?: { id: string; name: string };
  modelB?: { id: string; name: string };
  testRunId?: string;
  currentPromptIndex: number;
  comparisons: DemoComparison[];
  isLoading: boolean;
  error?: string;
}

// ============================================================================
// Demo V2 Types (BYOM - Bring Your Own Model)
// ============================================================================

/**
 * Model configuration for user-provided endpoints
 * API key is encrypted at rest
 */
export interface DemoModelConfig {
  id: string;
  session_id: string;
  endpoint_url: string;
  api_key_encrypted: string;
  model_id: string;
  model_name?: string;
  created_at: string;
  expires_at: string;
  connection_tested: boolean;
  connection_latency_ms?: number;
  last_error?: string;
}

/**
 * Request to configure a model endpoint
 */
export interface ConfigureModelRequest {
  endpoint_url: string;
  api_key: string;
  model_id: string;
  model_name?: string;
}

/**
 * Response from model configuration
 */
export interface ConfigureModelResponse {
  session_id: string;
  expires_at: string;
  model_id: string;
  model_name?: string;
}

/**
 * Request to test model connection
 */
export interface TestConnectionRequest {
  session_id: string;
}

/**
 * Response from connection test
 */
export interface TestConnectionResponse {
  success: boolean;
  latency_ms?: number;
  error?: string;
  model_response?: string;
}

/**
 * Demo V2 session state
 */
export interface DemoV2Session {
  session_id: string;
  model_config: {
    endpoint_url: string;
    model_id: string;
    model_name?: string;
  };
  test_run_id?: string;
  status: 'configuring' | 'testing' | 'running' | 'analyzing' | 'exporting' | 'completed';
  created_at: string;
  expires_at: string;
}

/**
 * Demo V2 batch test result with session scoping
 */
export interface DemoV2BatchTestResult extends DemoBatchTestResult {
  demo_session_id: string;
}

/**
 * Demo V2 analytics metrics
 */
export interface DemoV2Metrics {
  total_prompts: number;
  completed_prompts: number;
  failed_prompts: number;
  success_rate: number;
  // Latency metrics
  avg_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  // Token metrics
  total_input_tokens: number;
  total_output_tokens: number;
  avg_response_tokens: number;
  // Response metrics
  avg_response_length: number;
  min_response_length: number;
  max_response_length: number;
}

/**
 * Demo V2 step for wizard UI
 */
export type DemoV2Step =
  | 'welcome'
  | 'task_selection'
  | 'model_config'
  | 'running_test'
  | 'atlas_chat'
  | 'export';

/**
 * Demo V2 UI state
 */
export interface DemoV2State {
  step: DemoV2Step;
  session_id?: string;
  selectedTaskDomain?: TaskDomain;
  selectedTestSuite?: DemoTestSuite;
  modelConfig?: {
    endpoint_url: string;
    model_id: string;
    model_name?: string;
    connection_tested: boolean;
  };
  test_run_id?: string;
  progress: number;
  results: DemoV2BatchTestResult[];
  metrics?: DemoV2Metrics;
  isLoading: boolean;
  error?: string;
}

/**
 * Supported model providers (for preset configurations)
 */
export type ModelProvider =
  | 'together'
  | 'fireworks'
  | 'openrouter'
  | 'groq'
  | 'vllm'
  | 'ollama'
  | 'custom';

/**
 * Provider preset configuration
 */
export interface ProviderPreset {
  provider: ModelProvider;
  name: string;
  base_url: string;
  docs_url: string;
  example_model_id: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    provider: 'together',
    name: 'Together.ai',
    base_url: 'https://api.together.xyz/v1/chat/completions',
    docs_url: 'https://docs.together.ai',
    example_model_id: 'meta-llama/Llama-2-7b-chat-hf',
  },
  {
    provider: 'fireworks',
    name: 'Fireworks.ai',
    base_url: 'https://api.fireworks.ai/inference/v1/chat/completions',
    docs_url: 'https://docs.fireworks.ai',
    example_model_id: 'accounts/fireworks/models/llama-v2-7b-chat',
  },
  {
    provider: 'openrouter',
    name: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1/chat/completions',
    docs_url: 'https://openrouter.ai/docs',
    example_model_id: 'meta-llama/llama-2-7b-chat',
  },
  {
    provider: 'groq',
    name: 'Groq',
    base_url: 'https://api.groq.com/openai/v1/chat/completions',
    docs_url: 'https://console.groq.com/docs',
    example_model_id: 'llama2-70b-4096',
  },
  {
    provider: 'vllm',
    name: 'vLLM (Self-hosted)',
    base_url: 'http://localhost:8000/v1/chat/completions',
    docs_url: 'https://docs.vllm.ai',
    example_model_id: 'your-model-name',
  },
  {
    provider: 'ollama',
    name: 'Ollama (Local)',
    base_url: 'http://localhost:11434/v1/chat/completions',
    docs_url: 'https://ollama.ai/docs',
    example_model_id: 'llama2',
  },
];
