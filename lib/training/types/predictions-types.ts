/**
 * Training Predictions Types
 *
 * Type definitions for W&B-style prediction tracking during training.
 * Enables quality visualization across epochs.
 */

export interface PredictionsConfig {
  enabled: boolean;
  sample_count: number;
  sample_frequency: 'epoch' | 'eval' | 'steps';
  step_interval?: number;
}

export interface TrainingPrediction {
  id: string;
  job_id: string;
  user_id: string;
  epoch: number;
  step: number;
  sample_index: number;
  prompt: string;
  ground_truth?: string;
  prediction: string;
  created_at: string;
  // Quality metrics (populated when ground_truth exists)
  exact_match?: number;        // 1.0 = perfect match, 0.0 = no match
  char_error_rate?: number;    // 0.0 = perfect, 1.0 = completely wrong
  length_ratio?: number;       // prediction_length / ground_truth_length
  word_overlap?: number;       // 0.0 to 1.0 word-level similarity
}

export interface PredictionsSample {
  index: number;
  prompt: string;
  ground_truth?: string;
}

export interface PredictionsResponse {
  job_id: string;
  predictions: TrainingPrediction[];
  total_count: number;
  epoch_count: number;
}

export interface PredictionsEpochSummary {
  epoch: number;
  prediction_count: number;
  latest_step: number;
}

export interface PredictionsEpochsResponse {
  job_id: string;
  epochs: PredictionsEpochSummary[];
}

/**
 * Aggregate metrics for a single epoch
 */
export interface PredictionEpochMetrics {
  epoch: number;
  step: number;
  sample_count: number;
  avg_exact_match: number | null;
  avg_char_error_rate: number | null;
  avg_length_ratio: number | null;
  avg_word_overlap: number | null;
  min_char_error_rate: number | null;
  max_char_error_rate: number | null;
}

/**
 * Response from trends endpoint
 */
export interface PredictionsTrendsResponse {
  job_id: string;
  trends: PredictionEpochMetrics[];
  overall_improvement: number | null; // % change from first to last epoch
}

/**
 * Single sample trend across epochs
 */
export interface SampleTrendPoint {
  epoch: number;
  step: number;
  prediction: string;
  exact_match: number | null;
  char_error_rate: number | null;
  word_overlap: number | null;
}

export interface SampleTrendResponse {
  job_id: string;
  sample_index: number;
  prompt: string;
  ground_truth: string | null;
  trend: SampleTrendPoint[];
}
