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

interface GradNormChartProps {
  jobId: string;
  sessionToken?: string; // Authentication token for Supabase RLS
  pollInterval?: number; // Deprecated
  autoRefresh?: boolean; // Deprecated
}

export function GradNormChart({}: GradNormChartProps) {
  const { metrics, isLoading, error } = useSharedTrainingMetrics();

  console.log('[GradNormChart] Rendering with', metrics.length, 'metrics from realtime hook');

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center text-red-800">
          <span className="mr-2 text-lg">X</span>
          <div>
            <h3 className="font-semibold">Error Loading Gradient Norm Data</h3>
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
          <span>Loading gradient norm data...</span>
        </div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-medium">No Gradient Norm Data Available</p>
          <p className="text-sm mt-1">Gradient norm data will appear as training progresses.</p>
        </div>
      </div>
    );
  }

  const hasGradNorm = metrics.some(m => m.grad_norm !== null);

  console.log('[GradNormChart] Rendering chart with', metrics.length, 'points');
  console.log('[GradNormChart] Has grad_norm:', hasGradNorm);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Gradient Norm (Training Stability)</h3>
          <div className="text-sm text-gray-600">
            {metrics.length} data points
          </div>
        </div>
      </div>

      <div className="p-6">
        <ResponsiveContainer width="100%" height={300}>
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
              label={{ value: 'Gradient Norm', angle: -90, position: 'insideLeft', offset: 10, dy: 45 }}
              stroke="#6b7280"
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px'
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="line"
            />
            {hasGradNorm && (
              <Line
                type="monotone"
                dataKey="grad_norm"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                name="Gradient Norm"
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
