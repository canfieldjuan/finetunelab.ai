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

interface ThroughputChartProps {
  jobId: string;
  sessionToken?: string; // Keep for compatibility but unused
  pollInterval?: number; // Deprecated
  autoRefresh?: boolean; // Deprecated
}

export function ThroughputChart({}: ThroughputChartProps) {
  // Use SHARED metrics from context instead of individual subscription
  const { metrics, isLoading, error } = useSharedTrainingMetrics();

  console.log('[ThroughputChart] Rendering with', metrics.length, 'metrics from SHARED context');

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center text-red-800">
          <span className="mr-2 text-lg">X</span>
          <div>
            <h3 className="font-semibold">Error Loading Throughput Data</h3>
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
          <span>Loading throughput data...</span>
        </div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-medium">No Throughput Data Available</p>
          <p className="text-sm mt-1">Throughput metrics will appear here as training progresses.</p>
        </div>
      </div>
    );
  }

  // Check if we have throughput data
  const hasSamplesPerSecond = metrics.some(m => m.samples_per_second !== null && m.samples_per_second !== undefined);
  const hasTokensPerSecond = metrics.some(m => m.tokens_per_second !== null && m.tokens_per_second !== undefined);

  // Get latest values for header display
  const latestMetric = metrics[metrics.length - 1];
  const currentSamplesPerSec = latestMetric?.samples_per_second;
  const currentTokensPerSec = latestMetric?.tokens_per_second;

  console.log('[ThroughputChart] Rendering chart with', metrics.length, 'points');
  console.log('[ThroughputChart] Has samples/s:', hasSamplesPerSecond, 'Has tokens/s:', hasTokensPerSecond);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Training Throughput</h3>
            <p className="text-xs text-gray-500 mt-1">Samples and tokens processed per second</p>
          </div>
          <div className="text-sm text-gray-600 flex flex-col items-end gap-1">
            {currentSamplesPerSec !== null && currentSamplesPerSec !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Samples/s:</span>
                <span className="font-mono font-semibold text-pink-600">
                  {currentSamplesPerSec.toFixed(2)}
                </span>
              </div>
            )}
            {currentTokensPerSec !== null && currentTokensPerSec !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Tokens/s:</span>
                <span className="font-mono font-semibold text-purple-600">
                  {currentTokensPerSec.toFixed(2)}
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
              label={{ value: 'Throughput', angle: -90, position: 'insideLeft', offset: 10, dy: 40 }}
              stroke="#6b7280"
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px'
              }}
              formatter={(value: number) => {
                if (value === null || value === undefined) return ['N/A', ''];
                return [value.toFixed(2), ''];
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="line"
            />
            {hasSamplesPerSecond && (
              <Line
                type="monotone"
                dataKey="samples_per_second"
                stroke="#ec4899"
                strokeWidth={2}
                dot={false}
                name="Samples/Second"
                connectNulls
              />
            )}
            {hasTokensPerSecond && (
              <Line
                type="monotone"
                dataKey="tokens_per_second"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
                name="Tokens/Second"
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
            <div>
              <p className="font-medium mb-1">Samples/Second</p>
              <p>Number of training examples processed per second. Higher = faster training.</p>
            </div>
            <div>
              <p className="font-medium mb-1">Tokens/Second</p>
              <p>Number of tokens processed per second. Useful for comparing models with different sequence lengths.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

console.log('[ThroughputChart] Component loaded');
