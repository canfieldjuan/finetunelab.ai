"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import type { ModelPerformanceMetrics } from '@/hooks/useAnalytics';
import { MetricSelector, MODEL_METRICS, type MetricKey } from './MetricSelector';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatModelName, formatProviderName } from '@/lib/utils/format-labels';

interface ModelPerformanceTableProps {
  data: ModelPerformanceMetrics[];
}

export function ModelPerformanceTable({
  data
}: ModelPerformanceTableProps) {
  // Get default visible metrics
  const defaultMetrics = MODEL_METRICS.filter(m => m.defaultVisible).map(m => m.key);

  // State for selected metrics
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(defaultMetrics);
  const [showMetricSelector, setShowMetricSelector] = useState(false);

  console.log('[ModelPerformanceTable] Rendering with data:', {
    modelCount: data?.length || 0,
    selectedMetrics: selectedMetrics.length,
    showMetricSelector
  });

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-base mb-2">No model performance data available</p>
            <p className="text-sm">
              This can happen if:
            </p>
            <ul className="text-xs mt-3 space-y-1 text-left max-w-md mx-auto">
              <li>• Active filters (sessions, ratings, etc.) exclude all messages</li>
              <li>• Messages don't have model_id populated</li>
              <li>• No assistant messages in the selected time range</li>
            </ul>
            <p className="text-xs mt-4 text-gray-500">
              Try clearing filters or selecting a different time range.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Helper function to format metric values
  const formatMetricValue = (key: MetricKey, value: unknown): string => {
    const metric = MODEL_METRICS.find(m => m.key === key);
    if (!metric || value === null || value === undefined) return '-';

    const numValue = typeof value === 'number' ? value : Number(value);

    switch (metric.format) {
      case 'percentage':
        return `${numValue.toFixed(1)}%`;
      case 'currency':
        return `$${numValue.toFixed(4)}`;
      case 'tokens':
        return `${Math.round(numValue).toLocaleString()} tokens`;
      case 'time':
        return `${Math.round(numValue)}ms`;
      case 'date':
        return new Date(value as string | number | Date).toLocaleDateString();
      case 'number':
        return typeof value === 'number' ? value.toFixed(1) : String(value);
      case 'text':
        return value ? String(value) : '-';
      default:
        return String(value);
    }
  };

  return (
    <>
      {/* Metric Selector (collapsible) */}
      {showMetricSelector && (
        <MetricSelector
          type="model"
          selectedMetrics={selectedMetrics}
          onMetricsChange={(metrics) => {
            console.log('[ModelPerformanceTable] Metrics changed:', metrics);
            setSelectedMetrics(metrics);
          }}
          className="mb-4"
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Model Performance Comparison</CardTitle>
              <CardDescription className="mt-1">
                Compare quality, speed, cost, and efficiency metrics across all models.
              </CardDescription>
            </div>
            <button
              onClick={() => {
                console.log('[ModelPerformanceTable] Toggle metric selector:', !showMetricSelector);
                setShowMetricSelector(!showMetricSelector);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
            >
              {showMetricSelector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showMetricSelector ? 'Hide' : 'Show'} Metrics
            </button>
          </div>
        </CardHeader>
        <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left">
                <th className="py-2 px-3">Model</th>
                {selectedMetrics.map(metricKey => {
                  const metric = MODEL_METRICS.find(m => m.key === metricKey);
                  return metric ? (
                    <th key={metricKey} className="py-2 px-3 text-right">
                      {metric.label}
                    </th>
                  ) : null;
                })}
              </tr>
            </thead>
            <tbody>
              {data.map((model) => {
                return (
                  <tr
                    key={model.modelId}
                    className="border-b hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-2 px-3">
                      <div>
                        <div
                          className="font-medium cursor-help"
                          title={model.modelId}
                        >
                          {formatModelName(model.modelName)}
                        </div>
                        {model.provider && (
                          <div className="text-xs text-gray-500">
                            {formatProviderName(model.provider)}
                            {model.trainingMethod && ` • ${model.trainingMethod.toUpperCase()}`}
                          </div>
                        )}
                      </div>
                    </td>
                    {selectedMetrics.map(metricKey => {
                      const metric = MODEL_METRICS.find(m => m.key === metricKey);
                      if (!metric) return null;

                      const value = model[metricKey as keyof ModelPerformanceMetrics];
                      const formattedValue = formatMetricValue(metricKey, value);

                      // Special styling for certain metrics
                      let className = "py-2 px-3 text-right";
                      let displayValue = formattedValue;

                      if (metricKey === 'avgRating' && model.evaluationCount > 0) {
                        className += " text-yellow-600";
                        displayValue = `${formattedValue} ⭐`;
                      } else if (metricKey === 'successRate' && model.evaluationCount > 0) {
                        const rate = value as number;
                        className += rate >= 80 ? " text-green-600 font-medium" :
                                   rate >= 60 ? " text-yellow-600" :
                                   " text-red-600 font-medium";
                      } else if (metricKey === 'costPerMessage') {
                        className += " font-mono";
                      } else if (metricKey === 'totalMessages') {
                        className += " font-medium";
                      }

                      return (
                        <td key={metricKey} className={className}>
                          {formattedValue !== '-' ? displayValue : <span className="text-gray-400">-</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-gray-500">
          <span>Click a row to highlight it. Use the Filter Panel to filter charts by model.</span>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
