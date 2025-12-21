/**
 * Inference Deployment Type Definitions
 * Purpose: Type-safe contracts for RunPod Serverless, HF Endpoints, Modal, Replicate deployments
 * Date: 2025-11-12
 * Feature: Production inference endpoint deployment for serving fine-tuned models
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

/**
 * Inference deployment status
 */
export type InferenceStatus =
  | 'deploying'    // Initial deployment in progress
  | 'active'       // Running and accepting requests
  | 'failed'       // Deployment failed
  | 'stopped'      // Manually stopped
  | 'scaling'      // Auto-scaling in progress
  | 'error';       // Runtime error state

/**
 * Supported inference providers
 */
export type InferenceProvider =
  | 'runpod-serverless'  // MVP - RunPod Serverless endpoints
  | 'hf-endpoints'       // Future - HuggingFace Inference Endpoints
  | 'modal'              // Future - Modal serverless
  | 'replicate';         // Future - Replicate API

/**
 * Model artifact type
 */
export type ModelType =
  | 'lora-adapter'      // LoRA adapter (MVP - smaller, faster)
  | 'merged-model'      // Full merged model
  | 'quantized'         // Quantized model (4-bit, 8-bit)
  | 'gguf';             // GGUF format for llama.cpp

/**
 * Performance metrics for inference endpoints
 */
export interface InferenceMetrics {
  // Request metrics
  total_requests?: number;
  successful_requests?: number;
  failed_requests?: number;

  // Performance metrics
  avg_latency_ms?: number;
  p95_latency_ms?: number;
  p99_latency_ms?: number;

  // Throughput
  requests_per_minute?: number;
  tokens_per_second?: number;

  // Resource usage
  gpu_utilization_percent?: number;
  memory_usage_mb?: number;

  // Timestamps
  last_request_at?: string;
  uptime_seconds?: number;
}

/**
 * Cost tracking for inference deployments
 */
export interface InferenceCost {
  cost_per_request: number;  // USD per API request
  budget_limit: number;      // User-set budget limit (USD)
  current_spend: number;     // Current spending (USD)
  request_count: number;     // Total requests made
  estimated_daily_cost?: number;  // Projected daily cost based on usage
  cost_alerts?: {
    threshold_50?: boolean;  // 50% budget alert sent
    threshold_80?: boolean;  // 80% budget alert sent
    budget_exceeded?: boolean;  // 100% budget alert sent
  };
}

// ============================================================================
// RUNPOD SERVERLESS DEPLOYMENT (MVP)
// ============================================================================

/**
 * RunPod Serverless GPU types
 * Pay-per-request pricing, auto-scaling
 */
export type RunPodServerlessGPU =
  | 'NVIDIA RTX A4000'
  | 'NVIDIA RTX A5000'
  | 'NVIDIA RTX A6000'
  | 'NVIDIA A40'
  | 'NVIDIA A100 40GB'
  | 'NVIDIA A100 80GB'
  | 'NVIDIA H100';

/**
 * RunPod Serverless deployment request
 */
export interface RunPodServerlessDeploymentRequest {
  // Source information
  training_config_id?: string;  // Optional - if deploying from training
  training_job_id?: string;     // Optional - specific training job
  model_artifact_id?: string;   // Optional - specific artifact

  // Deployment configuration
  deployment_name: string;      // User-friendly name
  model_storage_url: string;    // HuggingFace Hub URL or S3 URL
  base_model: string;           // Base model identifier (e.g., 'meta-llama/Llama-2-7b-hf')
  model_type: ModelType;        // Type of model artifact

  // Resource configuration
  gpu_type?: RunPodServerlessGPU;  // Default: 'NVIDIA RTX A4000'
  min_workers?: number;         // Minimum active workers (0 = scale to zero)
  max_workers?: number;         // Maximum workers for scaling
  idle_timeout_seconds?: number;  // Timeout before scaling down

  // RunPod Serverless requires a template for endpoint creation
  // Templates define the container image, environment, and handler
  template_id?: string;         // RunPod template ID (required for GraphQL saveEndpoint)

  // Budget controls
  budget_limit: number;         // Required - USD budget limit
  auto_stop_on_budget?: boolean;  // Default: true

  // Runtime configuration
  environment_variables?: Record<string, string>;
  docker_image?: string;        // Custom inference image
  max_concurrency?: number;     // Requests per worker
}

/**
 * RunPod Serverless deployment response
 */
export interface RunPodServerlessDeploymentResponse {
  deployment_id: string;        // Internal deployment ID
  endpoint_id: string;          // RunPod endpoint ID
  endpoint_url: string;         // Inference API URL
  status: InferenceStatus;
  network_volume_id?: string;   // ID of the attached network volume

  // Configuration
  gpu_type: RunPodServerlessGPU;
  model_type: ModelType;
  base_model: string;

  // Cost information
  cost: InferenceCost;

  // Timestamps
  created_at: string;
  deployed_at?: string;
}

/**
 * RunPod Serverless deployment status
 */
export interface RunPodServerlessDeploymentStatus {
  deployment_id: string;
  endpoint_id: string;
  endpoint_url: string;
  status: InferenceStatus;

  // Metrics
  metrics?: InferenceMetrics;

  // Cost tracking
  cost: InferenceCost;

  // Error information
  error_message?: string;

  // Timestamps
  started_at?: string;
  stopped_at?: string;
  last_checked_at: string;
}

// ============================================================================
// HUGGINGFACE INFERENCE ENDPOINTS (FUTURE)
// ============================================================================

/**
 * HuggingFace Inference Endpoint tiers
 */
export type HFEndpointTier =
  | 'cpu-small'
  | 'cpu-medium'
  | 'gpu-small'     // 1x NVIDIA T4
  | 'gpu-medium'    // 1x NVIDIA A10G
  | 'gpu-large';    // 1x NVIDIA A100

/**
 * HuggingFace Inference Endpoint deployment request
 */
export interface HFEndpointDeploymentRequest {
  training_config_id?: string;
  deployment_name: string;
  model_storage_url: string;  // HF Hub model ID
  base_model: string;
  model_type: ModelType;

  // HF-specific configuration
  tier?: HFEndpointTier;
  min_replicas?: number;
  max_replicas?: number;

  // Budget controls
  budget_limit: number;
  auto_stop_on_budget?: boolean;
}

/**
 * HuggingFace Inference Endpoint deployment response
 */
export interface HFEndpointDeploymentResponse {
  deployment_id: string;
  endpoint_id: string;
  endpoint_url: string;
  status: InferenceStatus;
  tier: HFEndpointTier;
  cost: InferenceCost;
  created_at: string;
}

/**
 * HuggingFace Inference Endpoint status
 */
export interface HFEndpointDeploymentStatus {
  deployment_id: string;
  endpoint_id: string;
  endpoint_url: string;
  status: InferenceStatus;
  metrics?: InferenceMetrics;
  cost: InferenceCost;
  error_message?: string;
  started_at?: string;
  stopped_at?: string;
}

// ============================================================================
// UNIFIED INFERENCE DEPLOYMENT TYPES
// ============================================================================

/**
 * Unified deployment request (any provider)
 */
export interface InferenceDeploymentRequest {
  provider: InferenceProvider;
  config: RunPodServerlessDeploymentRequest | HFEndpointDeploymentRequest;
}

/**
 * Unified deployment response (any provider)
 */
export interface InferenceDeploymentResponse {
  deployment_id: string;
  provider: InferenceProvider;
  endpoint_url: string;
  status: InferenceStatus;
  cost: InferenceCost;
  created_at: string;
}

/**
 * Unified deployment status (any provider)
 */
export interface InferenceDeploymentStatus {
  deployment_id: string;
  provider: InferenceProvider;
  endpoint_url: string;
  status: InferenceStatus;
  metrics?: InferenceMetrics;
  cost: InferenceCost;
  error_message?: string;
  started_at?: string;
  stopped_at?: string;
  last_checked_at: string;
}

// ============================================================================
// DATABASE RECORD TYPES
// ============================================================================

/**
 * Inference deployment database record
 * Matches: supabase/migrations/20251216000009_create_inference_deployments.sql
 */
export interface InferenceDeploymentRecord {
  // Primary identification
  id: string;
  user_id: string;

  // Training source (optional)
  training_config_id?: string;
  training_job_id?: string;
  model_artifact_id?: string;

  // Provider and external IDs
  provider: InferenceProvider;
  deployment_name: string;
  deployment_id: string;      // External ID from provider
  endpoint_url: string;

  // Status
  status: InferenceStatus;

  // Configuration snapshot
  config: Record<string, unknown>;

  // Model information
  model_type?: string;
  base_model?: string;
  model_storage_url?: string;

  // Cost tracking
  cost_per_request?: number;
  budget_limit?: number;
  current_spend: number;
  request_count: number;

  // Timestamps
  created_at: string;
  deployed_at?: string;
  stopped_at?: string;
  updated_at: string;

  // Error handling and metrics
  error_message?: string;
  metrics?: InferenceMetrics;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Inference deployment error
 */
export interface InferenceDeploymentError {
  code: string;
  message: string;
  details?: string;
  provider?: InferenceProvider;
  deployment_id?: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * API request to create deployment
 */
export interface CreateInferenceDeploymentApiRequest {
  provider: InferenceProvider;
  deployment_name: string;

  // Source (at least one required)
  training_config_id?: string;
  training_job_id?: string;
  model_artifact_id?: string;
  model_storage_url?: string;  // For external models

  // Model info
  base_model: string;
  model_type: ModelType;

  // Provider-specific config
  gpu_type?: RunPodServerlessGPU | HFEndpointTier;
  min_workers?: number;
  max_workers?: number;

  // Budget (required)
  budget_limit: number;
  auto_stop_on_budget?: boolean;

  // Runtime config
  environment_variables?: Record<string, string>;
}

/**
 * API response for create deployment
 */
export interface CreateInferenceDeploymentApiResponse {
  success: boolean;
  deployment_id?: string;
  endpoint_url?: string;
  status?: InferenceStatus;
  error?: InferenceDeploymentError;
}

/**
 * API response for get deployment status
 */
export interface GetInferenceDeploymentStatusApiResponse {
  success: boolean;
  deployment?: InferenceDeploymentStatus;
  error?: InferenceDeploymentError;
}

/**
 * API response for stop deployment
 */
export interface StopInferenceDeploymentApiResponse {
  success: boolean;
  deployment_id?: string;
  status?: InferenceStatus;
  error?: InferenceDeploymentError;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Deployment list filter
 */
export interface InferenceDeploymentFilter {
  user_id?: string;
  provider?: InferenceProvider;
  status?: InferenceStatus;
  training_config_id?: string;
  limit?: number;
  offset?: number;
}

/**
 * Deployment list response
 */
export interface InferenceDeploymentListResponse {
  deployments: InferenceDeploymentRecord[];
  total: number;
  limit: number;
  offset: number;
}
