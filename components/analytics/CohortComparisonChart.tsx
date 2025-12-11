/**
 * Cohort Comparison Chart Component
 *
 * Visual comparison of metrics across multiple cohorts.
 * Displays bar charts for key metrics with baseline comparison.
 *
 * Phase 3.2: Cohort Analysis UI
 * Date: 2025-10-25
 */

"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Cohort } from '@/lib/services/cohort.service';
import { supabase } from '@/lib/supabaseClient';

interface CohortComparisonChartProps {
  cohortIds: string[];
}

interface CohortMetrics {
  cohortId: string;
  cohortName: string;
  memberCount: number;
  averageRating: number;
  successRate: number;
  costPerSession: number;
}

export default function CohortComparisonChart({
  cohortIds
}: CohortComparisonChartProps) {
  console.log('[CohortComparisonChart] Rendering with cohorts:', cohortIds);

  const [metrics, setMetrics] = useState<CohortMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    console.log('[CohortComparisonChart] Starting fetch');
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      const metricsData: CohortMetrics[] = [];

      for (const cohortId of cohortIds) {
        console.log('[CohortComparisonChart] Fetching:', cohortId);

        const response = await fetch(`/api/analytics/cohorts/${cohortId}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });

        if (!response.ok) {
          console.error('[CohortComparisonChart] Failed for:', cohortId);
          continue;
        }

        const data = await response.json();
        const cohort = data.cohort as Cohort;

        metricsData.push({
          cohortId: cohort.id,
          cohortName: cohort.name,
          memberCount: cohort.member_count,
          averageRating: cohort.average_rating || 0,
          successRate: cohort.average_success_rate || 0,
          costPerSession: cohort.average_cost_per_session || 0
        });
      }

      console.log('[CohortComparisonChart] Loaded', metricsData.length, 'metrics');
      setMetrics(metricsData);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load metrics';
      console.error('[CohortComparisonChart] Error:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [cohortIds]);

  // useEffect after fetchMetrics is defined
  useEffect(() => {
    if (cohortIds.length === 0) {
      console.log('[CohortComparisonChart] No cohorts to compare');
      setMetrics([]);
      setLoading(false);
      return;
    }

    console.log('[CohortComparisonChart] Fetching metrics for comparison');
    fetchMetrics();
  }, [cohortIds, fetchMetrics]);

  const getMaxValue = (key: keyof CohortMetrics): number => {
    if (metrics.length === 0) return 1;
    const values = metrics.map(m => Number(m[key]) || 0);
    return Math.max(...values, 1);
  };

  const getBarWidth = (value: number, maxValue: number): string => {
    if (maxValue === 0) return '0%';
    const percentage = (value / maxValue) * 100;
    return `${Math.min(percentage, 100)}%`;
  };

  const formatValue = (key: keyof CohortMetrics, value: number): string => {
    if (key === 'costPerSession') return `$${value.toFixed(4)}`;
    if (key === 'successRate') return `${(value * 100).toFixed(1)}%`;
    if (key === 'averageRating') return value.toFixed(2);
    return value.toFixed(0);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-gray-600">
            Loading comparison data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-red-600">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (metrics.length === 0) {
    return null;
  }

  const comparisonMetrics = [
    { key: 'memberCount' as keyof CohortMetrics, label: 'Member Count', color: 'bg-blue-500' },
    { key: 'averageRating' as keyof CohortMetrics, label: 'Average Rating', color: 'bg-green-500' },
    { key: 'successRate' as keyof CohortMetrics, label: 'Success Rate', color: 'bg-purple-500' },
    { key: 'costPerSession' as keyof CohortMetrics, label: 'Cost Per Session', color: 'bg-orange-500' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cohort Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {comparisonMetrics.map(({ key, label, color }) => {
            const maxValue = getMaxValue(key);

            return (
              <div key={key}>
                <h4 className="text-sm font-medium text-gray-900 mb-3">{label}</h4>
                <div className="space-y-2">
                  {metrics.map(metric => (
                    <div key={metric.cohortId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 truncate max-w-[200px]">
                          {metric.cohortName}
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatValue(key, Number(metric[key]))}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`${color} h-2 rounded-full transition-all duration-300`}
                          style={{ width: getBarWidth(Number(metric[key]), maxValue) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
