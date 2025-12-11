// Agent Status Hook
// Phase 3: Web UI Integration - Agent detection and status monitoring

import { useState, useEffect, useCallback } from 'react';
import { agentConfig } from '@/lib/config/agent';

export interface AgentStatus {
  isConnected: boolean;
  isChecking: boolean;
  error: string | null;
  agentUrl: string;
  lastChecked: Date | null;
  version?: string;
}

export interface UseAgentStatusOptions {
  agentUrl?: string;
  pollInterval?: number;
  enabled?: boolean;
}

export function useAgentStatus(options: UseAgentStatusOptions = {}) {
  const {
    agentUrl = agentConfig.server.url,
    pollInterval = agentConfig.healthCheck.pollInterval,
    enabled = true
  } = options;

  const [status, setStatus] = useState<AgentStatus>({
    isConnected: false,
    isChecking: false,
    error: null,
    agentUrl,
    lastChecked: null
  });

  const checkAgentStatus = useCallback(async () => {
    if (!enabled) {
      return;
    }

    console.log('[useAgentStatus] Checking agent at:', agentUrl);

    setStatus(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), agentConfig.healthCheck.timeout);

      const response = await fetch(`${agentUrl}${agentConfig.healthCheck.endpoint}`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Agent returned status ${response.status}`);
      }

      const data = await response.json();

      console.log('[useAgentStatus] Agent connected:', data);

      setStatus({
        isConnected: true,
        isChecking: false,
        error: null,
        agentUrl,
        lastChecked: new Date(),
        version: data.version
      });
    } catch (error: unknown) {
      // Handle abort errors specifically (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('[useAgentStatus] Agent check timed out');
        setStatus({
          isConnected: false,
          isChecking: false,
          error: 'Connection timeout',
          agentUrl,
          lastChecked: new Date()
        });
        return;
      }

      // Handle other errors
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
      console.error('[useAgentStatus] Agent check failed:', errorMessage);

      setStatus({
        isConnected: false,
        isChecking: false,
        error: errorMessage,
        agentUrl,
        lastChecked: new Date()
      });
    }
  }, [agentUrl, enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    checkAgentStatus();

    if (pollInterval > 0) {
      const intervalId = setInterval(checkAgentStatus, pollInterval);
      return () => clearInterval(intervalId);
    }
  }, [checkAgentStatus, pollInterval, enabled]);

  const retry = useCallback(() => {
    checkAgentStatus();
  }, [checkAgentStatus]);

  return {
    ...status,
    retry
  };
}
