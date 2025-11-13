'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useTrainingJobRealtime } from '@/lib/hooks/useTrainingJobRealtime';
import { useTrainingMetricsRealtime } from '@/lib/hooks/useTrainingMetricsRealtime';
import type { TrainingJobStatus } from '@/lib/services/training-providers/local.provider';

interface TrainingDashboardProps {
  jobId: string;
  onComplete?: (status: TrainingJobStatus) => void;
  onStatusUpdate?: (status: TrainingJobStatus) => void;
  pollInterval?: number;
}

export function TrainingDashboard({
  jobId,
  onComplete,
  onStatusUpdate,
  pollInterval = 2000,
}: TrainingDashboardProps) {
  const { session } = useAuth();
  const [status, setStatus] = useState<TrainingJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
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
          .single();

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
          throw new Error('Training job not found');
        }

        console.log('[TrainingDashboard] Raw job data from Supabase:', data);

        // Convert Supabase response to TrainingJobStatus format
        const statusData: TrainingJobStatus = {
          job_id: data.id,
          status: data.status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
          progress: data.progress || 0,
          current_step: data.current_step || 0,
          total_steps: data.total_steps || 0,
          current_epoch: data.current_epoch || 0,
          total_epochs: data.total_epochs || 1,
          learning_rate: data.learning_rate || undefined,
          error: data.error_message || undefined,
          gradient_accumulation_steps: data.gradient_accumulation_steps ?? undefined,
          batch_size: data.batch_size ?? undefined,
          elapsed_seconds: data.elapsed_seconds ?? undefined,
          remaining_seconds: data.remaining_seconds ?? undefined,
          total_samples: data.total_samples ?? undefined,
          resumed_from_job_id: data.resumed_from_job_id ?? undefined,
          resume_from_checkpoint: data.resume_from_checkpoint ?? undefined,
        };

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

    // Convert jobUpdate to TrainingJobStatus format
    const updatedStatus: TrainingJobStatus = {
      job_id: jobUpdate.id,
      status: jobUpdate.status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
      progress: jobUpdate.progress || 0,
      current_step: jobUpdate.current_step || 0,
      total_steps: jobUpdate.total_steps || 0,
      current_epoch: jobUpdate.current_epoch || 0,
      total_epochs: jobUpdate.total_epochs || 1,
      learning_rate: jobUpdate.learning_rate || undefined,
      error: jobUpdate.error_message || undefined,
      started_at: jobUpdate.started_at || undefined,
      completed_at: jobUpdate.completed_at || undefined,
      gradient_accumulation_steps: jobUpdate.gradient_accumulation_steps ?? undefined,
      batch_size: jobUpdate.batch_size ?? undefined,
      resumed_from_job_id: (jobUpdate.resumed_from_job_id as string | undefined) ?? undefined,
      resume_from_checkpoint: (jobUpdate.resume_from_checkpoint as string | undefined) ?? undefined,
    };

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
        return 'bg-blue-100 text-blue-800 border-blue-200';
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

  // Calculate actual current_step and progress from metrics
  const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const actualCurrentStep = latestMetric?.step ?? status?.current_step ?? 0;
  const actualProgress = status?.total_steps && actualCurrentStep > 0
    ? (actualCurrentStep / status.total_steps) * 100
    : status?.progress ?? 0;

  // Use metric data for display values (fallback to status if no metrics)
  const displayLoss = latestMetric?.train_loss ?? status?.loss;
  const displayEvalLoss = latestMetric?.eval_loss ?? status?.eval_loss;
  const displayTrainPerplexity = latestMetric?.train_perplexity ?? status?.train_perplexity;
  const displayLearningRate = latestMetric?.learning_rate ?? status?.learning_rate;
  const displayGpuMemory = latestMetric?.gpu_memory_allocated_gb ?? status?.gpu_memory_allocated_gb;
  const displaySamplesPerSec = latestMetric?.samples_per_second ?? status?.samples_per_second;

  console.log('[TrainingDashboard] Latest metric data:', latestMetric);
  console.log('[TrainingDashboard] Display values:', {
    displayLoss,
    displayEvalLoss,
    displayTrainPerplexity,
    displayLearningRate,
  });
  console.log('[TrainingDashboard] Metrics-based calculation:', {
    metricsCount: metrics.length,
    latestStep: latestMetric?.step,
    actualCurrentStep,
    totalSteps: status?.total_steps,
    actualProgress: actualProgress.toFixed(1) + '%',
  });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Training Progress</h2>
            <div className="flex items-center gap-3">
              {/* Terminal View Link */}
              <Link
                href={`/training/terminal?jobId=${jobId}`}
                className="px-3 py-1 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors"
                title="Switch to Terminal View"
              >
                <span className="mr-1">◼</span>
                Terminal View
              </Link>

              {/* Resume Indicator */}
              {status.resumed_from_job_id && (
                <div
                  className="px-3 py-1 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded"
                  title={`Resumed from: ${status.resumed_from_job_id}${status.resume_from_checkpoint ? `\nCheckpoint: ${status.resume_from_checkpoint}` : ''}`}
                >
                  <span className="mr-1">↻</span>
                  Resumed
                </div>
              )}

              {/* Status Badge */}
              <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(status.status)}`}>
                <span className="mr-1">{getStatusIcon(status.status)}</span>
                {status.status.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

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
              <span>Step {actualCurrentStep} / {status.total_steps}</span>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="text-xs text-amber-800 mb-1">No Improvement</div>
              <div className="text-lg font-semibold text-amber-900">
                {status.epochs_without_improvement || 0} epochs
              </div>
            </div>
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
              <div className="text-xs text-gray-600 mb-1">Remaining</div>
              <div className="text-sm font-medium text-gray-900">
                {formatTime(status.remaining_seconds)}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-600 mb-1">Dataset Size</div>
              <div className="text-sm font-medium text-gray-900">
                {status.total_samples && status.total_samples > 0
                  ? `${status.total_samples} samples`
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
