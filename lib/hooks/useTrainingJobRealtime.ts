/**
 * Realtime hook for training job status updates
 * Subscribes to local_training_jobs table changes via Supabase Realtime
 *
 * Date: 2025-11-02
 * Replaces: Polling in TrainingDashboard component
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Cache for Supabase client
// IMPORTANT: Only cache ONE client at a time to prevent expired tokens from staying active
let cachedClient: { token: string | null; client: SupabaseClient } | null = null;

function getRealtimeClient(token?: string | null): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables for realtime client.');
  }

  const cacheKey = token || 'anon';

  // If we have a cached client with a different token, clear it
  // This ensures expired tokens don't keep trying to connect
  if (cachedClient && cachedClient.token !== cacheKey) {
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
    console.log('[RealtimeClient] Creating new client with token:', cacheKey === 'anon' ? 'anon' : 'user token');
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        timeout: 30000,
        params: {
          eventsPerSecond: 10
        }
      },
      global: {
        headers: token
          ? {
              Authorization: `Bearer ${token}`
            }
          : {}
      }
    });

    cachedClient = { token: cacheKey, client };
  }

  return cachedClient.client;
}

export interface TrainingJobUpdate {
  // Core fields
  id: string;
  user_id: string;
  status: string;
  model_name?: string | null;
  dataset_path?: string | null;
  base_model?: string | null;
  
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
  config?: Record<string, unknown> | null;
  
  // Training results
  final_loss?: number | null;
  final_eval_loss?: number | null;
  best_eval_loss?: number | null;
  best_epoch?: number | null;
  best_step?: number | null;
  best_checkpoint_path?: string | null;
  
  // Checkpoint resumption
  resumed_from_job_id?: string | null;
  resumed_from_checkpoint?: string | null;
  
  // Runtime parameter adjustments
  max_learning_rate?: number | null;
  min_learning_rate?: number | null;
  warmup_steps?: number | null;
  
  // Error tracking
  error_message: string | null;
  
  // Allow additional fields for forward compatibility
  [key: string]: string | number | boolean | null | undefined | Record<string, unknown>;
}

export function useTrainingJobRealtime(
  jobId: string | null | undefined,
  accessToken: string | null | undefined,
  onJobUpdate: (job: TrainingJobUpdate) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store callback in ref to avoid re-creating subscription on every render
  const callbackRef = useRef(onJobUpdate);
  useEffect(() => {
    callbackRef.current = onJobUpdate;
  }, [onJobUpdate]);

  const getClient = useCallback(getRealtimeClient, []);

  useEffect(() => {
    if (!jobId) {
      console.log('[JobRealtime] No jobId provided, skipping subscription');
      setIsConnected(false);
      return;
    }

    // Don't attempt connection without authentication
    if (!accessToken) {
      console.log('[JobRealtime] No access token, skipping subscription');
      setIsConnected(false);
      return;
    }

    console.log('[JobRealtime] Subscribing to job updates for:', jobId);

    let channel: RealtimeChannel | null = null;

    try {
      const supabaseClient = getClient(accessToken);

      const channelName = `training-job-${jobId}-${Date.now()}`;
      channel = supabaseClient
        .channel(channelName, {
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
            console.log('[JobRealtime] Job update received:', payload.new);
            callbackRef.current(payload.new as TrainingJobUpdate);
          }
        )
        .subscribe((status, err) => {
          console.log('[JobRealtime] Subscription status:', status);
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setError(null);
            console.log('[JobRealtime] ✅ Connected to training-job updates');
          } else if (status === 'CHANNEL_ERROR') {
            const message = err?.message || 'Failed to subscribe to job updates';
            setError(message);
            setIsConnected(false);
            console.error('[JobRealtime] ❌ Connection error', err);
          } else if (status === 'TIMED_OUT') {
            setError('Connection timed out');
            setIsConnected(false);
            console.error('[JobRealtime] ❌ Connection timed out');
          }
        });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      setIsConnected(false);
      console.error('[JobRealtime] Subscription error:', err);
    }

    return () => {
      console.log('[JobRealtime] Cleaning up subscription for job:', jobId);
      if (channel) {
        channel.unsubscribe();
        const supabaseClient = getClient(accessToken);
        supabaseClient.removeChannel(channel);
      }
      setIsConnected(false);
    };
  }, [accessToken, getClient, jobId]); // Removed memoizedCallback from deps

  return { isConnected, error };
}
