/**
 * MultiJobLossChart Component
 * Displays loss curves from multiple training jobs overlaid on the same chart
 * Date: 2025-12-07
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

interface MultiJobLossChartProps {
  jobMetrics: JobMetrics[];
  metricType: 'train_loss' | 'eval_loss' | 'both';
  title?: string;
  height?: number;
}

export function MultiJobLossChart({
  jobMetrics,
  metricType = 'both',
  title = 'Loss Comparison',
  height = 400,
}: MultiJobLossChartProps) {
  // Merge train_loss data
  const trainLossData = useMemo(() => {
    if (metricType === 'eval_loss') return [];
    return mergeMetricsForChart(jobMetrics, 'train_loss');
  }, [jobMetrics, metricType]);

  // Merge eval_loss data
  const evalLossData = useMemo(() => {
    if (metricType === 'train_loss') return [];
    return mergeMetricsForChart(jobMetrics, 'eval_loss');
  }, [jobMetrics, metricType]);

  // Combine data for 'both' mode
  const chartData = useMemo(() => {
    if (metricType === 'train_loss') return trainLossData;
    if (metricType === 'eval_loss') return evalLossData;

    // Merge both datasets by step
    const stepMap = new Map<number, Record<string, number | null | string>>();

    trainLossData.forEach(point => {
      stepMap.set(point.step, { ...point });
    });

    evalLossData.forEach(point => {
      const existing = stepMap.get(point.step) || { step: point.step };
      // Add eval loss values with _eval suffix
      jobMetrics.forEach(jm => {
        existing[`${jm.jobId}_eval`] = point[jm.jobId] as number | null;
      });
      stepMap.set(point.step, existing);
    });

    return Array.from(stepMap.values()).sort((a, b) => (a.step as number) - (b.step as number));
  }, [trainLossData, evalLossData, metricType, jobMetrics]);

  if (jobMetrics.length === 0) {
    return (
      <div className="p-6 bg-muted/30 rounded-lg border border-dashed text-center">
        <p className="text-muted-foreground">Select jobs to compare their loss curves</p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="p-6 bg-muted/30 rounded-lg border border-dashed text-center">
        <p className="text-muted-foreground">No metrics data available for selected jobs</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-muted/50 border-b border-border">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">
          Comparing {jobMetrics.length} training runs
        </p>
      </div>

      <div className="p-6">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="step"
              label={{ value: 'Training Step', position: 'insideBottom', offset: -15 }}
              className="text-muted-foreground"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              label={{ value: 'Loss', angle: -90, position: 'insideLeft', offset: 10, dy: 30 }}
              className="text-muted-foreground"
              tick={{ fontSize: 12 }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              labelFormatter={(value) => `Step ${value}`}
              formatter={(value, name) => {
                if (value === null || value === undefined) return ['N/A', name];
                return [typeof value === 'number' ? value.toFixed(4) : String(value), name];
              }}
            />
            <Legend />

            {/* Render lines for each job */}
            {jobMetrics.map((jm) => (
              <React.Fragment key={jm.jobId}>
                {/* Train Loss line */}
                {(metricType === 'train_loss' || metricType === 'both') && (
                  <Line
                    type="monotone"
                    dataKey={jm.jobId}
                    name={`${jm.jobName} (Train)`}
                    stroke={jm.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                )}
                {/* Eval Loss line (dashed) */}
                {(metricType === 'eval_loss' || metricType === 'both') && (
                  <Line
                    type="monotone"
                    dataKey={metricType === 'both' ? `${jm.jobId}_eval` : jm.jobId}
                    name={`${jm.jobName} (Eval)`}
                    stroke={jm.color}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    connectNulls
                  />
                )}
              </React.Fragment>
            ))}
          </LineChart>
        </ResponsiveContainer>

        {/* Legend for line styles */}
        {metricType === 'both' && (
          <div className="mt-4 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-foreground" />
              <span>Train Loss</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-foreground border-dashed" style={{ borderTop: '2px dashed currentColor', height: 0 }} />
              <span>Eval Loss</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
