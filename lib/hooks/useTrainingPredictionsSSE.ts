/**
 * Training Predictions SSE Hook
 *
 * Real-time updates for training predictions via Server-Sent Events.
 * Uses fetch() with ReadableStream to support authentication headers.
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { TrainingPrediction } from '@/lib/training/types/predictions-types';

interface SSEPredictionEventData {
  prediction?: TrainingPrediction;
  total_count?: number;
  timestamp?: string;
}

interface UseTrainingPredictionsSSEOptions {
  jobId: string;
  authToken?: string;
  apiKey?: string;
  enabled?: boolean;
}

interface UseTrainingPredictionsSSEReturn {
  latestPrediction: TrainingPrediction | null;
  totalCount: number;
  isConnected: boolean;
  error: string | null;
}

export function useTrainingPredictionsSSE({
  jobId,
  authToken,
  apiKey,
  enabled = true,
}: UseTrainingPredictionsSSEOptions): UseTrainingPredictionsSSEReturn {
  const [latestPrediction, setLatestPrediction] = useState<TrainingPrediction | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  const parseSSEMessage = useCallback((eventType: string, data: string) => {
    try {
      const parsed: SSEPredictionEventData = JSON.parse(data);

      if (eventType === 'connected') {
        console.log('[SSE] Connected to predictions stream:', jobId);
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      } else if (eventType === 'prediction') {
        console.log('[SSE] New prediction received');
        if (parsed.prediction) {
          setLatestPrediction(parsed.prediction);
        }
        if (parsed.total_count !== undefined) {
          setTotalCount(parsed.total_count);
        }
      } else if (eventType === 'heartbeat') {
        console.log('[SSE] Heartbeat received');
      } else if (eventType === 'error') {
        console.error('[SSE] Server error:', parsed);
        setError('Server error occurred');
      }
    } catch (err) {
      console.error('[SSE] Failed to parse message:', err);
    }
  }, [jobId]);

  const connect = useCallback(async () => {
    if (!enabled || !jobId) {
      return;
    }

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const headers: Record<string, string> = {
        'Accept': 'text/event-stream',
      };

      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      } else if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const url = `/api/training/predictions/${jobId}/stream`;
      console.log('[SSE] Connecting to:', url);

      const response = await fetch(url, {
        headers,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('[SSE] Stream ended');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            currentData = line.substring(5).trim();
          } else if (line === '' && currentEvent && currentData) {
            parseSSEMessage(currentEvent, currentData);
            currentEvent = '';
            currentData = '';
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[SSE] Connection aborted');
        return;
      }

      console.error('[SSE] Connection error:', err);
      setIsConnected(false);

      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      setError(errorMessage);

      const maxAttempts = 5;
      if (reconnectAttemptsRef.current < maxAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxAttempts})`);

        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        console.error('[SSE] Max reconnection attempts reached');
        setError('Connection failed after multiple attempts');
      }
    }
  }, [enabled, jobId, apiKey, authToken, parseSSEMessage]);

  useEffect(() => {
    connect();

    return () => {
      console.log('[SSE] Cleaning up connection for job:', jobId);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      setIsConnected(false);
    };
  }, [connect, jobId]);

  return {
    latestPrediction,
    totalCount,
    isConnected,
    error,
  };
}
