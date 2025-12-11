'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { MetricPoint, JobStatus } from '@/lib/hooks/useTrainingMetricsRealtime';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const METRICS_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_METRICS_POLL_INTERVAL_MS ?? 30000);

interface TrainingMetricsContextValue {
  metrics: MetricPoint[];
  jobStatus: JobStatus | null;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
}

const TrainingMetricsContext = createContext<TrainingMetricsContextValue | null>(null);

interface TrainingMetricsProviderProps {
  jobId: string;
  sessionToken?: string | null;
  children: React.ReactNode;
}

/**
 * Provider that manages a SINGLE Realtime subscription for ALL chart components.
 * This prevents connection limit issues when multiple components try to subscribe separately.
 */
export function TrainingMetricsProvider({
  jobId,
  sessionToken,
  children
}: TrainingMetricsProviderProps) {
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isSubscribed = useRef(true);
  const retryCount = useRef(0);
  const fallbackPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_RETRIES = 3;

  // Metric batching: buffer incoming metrics and update state periodically
  // This reduces re-renders from hundreds to ~30 per minute while maintaining real-time feel
  const metricBufferRef = useRef<MetricPoint[]>([]);
  const batchFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const BATCH_FLUSH_INTERVAL_MS = 2000; // Flush every 2 seconds

  useEffect(() => {
    if (!jobId) {
      setError('No job ID provided');
      setIsLoading(false);
      return;
    }

    isSubscribed.current = true;

    const flushMetricBuffer = () => {
      if (metricBufferRef.current.length > 0 && isSubscribed.current) {
        console.log(`[TrainingMetricsProvider] 🔄 Flushing ${metricBufferRef.current.length} buffered metrics`);
        setMetrics((prevMetrics) => [...prevMetrics, ...metricBufferRef.current]);
        metricBufferRef.current = [];
      }
    };

    const scheduleFlush = () => {
      if (!batchFlushTimerRef.current) {
        batchFlushTimerRef.current = setTimeout(() => {
          flushMetricBuffer();
          batchFlushTimerRef.current = null;
        }, BATCH_FLUSH_INTERVAL_MS);
      }
    };

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: sessionToken ? {
          Authorization: `Bearer ${sessionToken}`
        } : {}
      },
      realtime: {
        timeout: 60000,
        heartbeatIntervalMs: 15000,
        params: {
          eventsPerSecond: 10
        }
      }
    });

    const stopFallbackPolling = () => {
      if (fallbackPollRef.current) {
        clearInterval(fallbackPollRef.current);
        fallbackPollRef.current = null;
        console.log('[TrainingMetricsProvider] ⏹️  Stopped fallback polling');
      }
    };

    const fetchMetricsViaApi = async (reason: string): Promise<boolean> => {
      try {
        console.log(`[TrainingMetricsProvider] Fetching metrics via API fallback (${reason})...`);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sessionToken) {
          headers.Authorization = `Bearer ${sessionToken}`;
        }

        const response = await fetch(`/api/training/local/${jobId}/metrics`, {
          headers,
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`API responded with ${response.status}`);
        }

        const payload = await response.json();
        if (!isSubscribed.current) return false;

        if (Array.isArray(payload.metrics)) {
          console.log('[TrainingMetricsProvider] ✅ Loaded', payload.metrics.length, 'metrics via API fallback');
          setMetrics(payload.metrics as MetricPoint[]);
          setError(null);
          return true;
        }

        return false;
      } catch (apiError) {
        if (!isSubscribed.current) return false;
        console.error(`[TrainingMetricsProvider] API fallback failed (${reason}):`, apiError);
        setError('Unable to load metrics (API fallback failed)');
        return false;
      } finally {
        if (isSubscribed.current) {
          setIsLoading(false);
        }
      }
    };

    const startFallbackPolling = (reason: string) => {
      if (fallbackPollRef.current) return;
      console.log(`[TrainingMetricsProvider] 🔁 Starting fallback polling (${reason}) every ${METRICS_POLL_INTERVAL}ms`);
      fallbackPollRef.current = setInterval(() => {
        fetchMetricsViaApi('poll');
      }, METRICS_POLL_INTERVAL);
    };

    console.log('[TrainingMetricsProvider] Initializing SHARED subscription for job:', jobId);

    // Fetch initial data
    const fetchInitialData = async () => {
      try {
        console.log('[TrainingMetricsProvider] Fetching initial metrics...');
        
        const { data: existingMetrics, error: metricsError } = await supabase
          .from('local_training_metrics')
          .select('*')
          .eq('job_id', jobId)
          .order('step', { ascending: true });

        const { data: jobData, error: jobError } = await supabase
          .from('local_training_jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (!isSubscribed.current) return;

        let loadedViaSupabase = false;

        if (metricsError) {
          console.error('[TrainingMetricsProvider] Error fetching metrics:', metricsError);
        } else if (existingMetrics) {
          console.log('[TrainingMetricsProvider] ✅ Loaded', existingMetrics.length, 'metrics');
          setMetrics(existingMetrics as MetricPoint[]);
          loadedViaSupabase = existingMetrics.length > 0;
        }

        if (!loadedViaSupabase) {
          const fallbackLoaded = await fetchMetricsViaApi(metricsError ? 'supabase-error' : 'supabase-empty');
          if (fallbackLoaded) {
            startFallbackPolling('initial-load');
          }
        } else {
          stopFallbackPolling();
        }

        if (jobError) {
          console.error('[TrainingMetricsProvider] Error fetching job:', jobError);
        } else if (jobData) {
          console.log('[TrainingMetricsProvider] ✅ Loaded job status');
          setJobStatus(jobData as JobStatus);
        }
      } catch (err) {
        if (!isSubscribed.current) return;
        console.error('[TrainingMetricsProvider] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (isSubscribed.current) {
          setIsLoading(false);
        }
      }
    };

    fetchInitialData();

    // Set up SINGLE realtime channel for ALL components
    const setupChannel = () => {
      console.log('[TrainingMetricsProvider] Setting up SHARED realtime channel (attempt', retryCount.current + 1, ')');

      const channel = supabase
        .channel(`shared-training-realtime-${jobId}`, {
          config: {
            broadcast: { self: false },
            presence: { key: '' }
          }
        })
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'local_training_jobs',
            filter: `id=eq.${jobId}`
          },
          (payload) => {
            if (!isSubscribed.current) return;
            console.log('[TrainingMetricsProvider] 🔄 Job status updated:', payload.new);
            setJobStatus(payload.new as JobStatus);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'local_training_metrics',
            filter: `job_id=eq.${jobId}`
          },
          (payload) => {
            if (!isSubscribed.current) return;
            const newMetric = payload.new as MetricPoint;
            console.log('[TrainingMetricsProvider] 📊 NEW METRIC INSERT EVENT:', {
              step: newMetric.step,
              loss: newMetric.train_loss,
              timestamp: new Date().toISOString()
            });

            stopFallbackPolling();

            // Buffer the metric instead of immediately updating state
            // This batches updates and reduces re-renders dramatically
            metricBufferRef.current.push(newMetric);
            scheduleFlush();
          }
        )
        .subscribe((status) => {
          if (!isSubscribed.current) return;

          console.log('[TrainingMetricsProvider] Subscription status:', status);
          
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setError(null);
            retryCount.current = 0;
            stopFallbackPolling();
            console.log('[TrainingMetricsProvider] ✅ SHARED realtime connected - ALL components will receive updates');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('[TrainingMetricsProvider] ❌', status);
            
            if (status === 'TIMED_OUT') {
              setError('Realtime connection timed out');
              setIsConnected(false);
              startFallbackPolling('realtime-timeout');
            } else if (retryCount.current < MAX_RETRIES) {
              retryCount.current++;
              console.log('[TrainingMetricsProvider] Retrying... (', retryCount.current, 'of', MAX_RETRIES, ')');
              setTimeout(() => {
                if (isSubscribed.current) {
                  channel.unsubscribe();
                  setupChannel();
                }
              }, 2000);
            } else {
              setError('Failed to connect after multiple retries');
              setIsConnected(false);
              startFallbackPolling('realtime-channel-error');
            }
          }
        });

      return channel;
    };

    const channel = setupChannel();

    // Cleanup
    return () => {
      console.log('[TrainingMetricsProvider] Cleaning up SHARED subscription');
      isSubscribed.current = false;

      // Flush any remaining buffered metrics before cleanup
      if (batchFlushTimerRef.current) {
        clearTimeout(batchFlushTimerRef.current);
        batchFlushTimerRef.current = null;
      }
      flushMetricBuffer();

      stopFallbackPolling();
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [jobId, sessionToken]);

  // Memoize the context value to prevent unnecessary re-renders
  // Only create a new object when the actual values change
  const contextValue = useMemo(
    () => ({ metrics, jobStatus, isLoading, isConnected, error }),
    [metrics, jobStatus, isLoading, isConnected, error]
  );

  return (
    <TrainingMetricsContext.Provider value={contextValue}>
      {children}
    </TrainingMetricsContext.Provider>
  );
}

/**
 * Hook to access the SHARED metrics data from context.
 * All chart components should use this instead of creating individual subscriptions.
 */
export function useSharedTrainingMetrics() {
  const context = useContext(TrainingMetricsContext);
  if (!context) {
    throw new Error('useSharedTrainingMetrics must be used within TrainingMetricsProvider');
  }
  return context;
}
