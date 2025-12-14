/**
 * MultiJobMetricChart Component
 * Generic chart component for displaying any metric from multiple training jobs
 * Date: 2025-12-12
 */

'use client';

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { JobMetrics } from '@/hooks/useMultiJobMetrics';
import { mergeMetricsForChart } from '@/hooks/useMultiJobMetrics';
import type { MetricPoint } from '@/lib/hooks/useTrainingMetricsRealtime';

// Truncate long job names to prevent legend overflow
function truncateJobName(name: string, maxLength: number = 18): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 2) + '…';
}

interface MultiJobMetricChartProps {
  jobMetrics: JobMetrics[];
  metricKey: keyof MetricPoint;
  title: string;
  yAxisLabel: string;
  height?: number;
  valueFormatter?: (value: number) => string;
  emptyMessage?: string;
  strokeDasharray?: string;
}

export function MultiJobMetricChart({
  jobMetrics,
  metricKey,
  title,
  yAxisLabel,
  height = 300,
  valueFormatter,
  emptyMessage = 'No data available for selected jobs',
  strokeDasharray,
}: MultiJobMetricChartProps) {
  const chartData = useMemo(() => {
    return mergeMetricsForChart(jobMetrics, metricKey);
  }, [jobMetrics, metricKey]);

  // Check if any job has data for this metric
  const hasData = useMemo(() => {
    return jobMetrics.some(jm =>
      jm.metrics.some(m => m[metricKey] !== null && m[metricKey] !== undefined)
    );
  }, [jobMetrics, metricKey]);

  if (jobMetrics.length === 0) {
    return (
      <div className="p-6 bg-muted/30 rounded-lg border border-dashed text-center">
        <p className="text-muted-foreground">Select jobs to compare</p>
      </div>
    );
  }

  if (!hasData || chartData.length === 0) {
    return (
      <div className="p-6 bg-muted/30 rounded-lg border border-dashed text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const defaultFormatter = (value: number) => {
    if (value === null || value === undefined) return 'N/A';
    if (Math.abs(value) < 0.0001) return value.toExponential(2);
    if (Math.abs(value) < 1) return value.toFixed(6);
    if (Math.abs(value) < 100) return value.toFixed(4);
    return value.toFixed(2);
  };

  const formatValue = valueFormatter || defaultFormatter;

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-muted/50 border-b border-border">
        <h3 className="text-base font-semibold">{title}</h3>
      </div>

      <div className="p-4">
        {/* Legend moved outside chart for better readability */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs">
          {jobMetrics.map((jm) => (
            <div key={jm.jobId} className="flex items-center gap-1.5">
              <div
                className="w-3 h-0.5 rounded-sm"
                style={{ backgroundColor: jm.color }}
              />
              <span className="text-muted-foreground truncate max-w-[140px]" title={jm.jobName}>
                {truncateJobName(jm.jobName, 20)}
              </span>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={chartData}
            margin={{
              top: 10,
              right: 15,
              left: 45,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="step"
              className="text-muted-foreground"
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => {
                if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                return String(value);
              }}
            />
            <YAxis
              className="text-muted-foreground"
              tick={{ fontSize: 10 }}
              width={40}
              domain={['auto', 'auto']}
              tickFormatter={(value) => {
                if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
                if (Math.abs(value) < 0.001) return value.toExponential(1);
                if (Math.abs(value) < 1) return value.toFixed(3);
                return value.toFixed(2);
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
                maxWidth: '300px',
              }}
              labelFormatter={(value) => `Step ${value}`}
              formatter={(value, name) => {
                if (value === null || value === undefined) return ['N/A', name];
                // Find full job name for tooltip
                const job = jobMetrics.find(jm => truncateJobName(jm.jobName) === name);
                const fullName = job?.jobName || name;
                return [formatValue(value as number), fullName];
              }}
            />

            {jobMetrics.map((jm) => (
              <Line
                key={jm.jobId}
                type="monotone"
                dataKey={jm.jobId}
                name={truncateJobName(jm.jobName)}
                stroke={jm.color}
                strokeWidth={2}
                strokeDasharray={strokeDasharray}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div className="text-center text-[10px] text-muted-foreground mt-1">
          Training Step
        </div>
      </div>
    </div>
  );
}
