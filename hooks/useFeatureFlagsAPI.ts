/**
 * Feature Flags Hook - FastAPI Version
 * 
 * Uses your existing FastAPI feature flag server for real-time updates
 * Supports Server-Sent Events (SSE) for instant toggles without page refresh
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface FeatureFlagsConfig {
  apiUrl: string; // e.g., 'http://localhost:8000/api/feature-flags'
  enableSSE?: boolean; // Enable Server-Sent Events for real-time updates
  pollInterval?: number; // Fallback polling interval in ms (default: 30000)
}

export interface FeatureFlagsContextType {
  flags: Record<string, boolean>;
  isLoading: boolean;
  refresh: () => Promise<void>;
  isEnabled: (key: string) => boolean;
  error: string | null;
}

/**
 * Hook to check feature flags from FastAPI server
 * Supports real-time updates via SSE
 */
export function useFeatureFlagsAPI(config: FeatureFlagsConfig) {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      // Get user token from Supabase auth (if using Supabase for auth)
      let token: string | undefined;
      if (typeof window !== 'undefined') {
        const supabase = (await import('@/lib/supabase/client')).createClient();
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(config.apiUrl, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch flags: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle different response formats
      // Option 1: { "dag_builder": true, "chat": false }
      // Option 2: { "flags": { "dag_builder": true } }
      const flagMap = data.flags || data;
      
      console.log('[FeatureFlagsAPI] Loaded flags:', flagMap);
      setFlags(flagMap);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[FeatureFlagsAPI] Error fetching flags:', errorMsg);
      setError(errorMsg);
      setFlags({});
      setIsLoading(false);
    }
  }, [config.apiUrl]);

  // Setup polling as fallback (defined before setupSSE as it's used by setupSSE)
  const setupPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    const interval = config.pollInterval || 30000; // Default 30s
    console.log(`[FeatureFlagsAPI] Setting up polling every ${interval}ms`);

    pollIntervalRef.current = setInterval(() => {
      fetchFlags();
    }, interval);
  }, [config.pollInterval, fetchFlags]);

  // Setup Server-Sent Events for real-time updates
  const setupSSE = useCallback(() => {
    if (!config.enableSSE) return;

    try {
      const sseUrl = `${config.apiUrl}/stream`;
      console.log('[FeatureFlagsAPI] Connecting to SSE:', sseUrl);

      const eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[FeatureFlagsAPI] SSE update:', data);

          // Handle different message types
          if (data.type === 'flags_update') {
            setFlags(data.flags);
          } else if (data.type === 'flag_toggle') {
            // Single flag update: { type: 'flag_toggle', key: 'dag_builder', enabled: true }
            setFlags(prev => ({
              ...prev,
              [data.key]: data.enabled
            }));
          } else {
            // Full flag object
            setFlags(data.flags || data);
          }
        } catch (err) {
          console.error('[FeatureFlagsAPI] Error parsing SSE data:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('[FeatureFlagsAPI] SSE error:', err);
        eventSource.close();

        // Fallback to polling
        setupPolling();
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error('[FeatureFlagsAPI] Failed to setup SSE:', err);
      setupPolling();
    }
  }, [config.apiUrl, config.enableSSE, setupPolling]);

  useEffect(() => {
    // Initial fetch
    fetchFlags();

    // Setup real-time updates
    if (config.enableSSE) {
      setupSSE();
    } else {
      // Fallback to polling
      setupPolling();
    }

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        console.log('[FeatureFlagsAPI] Closing SSE connection');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [config.apiUrl, config.enableSSE, config.pollInterval, fetchFlags, setupPolling, setupSSE]);

  return {
    flags,
    isLoading,
    refresh: fetchFlags,
    isEnabled: (key: string) => flags[key] === true,
    error,
  };
}

/**
 * Feature Flag Component for conditional rendering
 */
export function FeatureGateAPI({ 
  feature, 
  children,
  fallback = null,
  config
}: { 
  feature: string; 
  children: React.ReactNode;
  fallback?: React.ReactNode;
  config: FeatureFlagsConfig;
}) {
  const { isEnabled, isLoading } = useFeatureFlagsAPI(config);
  
  if (isLoading) {
    return null; // or a loading spinner
  }

  return isEnabled(feature) ? (children as React.ReactElement) : ((fallback as React.ReactElement) || null);
}

/**
 * Export a configured version for easy use
 */
export function createFeatureFlagsHook(config: FeatureFlagsConfig) {
  return () => useFeatureFlagsAPI(config);
}
