/**
 * Terminal Data Hook
 * 
 * React hook to aggregate training data for terminal-style monitor
 * Polls job status and transforms data for display
 * 
 * Phase 1: Foundation & Data Layer
 * Date: 2025-11-01
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { TerminalMetrics, GPUStatus, CheckpointInfo } from '@/lib/training/terminal-monitor.types';
import { TrainingJobStatus } from '@/lib/services/training-providers/local.provider';
import { supabase } from '@/lib/supabaseClient';

export interface UseTerminalDataOptions {
  /** Polling interval in milliseconds (default: 2000) */
  refreshInterval?: number;
  /** Whether to start polling immediately (default: true) */
  autoRefresh?: boolean;
  /** Maximum number of logs to keep (default: 10) */
  maxLogs?: number;
  /** Maximum chart data points (default: 50) */
  maxChartPoints?: number;
}

export interface UseTerminalDataReturn {
  /** Aggregated terminal metrics */
  data: TerminalMetrics | null;
  /** Loading state (true during initial fetch) */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually trigger data refresh */
  refetch: () => Promise<void>;
  /** Whether polling is active */
  isPolling: boolean;
}

/**
 * Hook to fetch and aggregate training data for terminal monitor
 * 
 * Features:
 * - Polls job status at configurable interval
 * - Stops polling when job reaches terminal state (completed/failed/cancelled)
 * - Aggregates data from job status into TerminalMetrics
 * - Handles errors gracefully
 * - Cleans up on unmount
 * 
 * @param jobId - Training job ID to monitor
 * @param options - Configuration options
 * @returns Terminal data, loading state, error state, and refetch function
 * 
 * @example
 * const { data, loading, error, refetch } = useTerminalData('job-123');
 * 
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error}</div>;
 * if (!data) return <div>No data</div>;
 * 
 * return <TerminalMonitor metrics={data} />;
 */
export function useTerminalData(
  jobId: string | null,
  options: UseTerminalDataOptions = {}
): UseTerminalDataReturn {
  const {
    refreshInterval = 2000,
    autoRefresh = true,
    // maxLogs and maxChartPoints reserved for future use with historical data
  } = options;

  const [data, setData] = useState<TerminalMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  
  // Use ref to track if component is mounted
  const isMountedRef = useRef<boolean>(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  /**
   * Check if job is in terminal state (should stop polling)
   */
  const isTerminalState = useCallback((status: TrainingJobStatus['status']): boolean => {
    return status === 'completed' || status === 'failed' || status === 'cancelled';
  }, []);
  
  /**
   * Transform job status to terminal metrics
   */
  const transformToTerminalMetrics = useCallback((
    jobStatus: TrainingJobStatus
  ): TerminalMetrics => {
    // Extract GPU status if available
    const gpu: GPUStatus | undefined = jobStatus.gpu_memory_allocated_gb !== undefined ? {
      memory_allocated_gb: jobStatus.gpu_memory_allocated_gb || 0,
      memory_reserved_gb: jobStatus.gpu_memory_reserved_gb || 0,
      memory_total_gb: 8.0, // TODO: Get from system info
      utilization_percent: jobStatus.gpu_utilization_percent || 0,
    } : undefined;
    
    // Extract best checkpoint info if available
    const best_checkpoint: CheckpointInfo | undefined = jobStatus.best_eval_loss !== undefined ? {
      step: jobStatus.best_step || 0,
      epoch: jobStatus.best_epoch || 0,
      eval_loss: jobStatus.best_eval_loss,
      is_best: true,
    } : undefined;
    
    // Calculate progress percentage
    const progress = jobStatus.total_steps > 0
      ? (jobStatus.current_step / jobStatus.total_steps) * 100
      : jobStatus.progress || 0;
    
    return {
      job_id: jobStatus.job_id,
      job_name: jobStatus.job_id, // TODO: Get actual job name
      status: jobStatus.status,
      
      model_name: 'Model Name', // TODO: Get from config
      dataset_name: 'Dataset', // TODO: Get from config
      dataset_samples: jobStatus.total_samples || 0,
      
      started_at: jobStatus.started_at,
      elapsed_seconds: jobStatus.elapsed_seconds || 0,
      remaining_seconds: jobStatus.remaining_seconds,
      
      current_epoch: jobStatus.current_epoch,
      total_epochs: jobStatus.total_epochs,
      current_step: jobStatus.current_step,
      total_steps: jobStatus.total_steps,
      progress_percent: progress,
      
      train_loss: jobStatus.loss,
      eval_loss: jobStatus.eval_loss,
      best_eval_loss: jobStatus.best_eval_loss,
      best_checkpoint,
      
      learning_rate: jobStatus.learning_rate,
      grad_norm: jobStatus.grad_norm,
      perplexity: jobStatus.perplexity,
      loss_trend: jobStatus.loss_trend,
      
      samples_per_second: jobStatus.samples_per_second,
      step_time_avg_seconds: jobStatus.samples_per_second 
        ? 1 / jobStatus.samples_per_second 
        : undefined,
      
      gpu,
      
      error: jobStatus.error,
    };
  }, []);
  
  /**
   * Fetch job status from API
   */
  const fetchJobStatus = useCallback(async (): Promise<void> => {
    if (!jobId) {
      setError('No job ID provided');
      setLoading(false);
      return;
    }

    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated - please log in');
      }

      if (!session.access_token) {
        throw new Error('No access token available - please refresh the page');
      }

      // Use Next.js API route which proxies to training server
      const response = await fetch(`/api/training/local/${jobId}/status`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch job status: ${response.status} ${response.statusText}`);
      }

      const jobStatus: TrainingJobStatus = await response.json();
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        const metrics = transformToTerminalMetrics(jobStatus);
        setData(metrics);
        setError(null);
        setLoading(false);
        
        // Stop polling if job reached terminal state
        if (isTerminalState(jobStatus.status)) {
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        setLoading(false);
      }
    }
  }, [jobId, transformToTerminalMetrics, isTerminalState]);
  
  /**
   * Start polling
   */
  const startPolling = useCallback(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Fetch immediately
    fetchJobStatus();
    
    // Set up interval for subsequent fetches
    intervalRef.current = setInterval(() => {
      fetchJobStatus();
    }, refreshInterval);
    
    setIsPolling(true);
  }, [fetchJobStatus, refreshInterval]);
  
  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);
  
  /**
   * Manual refetch function
   */
  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    await fetchJobStatus();
  }, [fetchJobStatus]);
  
  // Effect: Start/stop polling based on autoRefresh and jobId
  useEffect(() => {
    if (!jobId) {
      setData(null);
      setLoading(false);
      setError('No job ID provided');
      return;
    }
    
    if (autoRefresh) {
      startPolling();
    } else {
      // Fetch once without polling
      fetchJobStatus();
    }
    
    // Cleanup on unmount or when dependencies change
    return () => {
      stopPolling();
    };
  }, [jobId, autoRefresh, startPolling, stopPolling, fetchJobStatus]);
  
  // Effect: Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  return {
    data,
    loading,
    error,
    refetch,
    isPolling,
  };
}

console.log('[UseTerminalData] Hook loaded');
