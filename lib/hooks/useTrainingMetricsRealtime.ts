'use client';

import { useEffect, useState } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Cache for authenticated Supabase client
// IMPORTANT: Only cache ONE client at a time to prevent expired tokens from staying active
let cachedClient: { token: string | null; client: SupabaseClient } | null = null;

function getAuthenticatedClient(accessToken?: string | null): SupabaseClient {
  const key = accessToken || 'anon';

  // If we have a cached client with a different token, clear it
  // This ensures expired tokens don't keep trying to connect
  if (cachedClient && cachedClient.token !== key) {
    console.log('[RealtimeClient] Token changed, clearing old client and all channels');
    
    // Remove all channels from the old client before clearing it
    const oldClient = cachedClient.client;
    const channels = oldClient.getChannels();
    console.log('[RealtimeClient] Removing', channels.length, 'channels from old client');
    
    channels.forEach(channel => {
      oldClient.removeChannel(channel);
    });
    
    cachedClient = null;
  }

  // Create new client if we don't have one or it was cleared
  if (!cachedClient) {
    console.log('[RealtimeClient] Creating new client with token:', key === 'anon' ? 'anon' : 'user token');
    
    // Validate token before creating client
    if (accessToken && accessToken.split('.').length !== 3) {
      console.error('[RealtimeClient] Invalid JWT token format, using anon instead');
      accessToken = null;
    }
    
    // CRITICAL FIX: In server/Node.js environments where this hook might be used server-side,
    // we need to explicitly provide WebSocket constructor. This is auto-detected in browsers.
    // For browser-only usage, this check won't affect anything.
    const realtimeConfig = {
      timeout: 60000, // Increase to 60 seconds
      heartbeatIntervalMs: 15000, // Send heartbeat every 15s to keep connection alive
      params: {
        eventsPerSecond: 10
      }
    };

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: accessToken ? {
          Authorization: `Bearer ${accessToken}`
        } : {}
      },
      realtime: realtimeConfig
    });
    
    console.log('[RealtimeClient] Client created with config:', {
      url: supabaseUrl,
      hasToken: !!accessToken,
      timeout: 60000,
      heartbeat: 15000
    });
    
    cachedClient = { token: key, client };
  }

  return cachedClient.client;
}

export interface MetricPoint {
  step: number;
  epoch: number;
  train_loss: number | null;
  eval_loss: number | null;
  perplexity: number | null;
  train_perplexity: number | null;
  learning_rate: number | null;
  tokens_per_second: number | null;
  samples_per_second: number | null;
  gpu_utilization_percent: number | null;
  gpu_memory_allocated_gb: number | null;
  gpu_memory_reserved_gb: number | null;
  grad_norm: number | null;
  timestamp: string;
}

export interface JobStatus {
  id: string;
  user_id: string;
  status: string;
  model_name: string | null;
  dataset_path: string | null;

  // Progress tracking (added in migration 20251103000002)
  current_step: number | null;
  current_epoch: number | null;
  progress: number | null;

  total_epochs: number | null;
  total_steps: number | null;
  total_samples: number | null;

  // Training parameters (added in migration 20251103000002)
  learning_rate: number | null;
  batch_size: number | null;
  gradient_accumulation_steps: number | null;

  // Timestamps
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  created_at: string;

  // Training results
  best_eval_loss: number | null;
  best_epoch: number | null;
  best_step: number | null;
  best_checkpoint_path: string | null;
  loss_trend: string | null;
  final_loss: number | null;
  final_eval_loss: number | null;

  // Error tracking (added in migration 20251103000002)
  error_message: string | null;

  // Configuration
  config: Record<string, unknown> | null;
  
  // Checkpoint resumption
  resumed_from_job_id?: string | null;
  resumed_from_checkpoint?: string | null;
  
  // Runtime parameter adjustments
  max_learning_rate?: number | null;
  min_learning_rate?: number | null;
  warmup_steps?: number | null;
  
  // Allow additional fields from database
  [key: string]: string | number | boolean | null | undefined | Record<string, unknown>;
}

export function useTrainingMetricsRealtime(
  jobId: string | null | undefined,
  accessToken?: string | null
) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!jobId) {
      console.log('[TrainingRealtime] No jobId provided, skipping subscription');
      setIsConnected(false);
      setJobStatus(null);
      setMetrics([]);
      return;
    }

    // Don't attempt connection without authentication
    if (!accessToken) {
      console.log('[TrainingRealtime] No access token, skipping subscription');
      setIsConnected(false);
      setJobStatus(null);
      setMetrics([]);
      setIsLoading(false);
      return;
    }

    console.log('[TrainingRealtime] Initializing for job:', jobId);
    setIsLoading(true);
    setError(null);

    // Get cached authenticated Supabase client (reuses same instance across all hooks)
    const supabase = getAuthenticatedClient(accessToken);

    let isSubscribed = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    // Metric batching: buffer incoming metrics and update state periodically
    // This reduces re-renders from hundreds to ~30 per minute while maintaining real-time feel
    let metricBuffer: MetricPoint[] = [];
    let batchFlushTimer: NodeJS.Timeout | null = null;
    const BATCH_FLUSH_INTERVAL_MS = 2000; // Flush every 2 seconds

    const flushMetricBuffer = () => {
      if (metricBuffer.length > 0 && isSubscribed) {
        console.log(`[TrainingRealtime] Flushing ${metricBuffer.length} buffered metrics`);
        setMetrics((prevMetrics) => [...prevMetrics, ...metricBuffer]);
        metricBuffer = [];
      }
    };

    const scheduleFlush = () => {
      if (!batchFlushTimer) {
        batchFlushTimer = setTimeout(() => {
          flushMetricBuffer();
          batchFlushTimer = null;
        }, BATCH_FLUSH_INTERVAL_MS);
      }
    };

    // Fetch initial data
    const fetchInitialData = async () => {
      try {
        // Fetch job status
        const { data: job, error: jobError } = await supabase
          .from('local_training_jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (!isSubscribed) return;

        console.log('[TrainingRealtime] Job fetch response:', { job, jobError });

        if (jobError) {
          console.error('[TrainingRealtime] Error fetching job:', {
            message: jobError.message,
            code: jobError.code,
            details: jobError.details,
            hint: jobError.hint
          });
          setError(`Failed to load job: ${jobError.message}`);
        } else if (job) {
          console.log('[TrainingRealtime] Initial job status loaded:', job.status);
          setJobStatus(job as JobStatus);
        } else {
          console.warn('[TrainingRealtime] No job data returned');
        }

        // Fetch existing metrics (latest 1000 to avoid loading thousands of metrics)
        const { data: existingMetrics, error: metricsError } = await supabase
          .from('local_training_metrics')
          .select('*')
          .eq('job_id', jobId)
          .order('step', { ascending: false })
          .limit(1000);

        if (!isSubscribed) return;

        console.log('[TrainingRealtime] Metrics fetch response:', { 
          count: existingMetrics?.length || 0, 
          metricsError,
          sampleMetrics: existingMetrics?.slice(0, 3), // Show first 3 metrics
          lastMetric: existingMetrics?.[existingMetrics.length - 1] // Show last metric
        });
        
        // Debug: Log detailed field values from first metric
        if (existingMetrics && existingMetrics.length > 0) {
          const firstMetric = existingMetrics[0];
          console.log('[TrainingRealtime] First metric detailed values:', {
            step: firstMetric.step,
            train_loss: firstMetric.train_loss,
            eval_loss: firstMetric.eval_loss,
            perplexity: firstMetric.perplexity,
            train_perplexity: firstMetric.train_perplexity,
            learning_rate: firstMetric.learning_rate,
            tokens_per_second: firstMetric.tokens_per_second,
            gpu_utilization_percent: firstMetric.gpu_utilization_percent,
            gpu_memory_allocated_gb: firstMetric.gpu_memory_allocated_gb,
            grad_norm: firstMetric.grad_norm,
          });
        }

        if (metricsError) {
          console.error('[TrainingRealtime] Error fetching metrics:', {
            message: metricsError.message,
            code: metricsError.code,
            details: metricsError.details,
            hint: metricsError.hint
          });
        } else if (existingMetrics) {
          // Reverse array since we fetched in descending order (newest first)
          // but UI expects ascending order (oldest first) for chart display
          const metricsAscending = existingMetrics.reverse();
          console.log('[TrainingRealtime] Loaded', metricsAscending.length, 'existing metrics');
          console.log('[TrainingRealtime] Steps:', metricsAscending.map(m => m.step).slice(-10)); // Show last 10 steps
          setMetrics(metricsAscending as MetricPoint[]);
        } else {
          console.warn('[TrainingRealtime] No metrics data returned');
        }
      } catch (err) {
        if (!isSubscribed) return;
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[TrainingRealtime] Fetch error:', err);
        setError(errorMsg);
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    fetchInitialData();

    // Set up real-time subscriptions with retry
    const setupChannel = () => {
      console.log('[TrainingRealtime] Setting up realtime subscriptions (attempt', retryCount + 1, ')');

      // Use consistent channel name to prevent infinite re-renders
      const channel = supabase
        .channel(`training-realtime-${jobId}`, {
          config: {
            broadcast: { self: false },
            presence: { key: '' }
          }
        })
        // Subscribe to job status updates
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'local_training_jobs',
            filter: `id=eq.${jobId}`
          },
          (payload) => {
            if (!isSubscribed) return;
            console.log('[TrainingRealtime] Job status updated:', payload.new);
            setJobStatus(payload.new as JobStatus);
          }
        )
        // Subscribe to new metrics
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'local_training_metrics',
            filter: `job_id=eq.${jobId}`
          },
          (payload) => {
            if (!isSubscribed) return;
            console.log('[TrainingRealtime] New metric received:', payload.new);

            // Buffer the metric instead of immediately updating state
            // This batches updates and reduces re-renders dramatically
            metricBuffer.push(payload.new as MetricPoint);
            scheduleFlush();
          }
        )
        .subscribe((status, err) => {
          if (!isSubscribed) return;

          console.log('[TrainingRealtime] Subscription status:', status, err ? `Error: ${JSON.stringify(err)}` : '');
          
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setError(null);
            retryCount = 0; // Reset retry count on success
            console.log('[TrainingRealtime] ✅ Realtime connected');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Handle undefined/null err gracefully and extract detailed error info
            let errorMsg = status === 'TIMED_OUT' ? 'Connection timed out' : 'Channel connection failed';
            let errorDetails = '';
            
            if (err) {
              if (typeof err === 'object') {
                // Extract as much error detail as possible
                const errObj = err as unknown as Record<string, unknown>;
                errorMsg = String(errObj.message || errObj.error || JSON.stringify(err));
                errorDetails = JSON.stringify(err, null, 2);
                
                // Check for common auth issues
                if (errorMsg.includes('JWT') || errorMsg.includes('token') || errorMsg.includes('auth')) {
                  errorMsg = 'Authentication error - please refresh the page';
                }
              } else {
                errorMsg = String(err);
              }
            }
            
            console.error(`[TrainingRealtime] ❌ ${status}:`, {
              status,
              error: err,
              errorType: typeof err,
              errorMsg,
              errorDetails,
              hasAccessToken: !!accessToken,
              jobId,
              supabaseUrl
            });
            
            if (status === 'TIMED_OUT') {
              const realtimeError = 'Realtime connection timed out.\n\n' +
                'REQUIRED: Enable Realtime in Supabase:\n' +
                '1. Go to Supabase Dashboard > Project Settings > API\n' +
                '2. Scroll to "Realtime" section and enable it\n' +
                '3. Enable replication for tables: local_training_jobs, local_training_metrics\n' +
                '4. Ensure RLS policies allow realtime subscriptions\n\n' +
                'Without realtime, metrics will NOT update during training.';
              
              console.error('[TrainingRealtime] 🔥 CRITICAL:', realtimeError);
              setError(realtimeError);
              setIsConnected(false);
            } else if (retryCount < MAX_RETRIES) {
              retryCount++;
              console.log('[TrainingRealtime] Retrying connection in 2 seconds... (attempt', retryCount, 'of', MAX_RETRIES, ')');
              setTimeout(() => {
                if (isSubscribed) {
                  channel.unsubscribe();
                  setupChannel();
                }
              }, 2000);
            } else {
              const finalError = `${errorMsg}.\n\nFailed after ${MAX_RETRIES} attempts.\n\n` +
                'This usually means Realtime is not enabled in Supabase.\n' +
                'Please enable it in Project Settings > API > Realtime.';
              console.error('[TrainingRealtime] ⚠️ Max retries reached:', finalError);
              setError(finalError);
              setIsConnected(false);
            }
          } else if (status === 'CLOSED') {
            console.log('[TrainingRealtime] Connection closed');
            setIsConnected(false);
          }
        });

      return channel;
    };

    const channel = setupChannel();

    return () => {
      console.log('[TrainingRealtime] Cleaning up subscription for job:', jobId);
      isSubscribed = false;

      // Flush any remaining buffered metrics before cleanup
      if (batchFlushTimer) {
        clearTimeout(batchFlushTimer);
        batchFlushTimer = null;
      }
      flushMetricBuffer();

      channel.unsubscribe();
      setIsConnected(false);
    };
  }, [jobId, accessToken]);

  return { jobStatus, metrics, isConnected, isLoading, error };
}
