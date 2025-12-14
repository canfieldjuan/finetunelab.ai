/**
 * MultiJobThroughputChart Component
 * Displays training throughput (tokens/sec) from multiple training jobs
 * Date: 2025-12-12
 */

'use client';

import React from 'react';
import { MultiJobMetricChart } from './MultiJobMetricChart';
import type { JobMetrics } from '@/hooks/useMultiJobMetrics';

interface MultiJobThroughputChartProps {
  jobMetrics: JobMetrics[];
  height?: number;
}

export function MultiJobThroughputChart({
  jobMetrics,
  height = 250,
}: MultiJobThroughputChartProps) {
  const formatThroughput = (value: number) => {
    if (value === null || value === undefined) return 'N/A';
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toFixed(0);
  };

  return (
    <MultiJobMetricChart
      jobMetrics={jobMetrics}
      metricKey="tokens_per_second"
      title="Throughput (Tokens/sec)"
      yAxisLabel="Tok/s"
      height={height}
      valueFormatter={formatThroughput}
      emptyMessage="No throughput data available"
    />
  );
}
