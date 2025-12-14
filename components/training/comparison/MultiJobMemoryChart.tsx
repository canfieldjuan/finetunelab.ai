/**
 * MultiJobMemoryChart Component
 * Displays GPU memory usage from multiple training jobs
 * Date: 2025-12-12
 */

'use client';

import React from 'react';
import { MultiJobMetricChart } from './MultiJobMetricChart';
import type { JobMetrics } from '@/hooks/useMultiJobMetrics';

interface MultiJobMemoryChartProps {
  jobMetrics: JobMetrics[];
  height?: number;
}

export function MultiJobMemoryChart({
  jobMetrics,
  height = 250,
}: MultiJobMemoryChartProps) {
  const formatMemory = (value: number) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toFixed(2)} GB`;
  };

  return (
    <MultiJobMetricChart
      jobMetrics={jobMetrics}
      metricKey="gpu_memory_allocated_gb"
      title="GPU Memory Usage"
      yAxisLabel="GB"
      height={height}
      valueFormatter={formatMemory}
      emptyMessage="No GPU memory data available"
    />
  );
}
