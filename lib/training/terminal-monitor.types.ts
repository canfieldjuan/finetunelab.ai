/**
 * Terminal Monitor Type Definitions
 * 
 * TypeScript interfaces for terminal-style training monitor display
 * Phase 1: Foundation & Data Layer
 * 
 * Date: 2025-11-01
 */

import { TrainingJobStatus } from '@/lib/services/training-providers/local.provider';

/**
 * Trend direction for metrics
 */
export type MetricTrend = 'improving' | 'degrading' | 'stable' | 'insufficient_data';

/**
 * Chart data point for sparklines
 */
export interface ChartDataPoint {
  /** Step number or timestamp */
  x: number;
  /** Metric value */
  y: number;
  /** Optional label */
  label?: string;
}

/**
 * GPU status information
 */
export interface GPUStatus {
  /** Memory allocated in GB */
  memory_allocated_gb: number;
  /** Memory reserved in GB */
  memory_reserved_gb: number;
  /** Total memory in GB */
  memory_total_gb: number;
  /** GPU utilization percentage (0-100) */
  utilization_percent: number;
  /** GPU temperature in Celsius (if available) */
  temperature_celsius?: number;
  /** Power usage in watts (if available) */
  power_watts?: number;
  /** Maximum power in watts (if available) */
  power_max_watts?: number;
}

/**
 * Log entry for log stream
 */
export interface LogEntry {
  /** Timestamp of the log */
  timestamp: string;
  /** Log level (info, warning, error) */
  level: 'info' | 'warning' | 'error' | 'debug';
  /** Log message */
  message: string;
  /** Optional additional data */
  data?: Record<string, unknown>;
}

/**
 * Checkpoint information
 */
export interface CheckpointInfo {
  /** Checkpoint step number */
  step: number;
  /** Checkpoint epoch */
  epoch: number;
  /** Evaluation loss at checkpoint */
  eval_loss: number;
  /** Training loss at checkpoint */
  train_loss?: number;
  /** Path to checkpoint directory */
  path?: string;
  /** Timestamp when checkpoint was saved */
  saved_at?: string;
  /** Whether this is the best checkpoint */
  is_best: boolean;
}

/**
 * Aggregated metrics for terminal display
 * Combines data from multiple sources into single view
 */
export interface TerminalMetrics {
  // Job identification
  job_id: string;
  job_name: string;
  status: TrainingJobStatus['status'];
  
  // Model and dataset info
  model_name: string;
  dataset_name: string;
  dataset_id?: string;
  dataset_samples: number;
  
  // Time tracking
  started_at?: string;
  elapsed_seconds: number;
  remaining_seconds?: number;
  
  // Progress
  current_epoch: number;
  total_epochs: number;
  current_step: number;
  total_steps: number | null;
  progress_percent: number;
  
  // Loss metrics
  train_loss?: number;
  eval_loss?: number;
  best_eval_loss?: number;
  best_checkpoint?: CheckpointInfo;
  
  // Training metrics
  learning_rate?: number;
  grad_norm?: number;
  perplexity?: number;
  loss_trend?: MetricTrend;
  
  // Performance metrics
  samples_per_second?: number;
  tokens_per_second?: number;
  step_time_avg_seconds?: number;
  
  // GPU status
  gpu?: GPUStatus;
  
  // Historical data for charts
  loss_history?: ChartDataPoint[];
  lr_history?: ChartDataPoint[];
  gpu_memory_history?: ChartDataPoint[];
  
  // Recent logs
  recent_logs?: LogEntry[];
  
  // Error information
  error?: string;

  // Warning information (e.g., stale job detection)
  warning?: string;
}

/**
 * Terminal display configuration
 */
export interface TerminalConfig {
  /** Auto-refresh interval in milliseconds */
  refresh_interval_ms: number;
  
  /** Maximum number of logs to display */
  max_logs: number;
  
  /** Maximum data points for sparklines */
  max_chart_points: number;
  
  /** Progress bar width in characters */
  progress_bar_width: number;
  
  /** Theme variant */
  theme: 'classic-green' | 'cyberpunk' | 'modern-dark';
  
  /** Enable animations */
  enable_animations: boolean;
  
  /** Show detailed metrics */
  show_detailed_metrics: boolean;
  
  /** Enable keyboard shortcuts */
  enable_keyboard_shortcuts: boolean;
}

/**
 * Progress bar character set
 */
export interface ProgressChars {
  /** Filled block */
  filled: string;
  /** Partially filled block */
  partial: string;
  /** Empty block */
  empty: string;
  /** Left bracket */
  left: string;
  /** Right bracket */
  right: string;
}

/**
 * Default progress bar characters (ASCII art)
 */
export const DEFAULT_PROGRESS_CHARS: ProgressChars = {
  filled: '█',
  partial: '▒',
  empty: '░',
  left: '[',
  right: ']',
};

/**
 * Trend arrow symbols
 */
export const TREND_ARROWS = {
  up: '▲',
  down: '▼',
  stable: '▬',
  unknown: '•',
} as const;

/**
 * Status symbols
 */
export const STATUS_SYMBOLS = {
  running: '▶',
  completed: '✓',
  failed: '✗',
  cancelled: '⊘',
  queued: '⋯',
  pending: '◷',
  paused: '‖',
} as const;

console.log('[TerminalMonitorTypes] Type definitions loaded');
