/**
 * Training Execution Types
 * Purpose: Type definitions for training execution API
 * Date: 2025-10-24
 */

export type TrainingProvider = 'colab' | 'huggingface' | 'openai' | 'local';
export type TrainingMethod = 'sft' | 'dpo' | 'rlhf' | 'orpo';

/**
 * Request to execute training
 */
export interface TrainingExecutionRequest {
  public_id: string;
  method: TrainingMethod;
  provider: TrainingProvider;
  output_dir?: string;
  callback_url?: string;

  // OpenAI-specific options
  openai_model?: string;
  openai_n_epochs?: number;
  openai_batch_size?: number;
  openai_learning_rate_multiplier?: number;
}

/**
 * Response from training execution request
 */
export interface TrainingExecutionResponse {
  execution_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  provider: TrainingProvider;

  // Provider-specific URLs
  colab_url?: string;
  huggingface_url?: string;
  openai_job_id?: string;

  message: string;
  started_at: string;
}

/**
 * Training execution status response
 */
export interface TrainingStatusResponse {
  execution_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  logs?: string[];
  error?: string;

  // Results when completed
  result?: {
    model_path?: string;
    model_id?: string;
    metrics?: Record<string, number>;

    // OpenAI-specific results
    openai_fine_tuned_model?: string;
    openai_job_id?: string;
  };
}
