/**
 * MultiJobGradientNormChart Component
 * Displays gradient norm values from multiple training jobs
 * Useful for detecting training instability (exploding/vanishing gradients)
 * Date: 2025-12-12
 */

'use client';

import React from 'react';
import { MultiJobMetricChart } from './MultiJobMetricChart';
import type { JobMetrics } from '@/hooks/useMultiJobMetrics';

interface MultiJobGradientNormChartProps {
  jobMetrics: JobMetrics[];
  height?: number;
}

export function MultiJobGradientNormChart({
  jobMetrics,
  height = 250,
}: MultiJobGradientNormChartProps) {
  const formatGradNorm = (value: number) => {
    if (value === null || value === undefined) return 'N/A';
    if (value < 0.01) return value.toExponential(2);
    return value.toFixed(4);
  };

  return (
    <MultiJobMetricChart
      jobMetrics={jobMetrics}
      metricKey="grad_norm"
      title="Gradient Norm"
      yAxisLabel="Grad Norm"
      height={height}
      valueFormatter={formatGradNorm}
      emptyMessage="No gradient norm data available"
    />
  );
}
