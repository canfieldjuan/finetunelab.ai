'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useTrainingJobRealtime } from '@/lib/hooks/useTrainingJobRealtime';
import { useTrainingMetricsRealtime } from '@/lib/hooks/useTrainingMetricsRealtime';
import type { TrainingJobStatus } from '@/lib/services/training-providers/local.provider';
import {
  calculateLossGap,
  getPerplexityStatus,
  getLossTrendStatus,
  getEpochsWithoutImprovementStatus,
  getStatusColorClasses,
  getStatusBgClasses,
  type TrainingMetrics
} from '@/lib/training/metrics-calculator';
import {
  calculateProgressMetrics,
  type RawJobRow as ProgressRawJobRow,
  toNumber,
  toStringValue,
  pickString,
  maybeRecord,
  computeElapsedSecondsFromTimestamps,
  computeLinearRemainingSeconds,
  extractDatasetSampleCount,
  estimateTotalSteps
} from '@/lib/training/progress-calculator';

type RawJobRow = Record<string, unknown>;

const STATUS_VALUES: TrainingJobStatus['status'][] = ['queued', 'pending', 'running', 'completed', 'failed', 'cancelled', 'paused'];

// Only helper function unique to TrainingDashboard
const toLossTrend = (value: unknown): TrainingJobStatus['loss_trend'] => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (['improving', 'degrading', 'stable', 'insufficient_data'].includes(normalized)) {
    return normalized as TrainingJobStatus['loss_trend'];
  }
  return undefined;
};

const normalizeJobRow = (raw: RawJobRow): TrainingJobStatus => {
  const config = maybeRecord(raw.config);
  const totalSamples = extractDatasetSampleCount(raw, config);
  const startedAt = toStringValue(raw.started_at);
  const completedAt = toStringValue(raw.completed_at);
  const updatedAt = toStringValue(raw.updated_at);
  const elapsedSeconds =
    toNumber(raw.elapsed_seconds) ?? computeElapsedSecondsFromTimestamps(startedAt, completedAt, updatedAt);
  const progressPercent = toNumber(raw.progress);
  const remainingSeconds = toNumber(raw.remaining_seconds) ?? computeLinearRemainingSeconds(elapsedSeconds, progressPercent);
  const totalSteps = estimateTotalSteps(raw, totalSamples, config) ?? 0;

  const statusValue = typeof raw.status === 'string' ? raw.status.toLowerCase() : 'pending';
  const normalizedStatus = STATUS_VALUES.includes(statusValue as TrainingJobStatus['status'])
    ? (statusValue as TrainingJobStatus['status'])
    : 'pending';

  const configMetadata = maybeRecord(config?.metadata);
  const configModel = maybeRecord(config?.model);
  const configDataset = maybeRecord(config?.dataset);
  const configData = maybeRecord(config?.data);
  const configTraining = maybeRecord(config?.training);
  const configHardware = maybeRecord(config?.hardware);
  const configGpu = maybeRecord(configHardware?.gpu);

  const datasetPath = pickString(raw.dataset_path);
  const jobName = pickString(raw.job_name, configMetadata?.job_name, configTraining?.job_name);
  const modelName = pickString(raw.model_name, configModel?.name);
  const modelDisplayName = pickString(raw.model_display_name, configModel?.display_name, configModel?.displayName);
  const datasetName = pickString(
    raw.dataset_name,
    configDataset?.name,
    configData?.dataset_name,
    configData?.datasetName
  );

  return {
    gradient_accumulation_steps: toNumber(raw.gradient_accumulation_steps) ?? toNumber(configTraining?.gradient_accumulation_steps),
    batch_size: toNumber(raw.batch_size) ?? toNumber(configTraining?.batch_size),
    job_id: String(raw.job_id ?? raw.id ?? ''),
    job_name: jobName,
    model_name: modelName,
    model_display_name: modelDisplayName,
    dataset_name: datasetName,
    dataset_path: datasetPath ?? null,
    gpu_total_memory_gb: toNumber(raw.gpu_total_memory_gb) ?? toNumber(configGpu?.memory_gb) ?? toNumber(configGpu?.memoryGb),
    status: normalizedStatus,
    progress: progressPercent ?? 0,
    current_epoch: toNumber(raw.current_epoch) ?? 0,
    total_epochs: toNumber(raw.total_epochs) ?? 1,
    current_step: toNumber(raw.current_step) ?? 0,
    total_steps: totalSteps,
    loss: toNumber(raw.loss) ?? undefined,
    eval_loss: toNumber(raw.eval_loss) ?? toNumber(raw.final_eval_loss) ?? undefined,
    learning_rate: toNumber(raw.learning_rate) ?? undefined,
    grad_norm: toNumber(raw.grad_norm) ?? undefined,
    gpu_memory_allocated_gb: toNumber(raw.gpu_memory_allocated_gb) ?? undefined,
    gpu_memory_reserved_gb: toNumber(raw.gpu_memory_reserved_gb) ?? undefined,
    gpu_utilization_percent: toNumber(raw.gpu_utilization_percent) ?? undefined,
    tokens_per_second: toNumber(raw.tokens_per_second) ?? undefined,
    elapsed_seconds: elapsedSeconds ?? undefined,
    remaining_seconds: remainingSeconds ?? undefined,
    samples_per_second: toNumber(raw.samples_per_second) ?? undefined,
    error: pickString(raw.error_message, raw.error),
    started_at: startedAt,
    completed_at: completedAt,
    updated_at: updatedAt,
    perplexity: toNumber(raw.perplexity) ?? undefined,
    train_perplexity: toNumber(raw.train_perplexity) ?? undefined,
    best_eval_loss: toNumber(raw.best_eval_loss) ?? undefined,
    best_epoch: toNumber(raw.best_epoch) ?? undefined,
    best_step: toNumber(raw.best_step) ?? undefined,
    best_checkpoint_path: pickString(raw.best_checkpoint_path),
    epochs_without_improvement: toNumber(raw.epochs_without_improvement) ?? undefined,
    loss_trend: toLossTrend(raw.loss_trend),
    total_samples: totalSamples ?? undefined,
    train_samples: toNumber(raw.train_samples) ?? undefined,
    val_samples: toNumber(raw.val_samples) ?? undefined,
    total_tokens_processed: toNumber(raw.total_tokens_processed) ?? undefined,
    warning: pickString(raw.warning),
    resumed_from_job_id: pickString(raw.resumed_from_job_id),
    resume_from_checkpoint: pickString(raw.resume_from_checkpoint),
    config: config ?? null,
  };
};

interface TrainingDashboardProps {
  jobId: string;
  onComplete?: (status: TrainingJobStatus) => void;
  onStatusUpdate?: (status: TrainingJobStatus) => void;
  pollInterval?: number;
  controlButtons?: React.ReactNode;
  leftControlButton?: React.ReactNode;
}

export function TrainingDashboard({
  jobId,
  onComplete,
  onStatusUpdate,
  controlButtons,
  leftControlButton,
}: TrainingDashboardProps) {
  const { session } = useAuth();
  const [status, setStatus] = useState<TrainingJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const lastStatusRef = useRef<TrainingJobStatus | null>(null);
  const fetchInProgressRef = useRef(false);

  // Get metrics to calculate actual current_step from latest metric
  // Pass session?.access_token directly so hook receives fresh tokens on refresh
  const { metrics } = useTrainingMetricsRealtime(jobId, session?.access_token);

  console.log('[TrainingDashboard] Component initialized (Realtime enabled) - jobId:', jobId);
  
  // Store callbacks in refs to avoid dependency array changes
  const onCompleteRef = useRef(onComplete);
  const onStatusUpdateRef = useRef(onStatusUpdate);
  
  // Update refs when callbacks change
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onStatusUpdateRef.current = onStatusUpdate;
  }, [onComplete, onStatusUpdate]);

  useEffect(() => {
    if (!jobId) return;

    const fetchStatus = async () => {
      // Prevent duplicate concurrent requests
      if (fetchInProgressRef.current) {
        console.log('[TrainingDashboard] Fetch already in progress, skipping');
        return;
      }

      // Require authentication
      if (!session?.access_token) {
        console.log('[TrainingDashboard] No session token available, skipping fetch');
        setError('Not authenticated. Please log in.');
        return;
      }

      try {
        fetchInProgressRef.current = true;
        
        // Fetch directly from Supabase instead of API route to avoid race condition
        console.log('[TrainingDashboard] Fetching status directly from Supabase for job:', jobId);
        const { data, error: supabaseError } = await supabase
          .from('local_training_jobs')
          .select('*')
          .eq('id', jobId)
          .maybeSingle();

        console.log('[TrainingDashboard] Supabase response:', { data, error: supabaseError });

        if (supabaseError) {
          console.error('[TrainingDashboard] Supabase error details:', {
            message: supabaseError.message,
            code: supabaseError.code,
            details: supabaseError.details,
            hint: supabaseError.hint
          });
          throw new Error(`Failed to fetch status: ${supabaseError.message}`);
        }

        if (!data) {
          console.warn('[TrainingDashboard] No data returned from Supabase for job:', jobId);
          console.warn('[TrainingDashboard] This may indicate the job was not successfully created in local_training_jobs table');
          throw new Error('Training job not found. The job may not have been created successfully.');
        }

        console.log('[TrainingDashboard] Raw job data from Supabase:', data);

        // Normalize Supabase row to include derived totals/timestamps
        const statusData = normalizeJobRow(data as RawJobRow);

        console.log('[TrainingDashboard] Converted status data:', statusData);

        setStatus(statusData);
        setError(null);

        console.log('[TrainingDashboard] Fetched status:', statusData.status, 'for job:', jobId);

        // Only call onStatusUpdate if data has meaningfully changed
        const hasChanged = !lastStatusRef.current ||
          lastStatusRef.current.status !== statusData.status ||
          lastStatusRef.current.current_step !== statusData.current_step ||
          lastStatusRef.current.current_epoch !== statusData.current_epoch ||
          lastStatusRef.current.progress !== statusData.progress;

        if (hasChanged && onStatusUpdateRef.current) {
          console.log('[TrainingDashboard] Status changed, updating parent');
          onStatusUpdateRef.current(statusData);
          lastStatusRef.current = statusData;
        }

        // Call completion callback if job is finished
        const isFinished = statusData.status === 'completed' || statusData.status === 'failed' || statusData.status === 'cancelled';
        if (isFinished) {
          console.log('[TrainingDashboard] Training finished with status:', statusData.status);
          if (onCompleteRef.current) {
            onCompleteRef.current(statusData);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        console.error('[TrainingDashboard] Fetch error:', err);
        console.error('[TrainingDashboard] Job ID:', jobId);
      } finally {
        fetchInProgressRef.current = false;
      }
    };

    // Reset state when jobId changes to force fresh data
    lastStatusRef.current = null;
    setStatus(null);
    setError(null);

    console.log('[TrainingDashboard] useEffect running (Realtime mode) - jobId:', jobId);

    // Always fetch once immediately to get current status
    fetchStatus();
  }, [jobId, session]);

  // Subscribe to real-time job status updates (replaces polling)
  // Pass session?.access_token directly so hook receives fresh tokens on refresh
  useTrainingJobRealtime(jobId, session?.access_token, (jobUpdate) => {
    console.log('[TrainingDashboard] Realtime job update received:', jobUpdate.status);

    // Normalize realtime payload to keep derived counters consistent
    const updatedStatus = normalizeJobRow(jobUpdate as RawJobRow);

    setStatus(updatedStatus);

    // Call parent callbacks
    if (onStatusUpdateRef.current) {
      onStatusUpdateRef.current(updatedStatus);
    }

    const isFinished = jobUpdate.status === 'completed' || jobUpdate.status === 'failed' || jobUpdate.status === 'cancelled';
    if (isFinished && onCompleteRef.current) {
      console.log('[TrainingDashboard] Training finished via Realtime:', jobUpdate.status);
      onCompleteRef.current(updatedStatus);
    }
  });

  // Handler to cancel/stop training
  const handleCancelTraining = async () => {
    if (!session?.access_token || !jobId) return;

    const confirmCancel = confirm(
      'Are you sure you want to stop this training job?\n\n' +
      'The training will be terminated immediately. Progress will be saved up to the last checkpoint.'
    );

    if (!confirmCancel) return;

    setIsCancelling(true);

    try {
      const response = await fetch(`/api/training/local/${jobId}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'cancel' }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to cancel training');
      }

      console.log('[TrainingDashboard] Training cancelled successfully');

      // The realtime subscription will update the status automatically
    } catch (err) {
      console.error('[TrainingDashboard] Error cancelling training:', err);
      alert(`Failed to stop training: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsCancelling(false);
    }
  };

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center text-red-800">
          <span className="mr-2 text-lg">&#10060;</span>
          <div>
            <h3 className="font-semibold">Error Loading Training Status</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center text-gray-600">
          <svg className="animate-spin h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading training status...</span>
        </div>
      </div>
    );
  }

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'running':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'queued':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'completed':
        return '✓';
      case 'failed':
        return '✗';
      case 'cancelled':
        return '⊘';
      case 'running':
        return '▶';
      case 'queued':
        return '⋯';
      case 'pending':
        return '◷';
      default:
        return '◷';
    }
  };

  const formatTime = (seconds: number | undefined) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatNumber = (num: number | undefined, decimals = 2) => {
    if (num === undefined || num === null) return 'N/A';
    return num.toFixed(decimals);
  };

  const getTrendIcon = (trend: string | undefined) => {
    switch (trend) {
      case 'improving':
        return '↓';
      case 'degrading':
        return '↑';
      case 'stable':
        return '→';
      default:
        return '?';
    }
  };

  const getTrendColor = (trend: string | undefined) => {
    switch (trend) {
      case 'improving':
        return 'text-green-600';
      case 'degrading':
        return 'text-red-600';
      case 'stable':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  // Calculate progress metrics using centralized calculator (single source of truth)
  const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  // Build raw job data for calculator - use status as the base with config
  const rawJobData: ProgressRawJobRow = {
    ...status,
    config: status?.config ?? null
  };

  // Get calculated progress metrics with Smart ETA and validation
  const progressMetrics = calculateProgressMetrics(rawJobData, latestMetric, metrics);
  const actualCurrentStep = progressMetrics.currentStep;
  const actualProgress = progressMetrics.progressPercent;

  // Use metric data for display values (fallback to status if no metrics)
  const displayLoss = latestMetric?.train_loss ?? status?.loss;
  const displayEvalLoss = latestMetric?.eval_loss ?? status?.eval_loss;
  const displayTrainPerplexity = latestMetric?.train_perplexity ?? status?.train_perplexity;
  const displayLearningRate = latestMetric?.learning_rate ?? status?.learning_rate;
  const displayGpuMemory = latestMetric?.gpu_memory_allocated_gb ?? status?.gpu_memory_allocated_gb;
  const displaySamplesPerSec = latestMetric?.samples_per_second ?? status?.samples_per_second;

  // Calculate Phase 1 metrics using shared utility functions
  // Note: TrainingJobStatus uses loss/eval_loss, TrainingMetrics expects final_loss/final_eval_loss
  const metricsData: TrainingMetrics = {
    final_loss: displayLoss ?? status?.loss,
    final_eval_loss: displayEvalLoss ?? status?.eval_loss,
    loss_trend: status?.loss_trend,
    perplexity: displayTrainPerplexity ?? status?.perplexity,
    train_perplexity: displayTrainPerplexity,
    epochs_without_improvement: status?.epochs_without_improvement,
    best_eval_loss: status?.best_eval_loss,
  };

  const lossGap = calculateLossGap(metricsData);
  const perplexityStatus = getPerplexityStatus(metricsData);
  const lossTrendStatus = getLossTrendStatus(metricsData);
  const epochsWithoutImprovementStatus = getEpochsWithoutImprovementStatus(metricsData);

  console.log('[TrainingDashboard] Progress metrics (centralized):', {
    metricsCount: metrics.length,
    latestStep: latestMetric?.step,
    actualCurrentStep,
    totalSteps: progressMetrics.totalSteps,
    actualProgress: actualProgress.toFixed(1) + '%',
    etaConfidence: progressMetrics.etaConfidence,
    isValidated: progressMetrics.isValidated,
    validationNote: progressMetrics.validationNote
  });

  return (
    <div className="space-y-4">
      {/* Control Buttons - Above the card */}
      <div className="flex items-center justify-between">
        {/* Left side - Monitor Different Job button */}
        <div className="flex items-center gap-2">
          {leftControlButton}
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-2">
          {/* Control Buttons (Pause/Cancel) */}
          {controlButtons}

          {/* Stop Training Button - Only show for running/pending jobs */}
          {(status.status === 'running' || status.status === 'pending') && (
            <button
              onClick={handleCancelTraining}
              disabled={isCancelling}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Stop training immediately"
            >
              <span className="mr-1">⏹</span>
              {isCancelling ? 'Stopping...' : 'Stop Training'}
            </button>
          )}

          {/* Terminal Link */}
          <Link
            href={`/training/terminal?jobId=${jobId}`}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium font-mono text-green-400 bg-gray-900 border border-green-500 rounded hover:bg-gray-800 hover:text-green-300 hover:border-green-400 hover:shadow-[0_0_8px_rgba(34,197,94,0.4)] transition-all"
            title="Open Terminal"
          >
            <span className="mr-1">&gt;_</span>
            Terminal
          </Link>

          {/* Resume Indicator */}
          {status.resumed_from_job_id && (
            <div
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded"
              title={`Resumed from: ${status.resumed_from_job_id}${status.resume_from_checkpoint ? `\nCheckpoint: ${status.resume_from_checkpoint}` : ''}`}
            >
              <span className="mr-1">↻</span>
              Resumed
            </div>
          )}
        </div>
      </div>

      {/* Card with header */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Training Progress</h2>
          {/* Status Badge */}
          <div className={`inline-flex items-center px-3 py-1.5 rounded text-sm font-medium border ${getStatusColor(status.status)}`}>
            <span className="mr-1">{getStatusIcon(status.status)}</span>
            {status.status.toUpperCase()}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-6">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-gray-700">
                Epoch {status.current_epoch} / {status.total_epochs}
              </span>
              <span className="text-gray-600">{actualProgress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, actualProgress)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Step {actualCurrentStep} / {progressMetrics.totalSteps}</span>
              {displaySamplesPerSec && (
                <span>{formatNumber(displaySamplesPerSec, 1)} samples/s</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-xs text-gray-600 mb-1">Train Loss</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatNumber(displayLoss, 4)}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-xs text-gray-600 mb-1">Eval Loss</div>
              <div className="text-lg font-semibold text-gray-900">
                {displayEvalLoss !== null && displayEvalLoss !== undefined
                  ? formatNumber(displayEvalLoss, 4)
                  : <span className="text-sm text-gray-500">Pending...</span>
                }
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-xs text-gray-600 mb-1">Train Perplexity</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatNumber(displayTrainPerplexity, 2)}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-xs text-gray-600 mb-1">Learning Rate</div>
              <div className="text-sm font-semibold text-gray-900">
                {displayLearningRate?.toExponential(2) || 'N/A'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-xs text-blue-800 mb-1">Loss Trend</div>
              <div className={`text-lg font-semibold ${getTrendColor(status.loss_trend)}`}>
                <span className="mr-1">{getTrendIcon(status.loss_trend)}</span>
                {status.loss_trend || <span className="text-sm text-gray-600">Calculating...</span>}
              </div>
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="text-xs text-green-800 mb-1">Best Eval Loss</div>
              <div className="text-sm text-green-900">
                <div className="font-semibold">{formatNumber(status.best_eval_loss, 4)}</div>
                <div className="text-xs mt-1">
                  Epoch {status.best_epoch}, Step {status.best_step}
                </div>
              </div>
            </div>
          </div>

          {/* Phase 1: Enhanced Training Health Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            {/* Loss Trend */}
            {lossTrendStatus && (
              <div className={`p-3 border rounded-md ${getStatusBgClasses(lossTrendStatus.status)}`}>
                <div className="text-xs font-medium mb-1">
                  Loss Trend
                  <span className="ml-1 cursor-help" title="Training productivity. Improving: Productive, Stable: Plateaued, Diverging: Failing">ℹ️</span>
                </div>
                <div className={`text-lg font-semibold ${getStatusColorClasses(lossTrendStatus.status)}`}>
                  {lossTrendStatus.trend}
                </div>
                <div className="text-xs mt-1 opacity-75">
                  {lossTrendStatus.status === 'good' && '🟢 Training productive'}
                  {lossTrendStatus.status === 'warning' && '🟡 Plateaued'}
                  {lossTrendStatus.status === 'bad' && '🔴 Training failing'}
                </div>
              </div>
            )}

            {/* Perplexity */}
            {perplexityStatus && (
              <div className={`p-3 border rounded-md ${getStatusBgClasses(perplexityStatus.status)}`}>
                <div className="text-xs font-medium mb-1">
                  Perplexity
                  <span className="ml-1 cursor-help" title="Model confusion (lower = better). < 5: Excellent, 5-10: Good, > 10: Poor">ℹ️</span>
                </div>
                <div className={`text-lg font-semibold ${getStatusColorClasses(perplexityStatus.status)}`}>
                  {perplexityStatus.value.toFixed(2)}
                </div>
                <div className="text-xs mt-1 opacity-75">
                  {perplexityStatus.status === 'excellent' && '🟢 Excellent quality'}
                  {perplexityStatus.status === 'good' && '🟡 Good quality'}
                  {perplexityStatus.status === 'poor' && '🔴 Needs improvement'}
                </div>
              </div>
            )}

            {/* Train/Eval Loss Gap (for completed jobs) */}
            {lossGap && status?.status === 'completed' && (
              <div className={`p-3 border rounded-md ${getStatusBgClasses(lossGap.status)}`}>
                <div className="text-xs font-medium mb-1">
                  Train/Eval Gap
                  <span className="ml-1 cursor-help" title="Overfitting indicator. < 0.3: Good, 0.3-0.5: Warning, > 0.5: Overfitting">ℹ️</span>
                </div>
                <div className={`text-lg font-semibold ${getStatusColorClasses(lossGap.status)}`}>
                  {lossGap.gap.toFixed(4)}
                </div>
                <div className="text-xs mt-1 opacity-75">
                  {lossGap.status === 'good' && '✓ Good generalization'}
                  {lossGap.status === 'warning' && '⚠ Slight overfitting'}
                  {lossGap.status === 'bad' && '⚠ Severe overfitting'}
                </div>
              </div>
            )}

            {/* Recent Eval Trend */}
            {epochsWithoutImprovementStatus && (
              <div className={`p-3 border rounded-md ${getStatusBgClasses(epochsWithoutImprovementStatus.status)}`}>
                <div className="text-xs font-medium mb-1">
                  Recent Eval Trend
                  <span className="ml-1 cursor-help" title="Compares most recent eval to previous eval. 0: Last eval improved, 1: Last eval did not improve">ℹ️</span>
                </div>
                <div className={`text-lg font-semibold ${getStatusColorClasses(epochsWithoutImprovementStatus.status)}`}>
                  {epochsWithoutImprovementStatus.value === 0 ? '↓ Improving' : '↑ Not Improving'}
                </div>
                <div className="text-xs mt-1 opacity-75">
                  {epochsWithoutImprovementStatus.status === 'good' && '🟢 Last eval improved'}
                  {epochsWithoutImprovementStatus.status === 'warning' && '🟡 Last eval did not improve'}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div>
              <div className="text-xs text-gray-600 mb-1">Allocated GPU Memory</div>
              <div className="text-sm font-medium text-gray-900">
                {formatNumber(displayGpuMemory, 2)} GB
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-600 mb-1">Elapsed Time</div>
              <div className="text-sm font-medium text-gray-900">
                {formatTime(status.elapsed_seconds)}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-600 mb-1">
                Remaining
                {progressMetrics.etaConfidence !== 'insufficient_data' && (
                  <span className={`ml-1 text-xs ${
                    progressMetrics.etaConfidence === 'high' ? 'text-green-600' :
                    progressMetrics.etaConfidence === 'medium' ? 'text-yellow-600' : 'text-orange-600'
                  }`}>
                    ({progressMetrics.etaConfidence})
                  </span>
                )}
              </div>
              <div className="text-sm font-medium text-gray-900">
                {formatTime(progressMetrics.remainingSeconds)}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-600 mb-1">Dataset Size</div>
              <div className="text-sm font-medium text-gray-900">
                {progressMetrics.totalSamples && progressMetrics.totalSamples > 0
                  ? `${progressMetrics.totalSamples} samples`
                  : <span className="text-gray-500">Unknown</span>
                }
              </div>
            </div>
          </div>

          {status.status === 'failed' && status.error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="text-sm font-semibold text-red-900 mb-1">Error</div>
              <div className="text-sm text-red-800">{status.error}</div>
            </div>
          )}

          {status.status === 'completed' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center text-green-800">
                <span className="mr-2 text-lg">✓</span>
                <span className="font-medium">Training completed successfully!</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
