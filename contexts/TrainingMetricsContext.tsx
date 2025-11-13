'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { MetricPoint, JobStatus } from '@/lib/hooks/useTrainingMetricsRealtime';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

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
  const MAX_RETRIES = 3;

  useEffect(() => {
    if (!jobId) {
      setError('No job ID provided');
      setIsLoading(false);
      return;
    }

    isSubscribed.current = true;

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

        if (metricsError) {
          console.error('[TrainingMetricsProvider] Error fetching metrics:', metricsError);
        } else if (existingMetrics) {
          console.log('[TrainingMetricsProvider] ✅ Loaded', existingMetrics.length, 'metrics');
          setMetrics(existingMetrics as MetricPoint[]);
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
            
            // Force a new array reference to trigger React re-render
            setMetrics((prev) => {
              const updated = [...prev, newMetric];
              console.log('[TrainingMetricsProvider] 📈 STATE UPDATE: metrics array length', prev.length, '→', updated.length);
              return updated;
            });
          }
        )
        .subscribe((status) => {
          if (!isSubscribed.current) return;

          console.log('[TrainingMetricsProvider] Subscription status:', status);
          
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setError(null);
            retryCount.current = 0;
            console.log('[TrainingMetricsProvider] ✅ SHARED realtime connected - ALL components will receive updates');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('[TrainingMetricsProvider] ❌', status);
            
            if (status === 'TIMED_OUT') {
              setError('Realtime connection timed out');
              setIsConnected(false);
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
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [jobId, sessionToken]);

  return (
    <TrainingMetricsContext.Provider value={{ metrics, jobStatus, isLoading, isConnected, error }}>
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
