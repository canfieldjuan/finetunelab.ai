'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useSharedTrainingMetrics } from '@/contexts/TrainingMetricsContext';

interface MetricsOverviewCardProps {
  jobId: string;
  sessionToken?: string; // Authentication token for Supabase RLS
  pollInterval?: number; // Deprecated - kept for backwards compatibility
  autoRefresh?: boolean; // Deprecated - kept for backwards compatibility
}

interface MetricTrend {
  value: number;
  trend: 'improving' | 'degrading' | 'stable';
  change: number; // Percentage change
}

export function MetricsOverviewCard({}: MetricsOverviewCardProps) {
  // Use the enhanced realtime hook - handles both initial fetch and realtime updates
  const { metrics, isLoading, error } = useSharedTrainingMetrics();

  console.log('[MetricsOverviewCard] Rendering with', metrics.length, 'metrics from realtime hook');
  
  // Debug: Log first metric to see what data is available
  if (metrics.length > 0) {
    console.log('[MetricsOverviewCard] Sample metric data:', {
      step: metrics[0].step,
      perplexity: metrics[0].perplexity,
      train_perplexity: metrics[0].train_perplexity,
      tokens_per_second: metrics[0].tokens_per_second,
      gpu_utilization_percent: metrics[0].gpu_utilization_percent,
      gpu_memory_allocated_gb: metrics[0].gpu_memory_allocated_gb,
      grad_norm: metrics[0].grad_norm,
      train_loss: metrics[0].train_loss,
      eval_loss: metrics[0].eval_loss,
    });
  }

  // Calculate trend for a metric (comparing last 5 points)
  const calculateTrend = (
    values: (number | null)[],
    lowerIsBetter = true
  ): MetricTrend | null => {
    // Filter out null values
    const validValues = values.filter((v): v is number => v !== null && v !== undefined);
    
    if (validValues.length < 2) return null;

    const latest = validValues[validValues.length - 1];
    const windowSize = Math.min(5, validValues.length);
    const previous = validValues.slice(-windowSize, -1);
    const avgPrevious = previous.reduce((a, b) => a + b, 0) / previous.length;

    const change = ((latest - avgPrevious) / avgPrevious) * 100;

    let trend: 'improving' | 'degrading' | 'stable';
    
    if (Math.abs(change) < 2) {
      trend = 'stable';
    } else if (lowerIsBetter) {
      trend = change < 0 ? 'improving' : 'degrading';
    } else {
      trend = change > 0 ? 'improving' : 'degrading';
    }

    return { value: latest, trend, change };
  };

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center text-red-800">
          <span className="mr-2 text-lg">✗</span>
          <div>
            <h3 className="font-semibold">Error Loading Metrics Overview</h3>
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
          <span>Loading metrics overview...</span>
        </div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-medium">No Metrics Available</p>
          <p className="text-sm mt-1">Metrics will appear here as training progresses.</p>
        </div>
      </div>
    );
  }

  // Calculate trends for each metric
  const trainLossTrend = calculateTrend(metrics.map(m => m.train_loss), true);
  const evalLossTrend = calculateTrend(metrics.map(m => m.eval_loss), true);
  const perplexityTrend = calculateTrend(metrics.map(m => m.perplexity), true);
  const trainPerplexityTrend = calculateTrend(metrics.map(m => m.train_perplexity), true);
  const tokensPerSecTrend = calculateTrend(metrics.map(m => m.tokens_per_second), false);
  const gpuUtilTrend = calculateTrend(metrics.map(m => m.gpu_utilization_percent), false);
  const gpuMemoryTrend = calculateTrend(metrics.map(m => m.gpu_memory_allocated_gb), false);
  const gradNormTrend = calculateTrend(metrics.map(m => m.grad_norm), true);

  console.log('[MetricsOverviewCard] Calculated trends:', {
    trainLossTrend: trainLossTrend ? 'has data' : 'null',
    evalLossTrend: evalLossTrend ? 'has data' : 'null',
    perplexityTrend: perplexityTrend ? 'has data' : 'null',
    trainPerplexityTrend: trainPerplexityTrend ? 'has data' : 'null',
    tokensPerSecTrend: tokensPerSecTrend ? 'has data' : 'null',
    gpuUtilTrend: gpuUtilTrend ? 'has data' : 'null',
    gpuMemoryTrend: gpuMemoryTrend ? 'has data' : 'null',
    gradNormTrend: gradNormTrend ? 'has data' : 'null',
  });

  const getTrendIcon = (trend: 'improving' | 'degrading' | 'stable') => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'degrading':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'stable':
        return <Minus className="w-4 h-4 text-blue-600" />;
    }
  };

  const getTrendColor = (trend: 'improving' | 'degrading' | 'stable') => {
    switch (trend) {
      case 'improving':
        return 'bg-green-50 border-green-200';
      case 'degrading':
        return 'bg-red-50 border-red-200';
      case 'stable':
        return 'bg-blue-50 border-blue-200';
    }
  };

  const formatValue = (value: number | undefined | null, decimals = 2): string => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(decimals);
  };

  const formatChange = (change: number): string => {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  // console.log('[MetricsOverviewCard] Rendering with', metrics.length, 'metric points');

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Metrics Overview</h3>
            <p className="text-xs text-gray-500 mt-1">Latest values with trend indicators</p>
          </div>
          <div className="text-xs text-gray-500">
            {metrics.length} data points
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Train Loss */}
          {trainLossTrend && (
            <div className={`p-4 border rounded-lg ${getTrendColor(trainLossTrend.trend)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-700">Train Loss</div>
                {getTrendIcon(trainLossTrend.trend)}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatValue(trainLossTrend.value, 4)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {formatChange(trainLossTrend.change)}
              </div>
            </div>
          )}

          {/* Eval Loss */}
          {evalLossTrend && (
            <div className={`p-4 border rounded-lg ${getTrendColor(evalLossTrend.trend)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-700">Eval Loss</div>
                {getTrendIcon(evalLossTrend.trend)}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatValue(evalLossTrend.value, 4)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {formatChange(evalLossTrend.change)}
              </div>
            </div>
          )}

          {/* Perplexity */}
          {perplexityTrend && (
            <div className={`p-4 border rounded-lg ${getTrendColor(perplexityTrend.trend)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-700">Eval Perplexity</div>
                {getTrendIcon(perplexityTrend.trend)}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatValue(perplexityTrend.value, 4)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {formatChange(perplexityTrend.change)}
              </div>
            </div>
          )}

          {/* Train Perplexity */}
          {trainPerplexityTrend && (
            <div className={`p-4 border rounded-lg ${getTrendColor(trainPerplexityTrend.trend)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-700">Train Perplexity</div>
                {getTrendIcon(trainPerplexityTrend.trend)}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatValue(trainPerplexityTrend.value, 4)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {formatChange(trainPerplexityTrend.change)}
              </div>
            </div>
          )}

          {/* Tokens/Second */}
          {tokensPerSecTrend && (
            <div className={`p-4 border rounded-lg ${getTrendColor(tokensPerSecTrend.trend)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-700">Tokens/Second</div>
                {getTrendIcon(tokensPerSecTrend.trend)}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatValue(tokensPerSecTrend.value, 2)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {formatChange(tokensPerSecTrend.change)}
              </div>
            </div>
          )}

          {/* GPU Utilization */}
          {gpuUtilTrend && (
            <div className={`p-4 border rounded-lg ${getTrendColor(gpuUtilTrend.trend)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-700">GPU Utilization</div>
                {getTrendIcon(gpuUtilTrend.trend)}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatValue(gpuUtilTrend.value, 1)}%
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {formatChange(gpuUtilTrend.change)}
              </div>
            </div>
          )}

          {/* GPU Memory */}
          {gpuMemoryTrend && (
            <div className={`p-4 border rounded-lg ${getTrendColor(gpuMemoryTrend.trend)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-700">GPU Memory (GB)</div>
                {getTrendIcon(gpuMemoryTrend.trend)}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatValue(gpuMemoryTrend.value, 2)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {formatChange(gpuMemoryTrend.change)}
              </div>
            </div>
          )}

          {/* Gradient Norm */}
          {gradNormTrend && (
            <div className={`p-4 border rounded-lg ${getTrendColor(gradNormTrend.trend)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-700">Gradient Norm</div>
                {getTrendIcon(gradNormTrend.trend)}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatValue(gradNormTrend.value, 4)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {formatChange(gradNormTrend.change)}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-600" />
                <span>Improving</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-red-600" />
                <span>Degrading</span>
              </div>
              <div className="flex items-center gap-1">
                <Minus className="w-3 h-3 text-blue-600" />
                <span>Stable</span>
              </div>
            </div>
            <div>
              Trend based on last 5 data points
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// console.log('[MetricsOverviewCard] Component loaded');
