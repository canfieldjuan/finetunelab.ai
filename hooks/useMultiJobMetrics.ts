/**
 * useMultiJobMetrics Hook
 * Fetches training metrics for multiple jobs simultaneously for comparison
 * Date: 2025-12-07
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MetricPoint } from '@/lib/hooks/useTrainingMetricsRealtime';

export interface JobMetrics {
  jobId: string;
  jobName: string;
  color: string;
  metrics: MetricPoint[];
}

interface UseMultiJobMetricsResult {
  jobMetrics: JobMetrics[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Distinct colors for up to 5 jobs
const JOB_COLORS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#dc2626', // red
  '#9333ea', // purple
  '#ea580c', // orange
];

/**
 * Fetches metrics for multiple training jobs
 * @param jobIds - Array of job IDs to fetch metrics for
 * @param jobNames - Map of jobId to display name
 * @param sessionToken - Auth token for API requests
 */
export function useMultiJobMetrics(
  jobIds: string[],
  jobNames: Record<string, string>,
  sessionToken?: string
): UseMultiJobMetricsResult {
  const [jobMetrics, setJobMetrics] = useState<JobMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref for jobNames to avoid dependency changes causing re-fetches
  const jobNamesRef = useRef(jobNames);
  jobNamesRef.current = jobNames;

  // Use ref for jobIds to access current value in callback
  const jobIdsRef = useRef(jobIds);
  jobIdsRef.current = jobIds;

  // Stringify jobIds for stable comparison
  const jobIdsKey = jobIds.join(',');

  const fetchAllMetrics = useCallback(async () => {
    const currentJobIds = jobIdsRef.current;
    if (currentJobIds.length === 0) {
      setJobMetrics([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch metrics for all jobs in parallel
      const results = await Promise.all(
        currentJobIds.map(async (jobId, index) => {
          try {
            const response = await fetch(`/api/training/local/${jobId}/metrics`, {
              headers: sessionToken
                ? { 'Authorization': `Bearer ${sessionToken}` }
                : {},
            });

            if (!response.ok) {
              console.warn(`[useMultiJobMetrics] Failed to fetch metrics for job ${jobId}`);
              return null;
            }

            const data = await response.json();

            return {
              jobId,
              jobName: jobNamesRef.current[jobId] || `Job ${index + 1}`,
              color: JOB_COLORS[index % JOB_COLORS.length],
              metrics: data.metrics || [],
            };
          } catch (err) {
            console.error(`[useMultiJobMetrics] Error fetching job ${jobId}:`, err);
            return null;
          }
        })
      );

      // Filter out failed fetches
      const validResults = results.filter((r): r is JobMetrics => r !== null);
      setJobMetrics(validResults);

      if (validResults.length === 0 && currentJobIds.length > 0) {
        setError('Failed to fetch metrics for any selected jobs');
      }
    } catch (err) {
      console.error('[useMultiJobMetrics] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobIdsKey, sessionToken]);

  useEffect(() => {
    fetchAllMetrics();
  }, [fetchAllMetrics]);

  return {
    jobMetrics,
    isLoading,
    error,
    refetch: fetchAllMetrics,
  };
}

/**
 * Merges metrics from multiple jobs into a single array for overlay charts
 * Each point includes the jobId and color for identification
 */
export function mergeMetricsForChart(
  jobMetrics: JobMetrics[],
  metricKey: keyof MetricPoint
): Array<{ step: number; [key: string]: number | null | string }> {
  // Collect all unique steps across all jobs
  const stepSet = new Set<number>();
  jobMetrics.forEach(jm => {
    jm.metrics.forEach(m => stepSet.add(m.step));
  });

  const steps = Array.from(stepSet).sort((a, b) => a - b);

  // Create merged data points
  return steps.map(step => {
    const point: { step: number; [key: string]: number | null | string } = { step };

    jobMetrics.forEach(jm => {
      const metric = jm.metrics.find(m => m.step === step);
      // Use jobId as the key for this job's value
      point[jm.jobId] = metric ? (metric[metricKey] as number | null) : null;
    });

    return point;
  });
}
