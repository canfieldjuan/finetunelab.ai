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

// Truncate long job names to prevent legend overflow
function truncateJobName(name: string, maxLength: number = 14): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 2) + '…';
}

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
        {/* Legend moved outside chart for better readability */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 text-xs">
          {jobMetrics.map((jm) => (
            <div key={jm.jobId} className="flex items-center gap-1.5">
              <div
                className="w-3 h-0.5 rounded-sm"
                style={{ backgroundColor: jm.color }}
              />
              <span className="text-muted-foreground truncate max-w-[160px]" title={jm.jobName}>
                {truncateJobName(jm.jobName, 22)}
              </span>
            </div>
          ))}
        </div>

        {/* Line style legend for both mode */}
        {metricType === 'both' && (
          <div className="flex items-center gap-4 mb-2 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-current" />
              <span>Train</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 border-t-2 border-dashed border-current" />
              <span>Eval</span>
            </div>
          </div>
        )}

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
                if (typeof value !== 'number') return '';
                if (value >= 10) return value.toFixed(1);
                if (value >= 1) return value.toFixed(2);
                return value.toFixed(3);
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
                maxWidth: '320px',
              }}
              labelFormatter={(value) => `Step ${value}`}
              formatter={(value, name) => {
                if (value === null || value === undefined) return ['N/A', name];
                // Find full job name for tooltip (remove truncation and suffix)
                const nameStr = String(name);
                const isEval = nameStr.endsWith('(E)');
                const truncatedName = nameStr.replace(/ \((T|E)\)$/, '');
                const job = jobMetrics.find(jm => truncateJobName(jm.jobName) === truncatedName);
                const fullName = job ? `${job.jobName} ${isEval ? '(Eval)' : '(Train)'}` : name;
                return [typeof value === 'number' ? value.toFixed(4) : String(value), fullName];
              }}
            />

            {/* Render lines for each job */}
            {jobMetrics.map((jm) => (
              <React.Fragment key={jm.jobId}>
                {/* Train Loss line */}
                {(metricType === 'train_loss' || metricType === 'both') && (
                  <Line
                    type="monotone"
                    dataKey={jm.jobId}
                    name={`${truncateJobName(jm.jobName)} (T)`}
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
                    name={`${truncateJobName(jm.jobName)} (E)`}
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
        <div className="text-center text-[10px] text-muted-foreground mt-1">
          Training Step
        </div>
      </div>
    </div>
  );
}
