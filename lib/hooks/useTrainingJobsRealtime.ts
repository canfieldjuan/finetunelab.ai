/**
 * Realtime hook for training jobs list
 * Subscribes to local_training_jobs table for all user's jobs
 * 
 * Date: 2025-11-03
 * Purpose: Real-time updates for jobs list in monitor page
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Cache for Supabase clients
// IMPORTANT: Only cache ONE client at a time to prevent expired tokens from staying active
let cachedClient: { token: string | null; client: SupabaseClient } | null = null;

function getRealtimeClient(accessToken?: string | null): SupabaseClient {
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
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: accessToken ? {
          Authorization: `Bearer ${accessToken}`
        } : {}
      },
      realtime: {
        timeout: 60000, // Increase to 60 seconds
        heartbeatIntervalMs: 15000, // Send heartbeat every 15s to keep connection alive
        params: {
          eventsPerSecond: 10
        }
      }
    });
    cachedClient = { token: key, client };
  }

  return cachedClient.client;
}

export interface TrainingJob {
  // Core fields
  id: string;
  user_id: string;
  status: string;
  model_name: string | null;
  dataset_path: string | null;
  base_model: string | null;
  
  // Timestamps
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  
  // Progress tracking
  current_step: number | null;
  current_epoch: number | null;
  total_steps: number | null;
  total_epochs: number | null;
  progress: number | null;
  
  // Training parameters
  learning_rate: number | null;
  batch_size: number | null;
  gradient_accumulation_steps: number | null;
  
  // Real-time metrics
  loss: number | null;
  eval_loss: number | null;
  grad_norm: number | null;
  perplexity: number | null;
  train_perplexity: number | null;
  
  // Resource metrics
  gpu_memory_allocated_gb: number | null;
  gpu_memory_reserved_gb: number | null;
  gpu_utilization_percent: number | null;
  samples_per_second: number | null;
  
  // Timing
  elapsed_seconds: number | null;
  remaining_seconds: number | null;
  
  // Advanced metrics
  epochs_without_improvement: number | null;
  loss_trend: string | null;
  total_samples: number | null;
  train_samples: number | null;
  val_samples: number | null;
  total_tokens_processed: number | null;
  
  // Training configuration
  config: Record<string, unknown> | null;
  
  // Training results
  final_loss: number | null;
  final_eval_loss: number | null;
  best_eval_loss: number | null;
  best_epoch: number | null;
  best_step: number | null;
  best_checkpoint_path: string | null;
  
  // Checkpoint resumption
  resumed_from_job_id: string | null;
  resumed_from_checkpoint: string | null;
  
  // Runtime parameter adjustments
  max_learning_rate: number | null;
  min_learning_rate: number | null;
  warmup_steps: number | null;
  
  // Error tracking
  error_message: string | null;

  // Advanced training features (Phase 4 - Database Schema Match)
  resume_from_checkpoint: string | null;
  num_gpus: number | null;
  distributed_strategy: string | null;
  parameter_updates: Array<Record<string, unknown>> | null;
  last_parameter_update_at: string | null;

  // Allow additional fields for forward compatibility
  [key: string]: string | number | boolean | null | undefined | Record<string, unknown> | Array<Record<string, unknown>>;
}

export function useTrainingJobsRealtime(
  userId: string | null | undefined,
  accessToken: string | null | undefined
) {
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use ref to track if we've done initial load
  const hasLoadedRef = useRef(false);

  // Fallback: poll for updates if realtime fails
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Reset hasLoadedRef when userId changes (e.g., auth completes)
  useEffect(() => {
    console.log('[JobsRealtime] UserId changed, resetting hasLoadedRef');
    hasLoadedRef.current = false;
  }, [userId]);

  useEffect(() => {
    console.log('[JobsRealtime] ========== useEffect RUN ==========', { userId, hasLoaded: hasLoadedRef.current });

    if (!userId || !accessToken) {
      console.log('[JobsRealtime] No userId or token, skipping');
      setIsConnected(false);
      setJobs([]);
      setIsLoading(false);
      return;
    }

    const supabase = getRealtimeClient(accessToken);
    let isSubscribed = true;

    const stopFallbackPolling = () => {
      if (pollingIntervalRef.current) {
        console.log('[JobsRealtime] Stopping fallback polling');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    const fetchLatestJobs = async () => {
      const { data, error: fetchError } = await supabase
        .from('local_training_jobs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) {
        throw fetchError;
      }

      return data || [];
    };

    const startFallbackPolling = () => {
      if (pollingIntervalRef.current) {
        return;
      }

      console.log('[JobsRealtime] Starting fallback polling (30s interval)');

      const poll = async () => {
        try {
          const latestJobs = await fetchLatestJobs();
          setJobs(latestJobs);
        } catch (pollError) {
          console.error('[JobsRealtime] Polling error:', pollError);
        }
      };

      // Run immediately before interval kicks in
      poll();
      pollingIntervalRef.current = setInterval(poll, 30000);
    };

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const cleanupChannel = () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe().catch(err => {
          console.warn('[JobsRealtime] Error unsubscribing channel:', err);
        });
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };

    function scheduleReconnect() {
      if (reconnectTimeoutRef.current) {
        return;
      }

      const attempt = reconnectAttemptsRef.current + 1;
      const delay = Math.min(30000, attempt * 5000);
      console.log(`[JobsRealtime] Scheduling reconnect attempt #${attempt} in ${delay}ms`);

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        reconnectAttemptsRef.current = attempt;
        setupRealtimeSubscription();
      }, delay);
    }

    const handleRealtimeFailure = (message: string, status: string, err?: unknown) => {
      console.error('[JobsRealtime] ❌ Connection issue:', status, message, err);
      setError(message);
      setIsConnected(false);
      startFallbackPolling();
      scheduleReconnect();
    };

    async function setupRealtimeSubscription() {
      console.log('[JobsRealtime] Setting up real-time subscription for user:', userId);
      clearReconnectTimeout();
      cleanupChannel();
      stopFallbackPolling();

      try {
        if (!hasLoadedRef.current) {
          console.log('[JobsRealtime] Fetching initial jobs...');
          const latestJobs = await fetchLatestJobs();
          console.log('[JobsRealtime] Initial jobs loaded:', latestJobs.length);
          setJobs(latestJobs);
          hasLoadedRef.current = true;
        }
      } catch (fetchError) {
        console.error('[JobsRealtime] Error fetching jobs:', fetchError);
        const message = fetchError instanceof Error ? fetchError.message : 'Failed to fetch jobs';
        setError(message);
      } finally {
        setIsLoading(false);
      }

      const channelName = `training-jobs-${userId}-${Date.now()}`;
      channelRef.current = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'local_training_jobs',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('[JobsRealtime] ✅ New job inserted:', payload.new);
            setJobs(prevJobs => {
              const newJob = payload.new as TrainingJob;
              return [newJob, ...prevJobs];
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'local_training_jobs',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
              console.log('[JobsRealtime] 🔄 Job updated:', payload.new);
            }

            setJobs(prevJobs => {
              const updatedJob = payload.new as TrainingJob;
              const existingJob = prevJobs.find(j => j.id === updatedJob.id);

              if (existingJob &&
                  existingJob.status === updatedJob.status &&
                  existingJob.loss === updatedJob.loss &&
                  existingJob.current_step === updatedJob.current_step) {
                return prevJobs;
              }

              return prevJobs.map(job =>
                job.id === updatedJob.id ? updatedJob : job
              );
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'local_training_jobs',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('[JobsRealtime] ❌ Job deleted:', payload.old);
            setJobs(prevJobs => 
              prevJobs.filter(job => job.id !== (payload.old as TrainingJob).id)
            );
          }
        )
        .subscribe((status, err) => {
          if (!isSubscribed) return;

          if (status === 'SUBSCRIBED') {
            stopFallbackPolling();
            clearReconnectTimeout();
            reconnectAttemptsRef.current = 0;
            setIsConnected(true);
            setError(null);
            console.log('[JobsRealtime] ✅ Connected to jobs updates');
          } else if (status === 'CHANNEL_ERROR') {
            const message = (err && typeof err === 'object')
              ? ((err as { message?: string }).message || JSON.stringify(err))
              : (err || 'Realtime connection failed');
            handleRealtimeFailure(message, status, err);
          } else if (status === 'TIMED_OUT') {
            handleRealtimeFailure('Connection timed out - check network or Supabase status', status, err);
          } else if (status === 'CLOSED') {
            handleRealtimeFailure('Connection closed', status, err);
          }
        });
    }

    setupRealtimeSubscription();

    return () => {
      console.log('[JobsRealtime] Cleaning up subscription');
      isSubscribed = false;
      stopFallbackPolling();
      clearReconnectTimeout();
      cleanupChannel();
      setIsConnected(false);
    };
  }, [userId, accessToken]);

  return { jobs, isConnected, error, isLoading };
}
