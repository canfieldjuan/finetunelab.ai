'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps
} from 'recharts';
import { useSharedTrainingMetrics } from '@/contexts/TrainingMetricsContext';

interface LossChartProps {
  jobId: string;
  sessionToken?: string; // Keep for compatibility
  pollInterval?: number; // Deprecated
  autoRefresh?: boolean; // Deprecated
}


interface MetricDataPoint {
  step: number;
  train_loss: number | null;
  eval_loss: number | null;
  [key: string]: number | null | undefined;
}

import type { TooltipProps } from 'recharts';

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || !label) return null;

  // Aggregate all train_loss and eval_loss values for this step
  let trainLoss: number | null = null;
  let evalLoss: number | null = null;

  payload.forEach((entry) => {
    if (entry && typeof entry === 'object' && 'dataKey' in entry && 'value' in entry) {
      if (entry.dataKey === 'train_loss' && entry.value != null) {
        trainLoss = entry.value as number;
      }
      if (entry.dataKey === 'eval_loss' && entry.value != null) {
        evalLoss = entry.value as number;
      }
    }
  });

  return (
    <div className="bg-white border border-gray-300 rounded-md p-3 shadow-lg">
      <p className="font-semibold text-gray-700 mb-2">Step: {label}</p>
      {trainLoss !== null && (
        <p className="text-blue-600 text-sm">
          Train Loss: {(trainLoss as number).toFixed(4)}
        </p>
      )}
      {evalLoss !== null && (
        <p className="text-green-600 text-sm">
          Eval Loss: {(evalLoss as number).toFixed(4)}
        </p>
      )}
    </div>
  );
};

export function LossChart({}: LossChartProps) {
  // Use SHARED metrics from context
  const { metrics, isLoading, error } = useSharedTrainingMetrics();

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center text-red-800">
          <span className="mr-2 text-lg">X</span>
          <div>
            <h3 className="font-semibold">Error Loading Metrics</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center text-gray-600">
          <svg className="animate-spin h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading metrics...</span>
        </div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-medium">No Metrics Available</p>
          <p className="text-sm mt-1">Training metrics will appear here as the job progresses.</p>
        </div>
      </div>
    );
  }

  const hasTrainLoss = metrics.some(m => m.train_loss !== null);
  const hasEvalLoss = metrics.some(m => m.eval_loss !== null);

  // console.log('[LossChart] Rendering chart with', metrics.length, 'points');
  // console.log('[LossChart] Has train_loss:', hasTrainLoss, 'Has eval_loss:', hasEvalLoss);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Loss Curves</h3>
          <div className="text-sm text-gray-600">
            {metrics.length} data points
          </div>
        </div>
      </div>

      <div className="p-6">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={metrics}
            margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="step"
              label={{ value: 'Training Step', position: 'insideBottom', offset: -15 }}
              stroke="#6b7280"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              label={{ value: 'Loss', angle: -90, position: 'insideLeft', offset: 10, dy: 30 }}
              stroke="#6b7280"
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="line"
            />
            {hasTrainLoss && (
              <Line
                type="monotone"
                dataKey="train_loss"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Train Loss"
                connectNulls
              />
            )}
            {hasEvalLoss && (
              <Line
                type="monotone"
                dataKey="eval_loss"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Eval Loss"
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
