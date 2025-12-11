/**
 * Cohort Trend Chart Component
 *
 * Displays historical trend data for cohort metrics.
 * Shows metric evolution over time using line charts.
 *
 * Phase 3.2: Cohort Analysis UI
 * Date: 2025-10-25
 */

"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { CohortSnapshot } from '@/lib/services/cohort.service';
import { supabase } from '@/lib/supabaseClient';

interface CohortTrendChartProps {
  cohortId: string;
  startDate?: string;
  endDate?: string;
}

interface TrendData {
  date: string;
  member_count: number;
  average_rating: number;
  success_rate: number;
  cost_per_session: number;
}

export default function CohortTrendChart({
  cohortId,
  startDate,
  endDate
}: CohortTrendChartProps) {
  console.log('[CohortTrendChart] Rendering for cohort:', cohortId);

  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<keyof TrendData>('average_rating');

  const fetchTrendData = useCallback(async () => {
    console.log('[CohortTrendChart] Starting fetch');
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      const params = new URLSearchParams({
        include_trends: 'true',
        include_baseline: 'false'
      });

      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(
        `/api/analytics/cohorts/${cohortId}/metrics?${params}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch trend data');
      }

      const data = await response.json();
      console.log('[CohortTrendChart] Received data:', data);

      const snapshots = data.trends as CohortSnapshot[] || [];

      const processedData: TrendData[] = snapshots.map(snapshot => ({
        date: new Date(snapshot.snapshot_date).toLocaleDateString(),
        member_count: snapshot.member_count,
        average_rating: snapshot.average_rating || 0,
        success_rate: snapshot.average_success_rate || 0,
        cost_per_session: snapshot.average_cost_per_session || 0
      }));

      console.log('[CohortTrendChart] Processed', processedData.length, 'data points');
      setTrendData(processedData);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load trend data';
      console.error('[CohortTrendChart] Error:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [cohortId, startDate, endDate]);

  useEffect(() => {
    console.log('[CohortTrendChart] Fetching trend data');
    fetchTrendData();
  }, [fetchTrendData]);

  const getMetricLabel = (metric: keyof TrendData): string => {
    const labels: Record<keyof TrendData, string> = {
      date: 'Date',
      member_count: 'Member Count',
      average_rating: 'Average Rating',
      success_rate: 'Success Rate',
      cost_per_session: 'Cost Per Session'
    };
    return labels[metric];
  };

  const formatMetricValue = (metric: keyof TrendData, value: number): string => {
    if (metric === 'cost_per_session') return `$${value.toFixed(4)}`;
    if (metric === 'success_rate') return `${(value * 100).toFixed(1)}%`;
    if (metric === 'average_rating') return value.toFixed(2);
    return value.toFixed(0);
  };

  const getMaxValue = (metric: keyof TrendData): number => {
    if (trendData.length === 0) return 1;
    const values = trendData.map(d => d[metric] as number);
    return Math.max(...values, 1);
  };

  const getMinValue = (metric: keyof TrendData): number => {
    if (trendData.length === 0) return 0;
    const values = trendData.map(d => d[metric] as number);
    return Math.min(...values, 0);
  };

  const getYPosition = (value: number, metric: keyof TrendData): number => {
    const max = getMaxValue(metric);
    const min = getMinValue(metric);
    const range = max - min || 1;
    const normalized = (value - min) / range;
    return 100 - (normalized * 100);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-gray-600">
            Loading trend data...
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

  if (trendData.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-gray-600">
            No trend data available for this time period.
          </div>
        </CardContent>
      </Card>
    );
  }

  const metricOptions: Array<keyof TrendData> = [
    'average_rating',
    'member_count',
    'success_rate',
    'cost_per_session'
  ];

  const points = trendData.map((data, index) => {
    const x = (index / (trendData.length - 1)) * 100;
    const y = getYPosition(data[selectedMetric] as number, selectedMetric);
    return `${x},${y}`;
  }).join(' ');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Trend Analysis</CardTitle>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as keyof TrendData)}
          >
            {metricOptions.map(metric => (
              <option key={metric} value={metric}>
                {getMetricLabel(metric)}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative h-64 border rounded bg-gray-50 p-4">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline
                points={points}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
              />
              {trendData.map((data, index) => {
                const x = (index / (trendData.length - 1)) * 100;
                const y = getYPosition(data[selectedMetric] as number, selectedMetric);
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="1"
                    fill="#3b82f6"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-500">Start</div>
              <div className="font-medium">
                {formatMetricValue(selectedMetric, trendData[0][selectedMetric] as number)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">End</div>
              <div className="font-medium">
                {formatMetricValue(selectedMetric, trendData[trendData.length - 1][selectedMetric] as number)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Highest</div>
              <div className="font-medium">
                {formatMetricValue(selectedMetric, getMaxValue(selectedMetric))}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Lowest</div>
              <div className="font-medium">
                {formatMetricValue(selectedMetric, getMinValue(selectedMetric))}
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500 text-center">
            Showing {trendData.length} data points from {trendData[0].date} to {trendData[trendData.length - 1].date}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
