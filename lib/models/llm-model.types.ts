// LLM Model Types
// TypeScript types for dynamic model registry
// Date: 2025-10-14

// ============================================================================
// DATABASE TYPES
// ============================================================================

export type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'huggingface'
  | 'ollama'
  | 'vllm'
  | 'azure'
  | 'github'
  | 'kaggle'
  | 'runpod'
  | 'lambda'    // Lambda Labs cloud GPU provider
  | 'aws'       // AWS SageMaker and S3
  | 'fireworks' // Fireworks.ai - fast inference with <1s cold starts
  | 'openrouter'  // OpenRouter aggregator - 200+ models
  | 'together'    // Together.ai - open-source models
  | 'groq'        // Groq - ultra-fast LPU inference
  | 'google-colab'
  | 'local'     // Local model deployment (vLLM/Ollama)
  | 'custom';

export type AuthType =
  | 'bearer'      // Authorization: Bearer {token}
  | 'api_key'     // X-API-Key: {key} or similar
  | 'custom_header'  // Custom headers in auth_headers
  | 'none';       // No authentication

export interface LLMModel {
  id: string;
  user_id: string | null;

  // Display
  name: string;
  description: string | null;
  provider: ModelProvider;

  // Endpoint
  base_url: string;
  model_id: string;
  served_model_name: string | null; // vLLM/Ollama: name used in API requests (different from model_id path)

  // Authentication (encrypted in DB)
  auth_type: AuthType;
  api_key_encrypted: string | null;
  auth_headers: Record<string, string>;

  // Capabilities
  supports_streaming: boolean;
  supports_functions: boolean;
  supports_vision: boolean;
  context_length: number;
  max_output_tokens: number;

  // Pricing
  price_per_input_token: number | null;
  price_per_output_token: number | null;

  // Defaults
  default_temperature: number;
  default_top_p: number;

  // Status
  enabled: boolean;
  is_global: boolean;
  is_default: boolean; // User's default model for chat interface

  // Training Metadata (optional - for custom trained models)
  training_method: string | null; // e.g., "sft", "dpo", "rlhf"
  base_model: string | null; // e.g., "Qwen/Qwen3-0.6B"
  training_dataset: string | null; // e.g., "ToolBench", "PC Building"
  training_date: string | null; // ISO 8601 timestamp
  lora_config: Record<string, unknown> | null; // e.g., {r: 8, alpha: 32, dropout: 0.05}
  evaluation_metrics: Record<string, unknown> | null; // e.g., {accuracy: 0.95, loss: 0.18}

  // Deployment Metadata (for vLLM/Ollama deployments)
  metadata: Record<string, unknown> | null; // e.g., {training_job_id, server_id, deployed_at, model_path, checkpoint_path}

  // Audit
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

// ============================================================================
// DTO TYPES (for API requests/responses)
// ============================================================================

export interface CreateModelDTO {
  name: string;
  description?: string;
  provider: ModelProvider;
  base_url: string;
  model_id: string;
  auth_type: AuthType;
  api_key?: string;  // Plain text, will be encrypted
  auth_headers?: Record<string, string>;
  supports_streaming?: boolean;
  supports_functions?: boolean;
  supports_vision?: boolean;
  context_length?: number;
  max_output_tokens?: number;
  price_per_input_token?: number;
  price_per_output_token?: number;
  default_temperature?: number;
  default_top_p?: number;
  enabled?: boolean;
  is_default?: boolean; // Set as user's default model
  // Training metadata (optional)
  training_method?: string;
  base_model?: string;
  training_dataset?: string;
  training_date?: string;
  lora_config?: Record<string, unknown>;
  evaluation_metrics?: Record<string, unknown>;
}

export interface UpdateModelDTO {
  name?: string;
  description?: string;
  base_url?: string;
  model_id?: string;
  auth_type?: AuthType;
  api_key?: string;  // Plain text, will be encrypted
  auth_headers?: Record<string, string>;
  supports_streaming?: boolean;
  supports_functions?: boolean;
  supports_vision?: boolean;
  context_length?: number;
  max_output_tokens?: number;
  price_per_input_token?: number;
  price_per_output_token?: number;
  default_temperature?: number;
  default_top_p?: number;
  enabled?: boolean;
  is_default?: boolean; // Set as user's default model
  // Training metadata (optional)
  training_method?: string;
  base_model?: string;
  training_dataset?: string;
  training_date?: string;
  lora_config?: Record<string, unknown>;
  evaluation_metrics?: Record<string, unknown>;
}

// ============================================================================
// DISPLAY TYPES (for UI, with decrypted API key hidden)
// ============================================================================

export interface LLMModelDisplay extends Omit<LLMModel, 'api_key_encrypted'> {
  has_api_key: boolean;
  api_key_preview?: string;  // e.g., "sk-proj-...abc123"
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

export interface ModelTemplate {
  id: string;
  name: string;
  provider: ModelProvider;
  description: string;
  base_url: string;
  model_id: string;
  auth_type: AuthType;
  supports_streaming: boolean;
  supports_functions: boolean;
  supports_vision: boolean;
  context_length: number;
  max_output_tokens: number;
  price_per_input_token?: number;
  price_per_output_token?: number;
  default_temperature: number;
  default_top_p: number;
  placeholder_api_key?: string;  // Help text for API key field
}

// ============================================================================
// CONNECTION TEST TYPES
// ============================================================================

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
  model_info?: {
    name?: string;
    version?: string;
    capabilities?: string[];
  };
  error?: string;
}

// ============================================================================
// MODEL CONFIG (for runtime use with decrypted credentials)
// ============================================================================

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  base_url: string;
  model_id: string;
  served_model_name: string | null; // vLLM/Ollama: name used in API requests
  auth_type: AuthType;
  api_key?: string;  // Decrypted at runtime
  auth_headers: Record<string, string>;
  supports_streaming: boolean;
  supports_functions: boolean;
  supports_vision: boolean;
  context_length: number;
  max_output_tokens: number;
  default_temperature: number;
  default_top_p: number;
  is_chat_model?: boolean; // Override auto-detection: true=chat format, false=completion format, undefined=auto-detect
}
