/**
 * Metrics Chart Component
 *
 * Visualizes training metrics over time for DAG executions
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricData, MetricsResponse } from './types';

interface MetricsChartProps {
  executionId: string;
}

export function MetricsChart({ executionId }: MetricsChartProps) {
  console.log('[MetricsChart] Rendering for execution:', executionId);

  const [metrics, setMetrics] = useState<Record<string, MetricData[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      console.log('[MetricsChart] Fetching metrics');

      try {
        const response = await fetch(`/api/training/dag/metrics/${executionId}`);
        const data: MetricsResponse = await response.json();

        if (data.success) {
          console.log('[MetricsChart] Loaded', Object.keys(data.metrics).length, 'metric types');
          setMetrics(data.metrics);

          if (Object.keys(data.metrics).length > 0 && !selectedMetric) {
            setSelectedMetric(Object.keys(data.metrics)[0]);
          }
        }
      } catch (error) {
        console.error('[MetricsChart] Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [executionId, selectedMetric]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500 dark:text-gray-400">
            Loading metrics...
          </div>
        </CardContent>
      </Card>
    );
  }

  const metricNames = Object.keys(metrics);

  if (metricNames.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            No metrics available for this execution
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentMetrics = selectedMetric ? metrics[selectedMetric] : [];

  const getMinMax = (data: MetricData[]) => {
    const values = data.map(m => m.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  };

  const formatValue = (value: number) => {
    if (value > 1000) return value.toExponential(2);
    return value.toFixed(4);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Metrics</CardTitle>
        <select
          value={selectedMetric || ''}
          onChange={(e) => setSelectedMetric(e.target.value)}
          className="text-xs border rounded px-2 py-1"
        >
          {metricNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </CardHeader>

      <CardContent>
        {currentMetrics.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            No data points for this metric
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Latest</div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatValue(currentMetrics[currentMetrics.length - 1].value)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Min</div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatValue(getMinMax(currentMetrics).min)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Max</div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatValue(getMinMax(currentMetrics).max)}
                </div>
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded p-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Data Points: {currentMetrics.length}
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {currentMetrics.slice(-10).reverse().map((metric, index) => (
                  <div
                    key={index}
                    className="flex justify-between text-xs text-gray-600 dark:text-gray-400"
                  >
                    <span>{formatTimestamp(metric.timestamp)}</span>
                    <span className="font-mono">{formatValue(metric.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
