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
  ResponsiveContainer
} from 'recharts';
import { useSharedTrainingMetrics } from '@/contexts/TrainingMetricsContext';

interface PerplexityChartProps {
  jobId: string;
  sessionToken?: string; // Authentication token for Supabase RLS
  pollInterval?: number; // Deprecated
  autoRefresh?: boolean; // Deprecated
}

export function PerplexityChart({}: PerplexityChartProps) {
  const { metrics, isLoading, error } = useSharedTrainingMetrics();

  console.log('[PerplexityChart] Rendering with', metrics.length, 'metrics from realtime hook');

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center text-red-800">
          <span className="mr-2 text-lg">✗</span>
          <div>
            <h3 className="font-semibold">Error Loading Perplexity Data</h3>
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
          <span>Loading perplexity data...</span>
        </div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-medium">No Perplexity Data Available</p>
          <p className="text-sm mt-1">Perplexity metrics will appear here as training progresses.</p>
        </div>
      </div>
    );
  }

  // Check if we have perplexity data
  const hasEvalPerplexity = metrics.some(m => m.perplexity !== null && m.perplexity !== undefined);
  const hasTrainPerplexity = metrics.some(m => m.train_perplexity !== null && m.train_perplexity !== undefined);

  // If no perplexity data at all, show message
  if (!hasEvalPerplexity && !hasTrainPerplexity) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-medium">No Perplexity Data Yet</p>
          <p className="text-sm mt-1">Perplexity is calculated from loss values during evaluation steps.</p>
        </div>
      </div>
    );
  }

  // Get latest perplexity values for header display
  const latestMetric = metrics[metrics.length - 1];
  const currentEvalPerplexity = latestMetric?.perplexity;
  const currentTrainPerplexity = latestMetric?.train_perplexity;

  // console.log('[PerplexityChart] Rendering chart with', metrics.length, 'points');
  // console.log('[PerplexityChart] Has eval perplexity:', hasEvalPerplexity, 'Has train perplexity:', hasTrainPerplexity);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Perplexity</h3>
            <p className="text-xs text-gray-500 mt-1">Lower is better (exp(loss))</p>
          </div>
          <div className="text-sm text-gray-600 flex flex-col items-end gap-1">
            {currentEvalPerplexity !== null && currentEvalPerplexity !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Eval:</span>
                <span className="font-mono font-semibold text-green-600">
                  {currentEvalPerplexity.toFixed(4)}
                </span>
              </div>
            )}
            {currentTrainPerplexity !== null && currentTrainPerplexity !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Train:</span>
                <span className="font-mono font-semibold text-blue-600">
                  {currentTrainPerplexity.toFixed(4)}
                </span>
              </div>
            )}
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
              label={{ value: 'Perplexity', angle: -90, position: 'insideLeft' }}
              stroke="#6b7280"
              scale="log"
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px'
              }}
              formatter={(value: number) => {
                if (value === null || value === undefined) return ['N/A', ''];
                return [typeof value === 'number' ? value.toFixed(4) : value, ''];
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="line"
            />
            {hasTrainPerplexity && (
              <Line
                type="monotone"
                dataKey="train_perplexity"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Train Perplexity"
                connectNulls
              />
            )}
            {hasEvalPerplexity && (
              <Line
                type="monotone"
                dataKey="perplexity"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Eval Perplexity"
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
            <div>
              <p className="font-medium mb-1">What is Perplexity?</p>
              <p>Exponential of loss value (exp(loss)). Measures model uncertainty.</p>
            </div>
            <div>
              <p className="font-medium mb-1">Interpretation</p>
              <p>Lower = Better. Values close to 1.0 indicate high confidence. Values &gt; 10 suggest poor performance.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// console.log('[PerplexityChart] Component loaded');
