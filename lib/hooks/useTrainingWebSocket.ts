'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

export interface TrainingMetrics {
  step: number;
  loss: number;
  learning_rate: number;
  samples_per_second: number;
  gpu_utilization: number;
  gpu_memory_used: number;
  gpu_temperature: number;
  timestamp: string;
  status?: string;
  error?: string;
}

interface UseTrainingWebSocketOptions {
  jobId: string | null;
  enabled?: boolean;
  onMetrics?: (metrics: TrainingMetrics) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
}

interface UseTrainingWebSocketReturn {
  metrics: TrainingMetrics | null;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 30000;

/**
 * Hook to subscribe to real-time training metrics via WebSocket
 * 
 * Uses the Phase 3 WebSocket endpoint: /ws/training/{job_id}
 * 
 * @param options - Configuration options
 * @returns WebSocket connection state and latest metrics
 */
export function useTrainingWebSocket({
  jobId,
  enabled = true,
  onMetrics,
  onStatusChange,
  onError
}: UseTrainingWebSocketOptions): UseTrainingWebSocketReturn {
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Get WebSocket URL from environment or default to localhost
  const getWebSocketUrl = useCallback(() => {
    const baseUrl = process.env.NEXT_PUBLIC_TRAINING_BACKEND_URL 
      || process.env.LOCAL_TRAINING_SERVER_URL 
      || 'http://localhost:8000';
    
    // Convert http(s) to ws(s)
    const wsUrl = baseUrl.replace(/^http/, 'ws');
    
    return `${wsUrl}/ws/training/${jobId}`;
  }, [jobId]);

  const cleanup = useCallback(() => {
    console.log('[TrainingWebSocket] Cleaning up connection');
    
    // Clear timers
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    // Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'Component unmounted');
      } catch (err) {
        console.warn('[TrainingWebSocket] Error closing WebSocket:', err);
      }
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!jobId || !enabled || !mountedRef.current) {
      console.log('[TrainingWebSocket] Connection skipped:', { jobId, enabled, mounted: mountedRef.current });
      return;
    }

    // Clean up existing connection
    cleanup();

    try {
      const url = getWebSocketUrl();
      console.log('[TrainingWebSocket] Connecting to:', url);
      
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        
        console.log('[TrainingWebSocket] ✅ Connected to training WebSocket');
        setIsConnected(true);
        setError(null);
        retryCountRef.current = 0;
        
        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        
        try {
          const data = JSON.parse(event.data);
          
          // Handle different message types
          if (data.type === 'pong') {
            // Heartbeat response
            return;
          }
          
          if (data.type === 'status') {
            console.log('[TrainingWebSocket] Status update:', data.status);
            onStatusChange?.(data.status);
            return;
          }
          
          if (data.type === 'error') {
            console.error('[TrainingWebSocket] Server error:', data.error);
            setError(data.error);
            onError?.(data.error);
            return;
          }
          
          if (data.type === 'metrics' || data.step !== undefined) {
            // Training metrics update
            const metricsData: TrainingMetrics = {
              step: data.step || 0,
              loss: data.loss || 0,
              learning_rate: data.learning_rate || 0,
              samples_per_second: data.samples_per_second || 0,
              gpu_utilization: data.gpu_utilization || 0,
              gpu_memory_used: data.gpu_memory_used || 0,
              gpu_temperature: data.gpu_temperature || 0,
              timestamp: data.timestamp || new Date().toISOString(),
              status: data.status
            };
            
            setMetrics(metricsData);
            onMetrics?.(metricsData);
          }
        } catch (err) {
          console.error('[TrainingWebSocket] Error parsing message:', err, event.data);
        }
      };

      ws.onerror = (event) => {
        if (!mountedRef.current) return;
        
        console.error('[TrainingWebSocket] ❌ WebSocket error:', event);
        setError('WebSocket connection error');
        onError?.('WebSocket connection error');
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        
        console.log('[TrainingWebSocket] Connection closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        
        setIsConnected(false);
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        
        // Attempt reconnection if not a clean close and retries available
        if (event.code !== 1000 && retryCountRef.current < MAX_RETRIES && mountedRef.current) {
          retryCountRef.current++;
          const delay = RETRY_DELAY_MS * retryCountRef.current; // Exponential backoff
          
          console.log(`[TrainingWebSocket] Reconnecting in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, delay);
        } else if (retryCountRef.current >= MAX_RETRIES) {
          setError('Maximum reconnection attempts reached');
          onError?.('Maximum reconnection attempts reached');
        }
      };

    } catch (err) {
      console.error('[TrainingWebSocket] Error creating WebSocket:', err);
      setError(err instanceof Error ? err.message : 'Failed to create WebSocket');
      onError?.(err instanceof Error ? err.message : 'Failed to create WebSocket');
    }
  }, [jobId, enabled, getWebSocketUrl, cleanup, onMetrics, onStatusChange, onError]);

  const reconnect = useCallback(() => {
    console.log('[TrainingWebSocket] Manual reconnect requested');
    retryCountRef.current = 0;
    cleanup();
    connect();
  }, [cleanup, connect]);

  // Effect to manage connection lifecycle
  useEffect(() => {
    mountedRef.current = true;
    
    if (jobId && enabled) {
      connect();
    }
    
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [jobId, enabled, connect, cleanup]);

  return {
    metrics,
    isConnected,
    error,
    reconnect
  };
}
