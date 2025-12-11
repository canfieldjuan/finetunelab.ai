/**
 * useDeploymentStatus Hook
 *
 * Custom React hook for monitoring inference deployment status
 * - Polls deployment status at regular intervals
 * - Returns current status, metrics, and cost tracking
 * - Automatically stops polling when deployment is stopped/failed
 * - Provides refresh function for manual updates
 *
 * Phase: Phase 6 - Budget Controls & Testing
 * Date: 2025-11-12
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { InferenceDeploymentRecord } from '@/lib/inference/deployment.types';
import { calculateBudgetStatus, getBudgetAlert } from '@/lib/inference/budget-monitor';
import type { BudgetStatus, BudgetAlert } from '@/lib/inference/budget-monitor';

export interface UseDeploymentStatusOptions {
  deploymentId: string;
  accessToken?: string;
  enabled?: boolean;
  pollInterval?: number; // milliseconds
  onBudgetAlert?: (alert: BudgetAlert) => void;
  onStatusChange?: (status: string) => void;
}

export interface UseDeploymentStatusReturn {
  deployment: InferenceDeploymentRecord | null;
  budgetStatus: BudgetStatus | null;
  budgetAlert: BudgetAlert | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

/**
 * Hook to monitor deployment status with automatic polling
 */
export function useDeploymentStatus({
  deploymentId,
  accessToken,
  enabled = true,
  pollInterval = 10000, // 10 seconds default
  onBudgetAlert,
  onStatusChange,
}: UseDeploymentStatusOptions): UseDeploymentStatusReturn {
  const [deployment, setDeployment] = useState<InferenceDeploymentRecord | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [budgetAlert, setBudgetAlert] = useState<BudgetAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<string | null>(null);
  const lastAlertRef = useRef<BudgetAlert | null>(null);

  /**
   * Fetch deployment status from API
   */
  const fetchStatus = useCallback(async () => {
    if (!deploymentId || !accessToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/inference/deployments/${deploymentId}/status`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch deployment status');
      }

      const data = await response.json();

      if (data.success && data.deployment) {
        const deploymentData = data.deployment as InferenceDeploymentRecord;
        setDeployment(deploymentData);

        // Calculate budget status
        if (deploymentData.budget_limit) {
          const status = calculateBudgetStatus(
            deploymentData.current_spend,
            deploymentData.budget_limit,
            deploymentData.request_count,
            deploymentData.cost_per_request || 0
          );
          setBudgetStatus(status);

          // Check for budget alerts
          const alert = getBudgetAlert(
            deploymentData.current_spend,
            deploymentData.budget_limit
          );
          setBudgetAlert(alert);

          // Trigger alert callback if alert changed
          if (alert && alert.level !== lastAlertRef.current?.level && onBudgetAlert) {
            onBudgetAlert(alert);
            lastAlertRef.current = alert;
          }
        }

        // Trigger status change callback
        if (deploymentData.status !== lastStatusRef.current && onStatusChange) {
          onStatusChange(deploymentData.status);
          lastStatusRef.current = deploymentData.status;
        }

        setLastUpdated(new Date());
        setError(null);
      } else {
        throw new Error(data.error?.message || 'Failed to load deployment');
      }
    } catch (err) {
      console.error('[useDeploymentStatus] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [deploymentId, accessToken, onBudgetAlert, onStatusChange]);

  /**
   * Start polling
   */
  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Fetch immediately
    fetchStatus();

    // Then poll at interval
    intervalRef.current = setInterval(() => {
      fetchStatus();
    }, pollInterval);
  }, [fetchStatus, pollInterval]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Manual refresh
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchStatus();
  }, [fetchStatus]);

  /**
   * Effect: Start/stop polling based on enabled and deployment status
   */
  useEffect(() => {
    if (!enabled || !deploymentId || !accessToken) {
      stopPolling();
      return;
    }

    // Stop polling if deployment is in terminal state
    if (deployment && ['stopped', 'failed', 'error'].includes(deployment.status)) {
      stopPolling();
      return;
    }

    startPolling();

    return () => {
      stopPolling();
    };
  }, [enabled, deploymentId, accessToken, deployment, startPolling, stopPolling]);

  return {
    deployment,
    budgetStatus,
    budgetAlert,
    loading,
    error,
    refresh,
    lastUpdated,
  };
}

/**
 * Simplified hook for just checking if deployment is active
 */
export function useIsDeploymentActive(
  deploymentId: string,
  accessToken?: string
): boolean {
  const { deployment } = useDeploymentStatus({
    deploymentId,
    accessToken,
    enabled: !!deploymentId && !!accessToken,
    pollInterval: 30000, // Check every 30 seconds
  });

  return deployment?.status === 'active';
}

/**
 * Hook to monitor budget and alert when thresholds crossed
 */
export function useDeploymentBudgetMonitor(
  deploymentId: string,
  accessToken?: string,
  onAlert?: (alert: BudgetAlert) => void
): {
  budgetStatus: BudgetStatus | null;
  alert: BudgetAlert | null;
  isOverBudget: boolean;
} {
  const { budgetStatus, budgetAlert } = useDeploymentStatus({
    deploymentId,
    accessToken,
    enabled: !!deploymentId && !!accessToken,
    pollInterval: 5000, // Check every 5 seconds for budget
    onBudgetAlert: onAlert,
  });

  return {
    budgetStatus,
    alert: budgetAlert,
    isOverBudget: budgetStatus?.isOverBudget || false,
  };
}
