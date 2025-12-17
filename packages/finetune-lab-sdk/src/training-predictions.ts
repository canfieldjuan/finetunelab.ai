/**
 * FineTune Lab Training Predictions Client
 * Date: 2025-12-16
 *
 * Retrieve model predictions generated during training.
 * Requires API key with 'training' scope.
 */

import type { FinetuneLabClient } from './client';
import { FinetuneLabError } from './client';
import type { FinetuneLabErrorDetails } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TrainingPrediction {
  id: string;
  job_id: string;
  epoch: number;
  step: number;
  sample_index: number;
  prompt: string;
  prediction: string;
  created_at: string;
  ground_truth?: string;
  exact_match?: number;
  char_error_rate?: number;
  length_ratio?: number;
  word_overlap?: number;
  validation_pass?: boolean;
}

export interface PredictionsResponse {
  job_id: string;
  predictions: TrainingPrediction[];
  total_count: number;
  epoch_count: number;
}

export interface EpochSummary {
  epoch: number;
  prediction_count: number;
  latest_step: number;
}

export interface EpochsResponse {
  job_id: string;
  epochs: EpochSummary[];
}

export interface EpochMetrics {
  epoch: number;
  step: number;
  sample_count: number;
  avg_exact_match: number | null;
  avg_char_error_rate: number | null;
  avg_length_ratio: number | null;
  avg_word_overlap: number | null;
  min_char_error_rate: number | null;
  max_char_error_rate: number | null;
  validation_pass_rate?: number | null;
}

export interface TrendsResponse {
  job_id: string;
  trends: EpochMetrics[];
  overall_improvement: number | null;
}

export interface GetPredictionsFilters {
  epoch?: number;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Client
// ============================================================================

export class TrainingPredictionsClient {
  constructor(private client: FinetuneLabClient) {}

  /**
   * Get training predictions for a job
   *
   * @param jobId - Training job ID
   * @param filters - Optional filters (epoch, limit, offset)
   * @returns Promise with predictions response
   *
   * @example
   * ```typescript
   * const predictions = await client.trainingPredictions.get('job_abc123', {
   *   epoch: 2,
   *   limit: 10
   * });
   * ```
   */
  async get(
    jobId: string,
    filters?: GetPredictionsFilters
  ): Promise<PredictionsResponse> {
    const params = new URLSearchParams();

    if (filters?.epoch !== undefined) {
      params.set('epoch', String(filters.epoch));
    }
    if (filters?.limit !== undefined) {
      params.set('limit', String(filters.limit));
    }
    if (filters?.offset !== undefined) {
      params.set('offset', String(filters.offset));
    }

    const query = params.toString();
    const endpoint = query
      ? `/api/training/predictions/${jobId}?${query}`
      : `/api/training/predictions/${jobId}`;

    return this.client.request<PredictionsResponse>('GET', endpoint);
  }

  /**
   * Get epoch summaries for a job
   *
   * @param jobId - Training job ID
   * @returns Promise with epochs response
   *
   * @example
   * ```typescript
   * const epochs = await client.trainingPredictions.epochs('job_abc123');
   * epochs.epochs.forEach(ep => {
   *   console.log(`Epoch ${ep.epoch}: ${ep.prediction_count} predictions`);
   * });
   * ```
   */
  async epochs(jobId: string): Promise<EpochsResponse> {
    return this.client.request<EpochsResponse>(
      'GET',
      `/api/training/predictions/${jobId}/epochs`
    );
  }

  /**
   * Get quality trends across epochs
   *
   * @param jobId - Training job ID
   * @returns Promise with trends response
   *
   * @example
   * ```typescript
   * const trends = await client.trainingPredictions.trends('job_abc123');
   * trends.trends.forEach(trend => {
   *   console.log(`Epoch ${trend.epoch}: CER=${trend.avg_char_error_rate}`);
   * });
   * console.log(`Overall improvement: ${trends.overall_improvement}%`);
   * ```
   */
  async trends(jobId: string): Promise<TrendsResponse> {
    return this.client.request<TrendsResponse>(
      'GET',
      `/api/training/predictions/${jobId}/trends`
    );
  }

  /**
   * Send training predictions to the platform
   *
   * Use this to send prediction data from local training to the platform
   * for storage and analytics. Requires job_token from training.createJob().
   *
   * @param jobId - Training job ID
   * @param jobToken - Job authentication token from createJob()
   * @param predictions - Array of prediction objects
   * @returns Promise with success status and count
   *
   * @example
   * ```typescript
   * const job = await client.training.createJob({
   *   jobId: 'job_123',
   *   modelName: 'llama-3-8b',
   *   datasetPath: './data/train.jsonl'
   * });
   *
   * await client.trainingPredictions.create(
   *   'job_123',
   *   job.job_token,
   *   [{
   *     job_id: 'job_123',
   *     user_id: 'user_123',
   *     epoch: 1,
   *     step: 100,
   *     sample_index: 0,
   *     prompt: 'What is 2+2?',
   *     prediction: '4',
   *     ground_truth: '4'
   *   }]
   * );
   * ```
   */
  async create(
    jobId: string,
    jobToken: string,
    predictions: Array<{
      job_id: string;
      user_id: string;
      epoch: number;
      step: number;
      sample_index: number;
      prompt: string;
      prediction: string;
      ground_truth?: string;
      exact_match?: number;
      char_error_rate?: number;
      length_ratio?: number;
      word_overlap?: number;
      validation_pass?: boolean;
      source_index?: number;
      prompt_id?: string;
      sample_source?: string;
      sample_source_id?: string;
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      latency_ms?: number;
      max_new_tokens?: number;
      do_sample?: boolean;
      validation_kind?: string;
      validation_errors?: unknown;
    }>
  ): Promise<{ success: boolean; count: number }> {
    const url = `${this.client.getBaseUrl}/api/training/local/predictions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.client.getTimeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jobToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'finetune-lab-sdk/0.2.0',
        },
        body: JSON.stringify({
          job_id: jobId,
          predictions,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetails: FinetuneLabErrorDetails | undefined;

        try {
          const errorData = await response.json() as Record<string, unknown>;
          const errObj = (errorData.error ?? errorData) as FinetuneLabErrorDetails;
          errorDetails = errObj;
        } catch {
          // Ignore JSON parse errors
        }

        throw new FinetuneLabError(
          errorDetails?.message ?? `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorDetails
        );
      }

      return response.json() as Promise<{ success: boolean; count: number }>;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof FinetuneLabError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new FinetuneLabError(`Request timed out after ${this.client.getTimeout}ms`, 408);
        }
        throw new FinetuneLabError(error.message, 0);
      }

      throw new FinetuneLabError('Unknown error occurred', 0);
    }
  }
}
