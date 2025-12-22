/**
 * Local Training Provider Service
 * 
 * Handles connection and communication with local training server
 * (e.g., FineTune Lab running on localhost:8000)
 * 
 * Phase 2.3: Local Training Connection
 * Date: 2025-10-26
 */

import { LocalProviderConfig, ProviderStatus, ProviderConnection, TrainingConfig } from '@/lib/training/training-config.types';
import { normalizeForBackend } from '@/lib/training/config-builder';

export interface TrainingJobRequest {
  config: Record<string, unknown>;
  dataset_path: string;
  dataset_content?: string;  // Normalized dataset content (JSONL format)
  execution_id: string;
  name?: string;
  user_id?: string;  // User ID for backend persistence
  access_token?: string;  // User access token for authenticated persistence
}

export interface TrainingJobStatus {
  gradient_accumulation_steps: number | undefined;
  batch_size: number | undefined;
  job_id: string;
  job_name?: string;
  model_name?: string;
  model_display_name?: string;
  dataset_name?: string;
  dataset_path?: string | null;
  gpu_total_memory_gb?: number;
  status: 'queued' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  progress: number;
  current_epoch: number;
  total_epochs: number;
  current_step: number;
  total_steps: number;
  loss?: number;
  eval_loss?: number;
  learning_rate?: number;
  max_learning_rate?: number;
  min_learning_rate?: number;
  grad_norm?: number;
  gpu_memory_allocated_gb?: number;
  gpu_memory_reserved_gb?: number;
  gpu_utilization_percent?: number;
  tokens_per_second?: number;
  elapsed_seconds?: number;
  remaining_seconds?: number;
  samples_per_second?: number;
  error?: string;
  started_at?: string;
  completed_at?: string;
  updated_at?: string;
  perplexity?: number;
  train_perplexity?: number;
  best_eval_loss?: number;
  best_epoch?: number;
  best_step?: number;
  best_checkpoint_path?: string;
  epochs_without_improvement?: number;
  loss_trend?: 'improving' | 'degrading' | 'stable' | 'insufficient_data';
  total_samples?: number;
  train_samples?: number;
  val_samples?: number;
  total_tokens_processed?: number;
  warning?: string;
  // Resume tracking fields
  resumed_from_job_id?: string;
  resume_from_checkpoint?: string;
  config?: Record<string, unknown> | null;
}

export class LocalTrainingProvider {
  private config: LocalProviderConfig;
  private status: ProviderStatus = 'disconnected';
  private lastError?: string;

  constructor(config: LocalProviderConfig) {
    this.config = config;
  }

  /**
   * Test connection to local training server
   */
  async validateConnection(): Promise<{ success: boolean; error?: string }> {
    console.log('[LocalProvider] Validating connection to:', this.config.base_url);

    try {
      this.status = 'connecting';

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout_ms || 5000);

      const response = await fetch(`${this.config.base_url}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[LocalProvider] Connection successful:', data);

      this.status = 'connected';
      this.lastError = undefined;

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LocalProvider] Connection failed:', errorMsg);

      this.status = 'error';
      this.lastError = errorMsg;

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Connect to the local training server
   */
  async connect(): Promise<ProviderConnection> {
    const validation = await this.validateConnection();

    return {
      provider: 'local',
      status: this.status,
      config: this.config,
      last_checked: new Date().toISOString(),
      error_message: validation.error,
    };
  }

  /**
   * Submit a training job to the local server
   */
  async executeTraining(request: TrainingJobRequest): Promise<{ job_id: string; success: boolean; error?: string }> {
    console.log('[LocalProvider] Executing training job');

    try {
      if (this.status !== 'connected') {
        const validation = await this.validateConnection();
        if (!validation.success) {
          throw new Error(`Not connected: ${validation.error}`);
        }
      }

      // Normalize config for backend if needed (non-destructive)
      let payload: TrainingJobRequest = request;
      try {
        if (request && request.config) {
          // Check if already normalized (has 'lora' key at top level)
          // ScriptBuilder output always includes 'lora' key
          if ((request.config as any).lora) {
            console.log('[LocalProvider] Config appears already normalized, skipping normalization');
            payload = request;
          } else {
            console.log('[LocalProvider] Normalizing config for backend');
            const normalized = normalizeForBackend(request.config as unknown as TrainingConfig);
            payload = { ...request, config: normalized } as TrainingJobRequest;
          }
        }
      } catch (normErr) {
        console.warn('[LocalProvider] Config normalization skipped:', normErr);
        payload = request;
      }

      const response = await fetch(`${this.config.base_url}/api/training/execute`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Training failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('[LocalProvider] Training job submitted:', { job_id: data.job_id || data.id });

      return {
        job_id: data.job_id || data.id,
        success: true,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LocalProvider] Training execution failed:', errorMsg);

      return {
        job_id: '',
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Get status of a training job
   */
  async getStatus(jobId: string): Promise<TrainingJobStatus | null> {
    console.log('[LocalProvider] Getting status for job:', jobId);

    try {
      const response = await fetch(`${this.config.base_url}/api/training/status/${jobId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get status: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[LocalProvider] Job status:', data);

      return data;
    } catch (error) {
      console.error('[LocalProvider] Failed to get job status:', error);
      return null;
    }
  }

  /**
   * Get status of a training job from database (for completed/failed jobs)
   * This method queries the Next.js API which reads from Supabase,
   * allowing access to job status even after it's removed from backend memory.
   */
  async getStatusFromDatabase(jobId: string, accessToken: string): Promise<TrainingJobStatus | null> {
    console.log('[LocalProvider] Getting status from database for job:', jobId);

    try {
      // Determine base URL (supports both server-side and client-side calls)
      const baseUrl = typeof window !== 'undefined'
        ? '' // Client-side: relative URL
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; // Server-side: absolute URL

      const response = await fetch(`${baseUrl}/api/training/local/${jobId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get status from database: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[LocalProvider] Job status from database:', data);

      return data;
    } catch (error) {
      console.error('[LocalProvider] Failed to get job status from database:', error);
      return null;
    }
  }

  /**
   * Cancel a running training job
   */
  async cancelJob(jobId: string): Promise<{ success: boolean; error?: string }> {
    console.log('[LocalProvider] Canceling job:', jobId);

    try {
      const response = await fetch(`${this.config.base_url}/api/training/cancel/${jobId}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      // Parse response body to check actual success status
      // Server may return 400 status code but still successfully cancel the job
      const data = await response.json();

      if (data.success) {
        console.log('[LocalProvider] Job cancelled successfully:', data.message);
        return { success: true };
      } else {
        // Only treat as error if server explicitly says it failed
        console.warn('[LocalProvider] Cancel returned success=false:', data.message);
        return { success: false, error: data.message || 'Failed to cancel' };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LocalProvider] Failed to cancel job:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Pause a running training job
   */
  async pauseJob(jobId: string): Promise<{ success: boolean; error?: string }> {
    console.log('[LocalProvider] Pausing job:', jobId);

    try {
      const response = await fetch(`${this.config.base_url}/api/training/pause/${jobId}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      // Parse response body to check actual success status
      const data = await response.json();

      if (data.success) {
        console.log('[LocalProvider] Job paused successfully:', data.message);
        return { success: true };
      } else {
        console.warn('[LocalProvider] Pause returned success=false:', data.message);
        return { success: false, error: data.message || 'Failed to pause' };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LocalProvider] Failed to pause job:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Resume a paused training job
   */
  async resumeJob(jobId: string, checkpointPath?: string): Promise<{ success: boolean; error?: string }> {
    console.log('[LocalProvider] Resuming job:', jobId);

    try {
      let url = `${this.config.base_url}/api/training/resume/${jobId}`;
      if (checkpointPath) {
        url += `?checkpoint_path=${encodeURIComponent(checkpointPath)}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      // Parse response body to check actual success status
      const data = await response.json();

      if (data.success) {
        console.log('[LocalProvider] Job resumed successfully:', data.message);
        return { success: true };
      } else {
        console.warn('[LocalProvider] Resume returned success=false:', data.message);
        return { success: false, error: data.message || 'Failed to resume' };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LocalProvider] Failed to resume job:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Force-start a stuck or pending training job
   *
   * Works for jobs in pending, queued, failed, or cancelled status.
   * Different from resumeJob (which only works for paused jobs).
   *
   * Phase 1 - Job State Management Fix
   */
  async forceStartJob(jobId: string): Promise<{ success: boolean; error?: string; queue_position?: number }> {
    console.log('[LocalProvider] Force-starting job:', jobId);

    try {
      const response = await fetch(`${this.config.base_url}/api/training/${jobId}/force-start`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Failed to force-start: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[LocalProvider] Job force-started:', data);

      return {
        success: true,
        queue_position: data.queue_position
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LocalProvider] Failed to force-start job:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ProviderConnection {
    return {
      provider: 'local',
      status: this.status,
      config: this.config,
      last_checked: new Date().toISOString(),
      error_message: this.lastError,
    };
  }

  /**
   * Update provider configuration
   */
  updateConfig(config: Partial<LocalProviderConfig>): void {
    this.config = { ...this.config, ...config };
    this.status = 'disconnected'; // Reset status when config changes
  }

  /**
   * Get HTTP headers for requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (this.config.api_key) {
      headers['Authorization'] = `Bearer ${this.config.api_key}`;
    }

    return headers;
  }
}

console.log('[LocalTrainingProvider] Service loaded');
