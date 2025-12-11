// Analytics Insights Hook - Manages insights state and generation
// Phase 12: Analytics Tools Integration
// Date: October 13, 2025

'use client';

import { useState, useCallback } from 'react';
import { generateInsights, InsightData } from '@/lib/analytics/insightsService';
import {
  getCachedInsights,
  setCachedInsights,
  clearCachedInsights,
  isCacheValid,
} from '@/lib/analytics/insightsCache';

export interface UseAnalyticsInsightsResult {
  insights: InsightData[] | null;
  loading: boolean;
  error: string | null;
  isCached: boolean;
  generateInsights: () => Promise<void>;
  clearInsights: () => void;
}

/**
 * Hook to manage analytics insights generation and caching
 */
export function useAnalyticsInsights(
  userId: string,
  timeRange: string
): UseAnalyticsInsightsResult {
  const [insights, setInsights] = useState<InsightData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  /**
   * Generate fresh insights from analytics tools
   */
  const handleGenerateInsights = useCallback(async () => {
    // Check cache first
    if (isCacheValid()) {
      const cached = getCachedInsights();
      if (cached) {
        console.log('[useAnalyticsInsights] Using cached insights');
        setInsights(cached as InsightData[]);
        setIsCached(true);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setIsCached(false);

    try {
      console.log('[useAnalyticsInsights] Generating insights...', {
        userId,
        timeRange,
      });

      const freshInsights = await generateInsights(userId, timeRange);

      console.log('[useAnalyticsInsights] Generated insights:', {
        count: freshInsights.length,
      });

      setInsights(freshInsights);
      setCachedInsights(freshInsights);
      setIsCached(false);
    } catch (err) {
      console.error('[useAnalyticsInsights] Error generating insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange]);

  /**
   * Clear insights and cache
   */
  const handleClearInsights = useCallback(() => {
    console.log('[useAnalyticsInsights] Clearing insights');
    setInsights(null);
    setError(null);
    setIsCached(false);
    clearCachedInsights();
  }, []);

  return {
    insights,
    loading,
    error,
    isCached,
    generateInsights: handleGenerateInsights,
    clearInsights: handleClearInsights,
  };
}
