/**
 * MultiJobLearningRateChart Component
 * Displays learning rate schedules from multiple training jobs
 * Date: 2025-12-12
 */

'use client';

import React from 'react';
import { MultiJobMetricChart } from './MultiJobMetricChart';
import type { JobMetrics } from '@/hooks/useMultiJobMetrics';

interface MultiJobLearningRateChartProps {
  jobMetrics: JobMetrics[];
  height?: number;
}

export function MultiJobLearningRateChart({
  jobMetrics,
  height = 250,
}: MultiJobLearningRateChartProps) {
  const formatLearningRate = (value: number) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toExponential(2);
  };

  return (
    <MultiJobMetricChart
      jobMetrics={jobMetrics}
      metricKey="learning_rate"
      title="Learning Rate Schedule"
      yAxisLabel="LR"
      height={height}
      valueFormatter={formatLearningRate}
      emptyMessage="No learning rate data available"
    />
  );
}
