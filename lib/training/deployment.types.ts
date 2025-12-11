/**
 * Cloud Deployment Type Definitions
 * Purpose: Type-safe contracts for Kaggle, RunPod, and HuggingFace Spaces deployments
 * Date: 2025-10-31
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

export type DeploymentStatus = 
  | 'queued'
  | 'creating'
  | 'building'
  | 'starting'
  | 'running'
  | 'training'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'stopping'
  | 'stopped';

export interface DeploymentMetrics {
  epoch?: number;
  step?: number;
  loss?: number;
  learning_rate?: number;
  progress_percentage?: number;
  estimated_time_remaining?: number; // seconds
}

export interface DeploymentCost {
  estimated_cost: number; // USD
  actual_cost?: number; // USD
  budget_limit?: number; // USD
  cost_per_hour?: number; // USD/hour
  estimated_hours?: number;
  currency: string; // 'USD'
}

// ============================================================================
// KAGGLE DEPLOYMENT
// ============================================================================

export interface KaggleDeploymentRequest {
  training_config_id: string;
  notebook_title: string;
  notebook_slug?: string;
  is_private?: boolean;
  dataset_sources?: string[]; // Kaggle dataset slugs to attach
  enable_gpu?: boolean;
  enable_internet?: boolean;
}

export interface KaggleDeploymentResponse {
  deployment_id: string;
  notebook_url: string;
  notebook_slug: string;
  status: DeploymentStatus;
  kernel_slug?: string;
  version?: number;
  created_at: string;
}

export interface KaggleDeploymentStatus {
  deployment_id: string;
  status: DeploymentStatus;
  notebook_url: string;
  logs?: string;
  metrics?: DeploymentMetrics;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  output_files?: string[]; // URLs to download outputs
}

// ============================================================================
// RUNPOD DEPLOYMENT
// ============================================================================

export type RunPodGPUType = 
  | 'NVIDIA RTX A4000'
  | 'NVIDIA RTX A5000'
  | 'NVIDIA RTX A6000'
  | 'NVIDIA A40'
  | 'NVIDIA A100 40GB'
  | 'NVIDIA A100 80GB'
  | 'NVIDIA H100';

export interface RunPodDeploymentRequest {
  training_config_id: string;
  gpu_type?: RunPodGPUType;
  gpu_count?: number; // Default: 1
  docker_image?: string; // Default: nvidia/cuda:12.1.0-devel-ubuntu22.04
  volume_size_gb?: number; // Persistent storage, default: 20
  environment_variables?: Record<string, string>;
  budget_limit?: number; // Auto-stop when budget exceeded
}

export interface RunPodDeploymentResponse {
  deployment_id: string;
  pod_id: string;
  pod_url: string;
  status: DeploymentStatus;
  gpu_type: RunPodGPUType;
  gpu_count: number;
  cost: DeploymentCost;
  created_at: string;
}

export interface RunPodDeploymentStatus {
  deployment_id: string;
  pod_id: string;
  status: DeploymentStatus;
  pod_url: string;
  logs?: string;
  metrics?: DeploymentMetrics;
  cost: DeploymentCost;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  checkpoint_urls?: string[]; // URLs to download checkpoints
}

// ============================================================================
// LAMBDA LABS DEPLOYMENT
// ============================================================================

export type LambdaGPUType = 
  | 'gpu_1x_a10'              // A10 24GB - ~$0.60/hr
  | 'gpu_1x_rtx6000'          // RTX 6000 Ada 48GB - ~$0.50/hr
  | 'gpu_1x_a100'             // A100 40GB - $1.29/hr
  | 'gpu_1x_a100_sxm4'        // A100 80GB SXM4 - $1.79/hr
  | 'gpu_8x_a100'             // 8x A100 80GB - $14.32/hr
  | 'gpu_1x_h100_pcie'        // H100 PCIe 80GB - $1.85/hr
  | 'gpu_8x_h100_sxm5';       // 8x H100 SXM5 640GB - $23.92/hr

export interface LambdaDeploymentRequest {
  training_config_id: string;
  instance_type: LambdaGPUType;
  region: string; // e.g., 'us-west-1', 'us-east-1', 'europe-central-1'
  ssh_key_name?: string; // SSH key registered with Lambda Labs
  budget_limit?: number; // Auto-stop when budget exceeded (USD)
}

export interface LambdaDeploymentResponse {
  deployment_id: string;
  instance_id: string;
  instance_ip: string;
  status: DeploymentStatus;
  instance_type: LambdaGPUType;
  region: string;
  cost: DeploymentCost;
  created_at: string;
}

export interface LambdaDeploymentStatus {
  deployment_id: string;
  instance_id: string;
  status: DeploymentStatus;
  instance_ip: string;
  logs?: string;
  metrics?: DeploymentMetrics;
  cost: DeploymentCost;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  checkpoint_urls?: string[]; // URLs to download checkpoints
}

// ============================================================================
// HUGGINGFACE SPACES DEPLOYMENT
// ============================================================================

export type HFSpaceGPUTier = 
  | 'cpu-basic'
  | 't4-small'
  | 't4-medium'
  | 'a10g-small'
  | 'a10g-large'
  | 'a100-large';

export interface HFSpacesDeploymentRequest {
  training_config_id: string;
  space_name: string; // Format: username/space-name
  visibility?: 'public' | 'private'; // Default: private
  gpu_tier?: HFSpaceGPUTier; // Default: t4-small
  budget_limit?: number; // Auto-stop when budget exceeded (USD)
  alert_threshold?: number; // Percentage (0-100), default: 80
  notify_email?: string; // Email for budget alerts
  auto_stop_on_budget?: boolean; // Default: true
}

export interface HFSpacesDeploymentResponse {
  deployment_id: string;
  space_url: string;
  space_id: string;
  status: DeploymentStatus;
  gpu_tier: HFSpaceGPUTier;
  cost: DeploymentCost;
  created_at: string;
}

export interface HFSpacesDeploymentStatus {
  deployment_id: string;
  space_id: string;
  status: DeploymentStatus;
  space_url: string;
  logs?: string;
  metrics?: DeploymentMetrics;
  cost: DeploymentCost;
  budget_alerts_sent?: {
    threshold_80?: boolean;
    threshold_90?: boolean;
    budget_exceeded?: boolean;
  };
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  checkpoint_urls?: string[]; // URLs to download checkpoints
}

// ============================================================================
// UNIFIED DEPLOYMENT TYPES
// ============================================================================

export type DeploymentPlatform = 'kaggle' | 'runpod' | 'lambda' | 'huggingface-spaces' | 'local-vllm' | 'google-colab';

export interface UnifiedDeploymentRequest {
  platform: DeploymentPlatform;
  training_config_id: string;
  config: KaggleDeploymentRequest | RunPodDeploymentRequest | LambdaDeploymentRequest | HFSpacesDeploymentRequest;
}

export interface UnifiedDeploymentResponse {
  deployment_id: string;
  platform: DeploymentPlatform;
  status: DeploymentStatus;
  url: string; // Platform-specific URL
  cost?: DeploymentCost;
  created_at: string;
}

export interface UnifiedDeploymentStatus {
  deployment_id: string;
  platform: DeploymentPlatform;
  status: DeploymentStatus;
  url: string;
  logs?: string;
  metrics?: DeploymentMetrics;
  cost?: DeploymentCost;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  output_urls?: string[]; // Checkpoints or output files
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface DeploymentError {
  code: string;
  message: string;
  details?: string;
  platform?: DeploymentPlatform;
}

// ============================================================================
// DATABASE RECORD TYPES (for storing deployment state)
// ============================================================================

export interface CloudDeploymentRecord {
  id: string;
  user_id: string;
  platform: DeploymentPlatform;
  training_config_id: string;
  deployment_id: string; // External ID (pod_id, space_id, kernel_slug)
  status: DeploymentStatus;
  url: string;
  
  // Configuration snapshot
  config: Record<string, unknown>;
  
  // Cost tracking
  estimated_cost?: number;
  actual_cost?: number;
  budget_limit?: number;
  
  // Metrics
  metrics?: DeploymentMetrics;
  
  // Timestamps
  created_at: string;
  started_at?: string;
  completed_at?: string;
  
  // Logs and outputs
  logs?: string;
  error_message?: string;
  checkpoint_urls?: string[];
}

// ============================================================================
// GOOGLE COLAB DEPLOYMENT
// ============================================================================

export type ColabGPUTier =
  | 'none'        // Free tier - CPU only
  | 't4'          // Colab Pro - T4 GPU
  | 'a100'        // Colab Pro+ - A100 GPU
  | 'v100';       // Legacy - V100 GPU

export interface ColabDeploymentRequest {
  training_config_id: string;
  notebook_name: string;
  gpu_tier?: ColabGPUTier;  // Default: 't4'
  runtime_type?: 'standard' | 'high_ram';  // Default: 'standard'
  enable_tpu?: boolean;  // Default: false
  budget_limit?: number; // Compute units limit
  auto_stop_on_budget?: boolean;  // Default: true
}

export interface ColabDeploymentResponse {
  deployment_id: string;
  notebook_id: string;
  notebook_url: string;
  status: DeploymentStatus;
  gpu_tier: ColabGPUTier;
  runtime_type: string;
  created_at: string;
}

export interface ColabDeploymentStatus {
  deployment_id: string;
  notebook_id: string;
  status: DeploymentStatus;
  notebook_url: string;
  logs?: string;
  metrics?: DeploymentMetrics;
  compute_units_used?: number;
  compute_units_limit?: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  checkpoint_urls?: string[];
}
