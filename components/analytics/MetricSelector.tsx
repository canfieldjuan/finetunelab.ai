"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

export type MetricKey =
  // Session metrics
  | 'totalConversations'
  | 'totalMessages'
  | 'avgRating'
  | 'successRate'
  | 'errorRate'
  | 'avgInputTokens'
  | 'avgOutputTokens'
  | 'avgResponseTime'
  | 'totalCost'
  | 'evaluationCount'
  | 'firstConversation'
  | 'lastConversation'
  // Model metrics (additional to session)
  | 'provider'
  | 'baseModel'
  | 'trainingMethod'
  | 'costPerMessage'
  | 'totalConversations'
  | 'trainingMetrics';

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  description: string;
  category: 'performance' | 'cost' | 'tokens' | 'quality' | 'metadata';
  format: 'number' | 'percentage' | 'currency' | 'tokens' | 'time' | 'date' | 'text';
  defaultVisible: boolean;
}

// Define all available metrics for session comparison
export const SESSION_METRICS: MetricDefinition[] = [
  // Quality metrics
  { key: 'avgRating', label: 'Avg Rating', description: 'Average rating score', category: 'quality', format: 'number', defaultVisible: true },
  { key: 'successRate', label: 'Success Rate', description: 'Percentage of successful messages', category: 'quality', format: 'percentage', defaultVisible: true },
  { key: 'errorRate', label: 'Error Rate', description: 'Percentage of messages with errors', category: 'quality', format: 'percentage', defaultVisible: false },
  { key: 'evaluationCount', label: 'Evaluations', description: 'Number of evaluations', category: 'quality', format: 'number', defaultVisible: false },

  // Performance metrics
  { key: 'avgResponseTime', label: 'Avg Latency', description: 'Average response time in ms', category: 'performance', format: 'time', defaultVisible: true },

  // Volume metrics
  { key: 'totalConversations', label: 'Conversations', description: 'Total number of conversations', category: 'metadata', format: 'number', defaultVisible: true },
  { key: 'totalMessages', label: 'Messages', description: 'Total number of messages', category: 'metadata', format: 'number', defaultVisible: true },

  // Token metrics
  { key: 'avgInputTokens', label: 'Avg Input Tokens', description: 'Average tokens per input', category: 'tokens', format: 'tokens', defaultVisible: false },
  { key: 'avgOutputTokens', label: 'Avg Output Tokens', description: 'Average tokens per output', category: 'tokens', format: 'tokens', defaultVisible: false },

  // Cost metrics
  { key: 'totalCost', label: 'Total Cost', description: 'Cumulative cost for session', category: 'cost', format: 'currency', defaultVisible: true },

  // Date metrics
  { key: 'firstConversation', label: 'First Conversation', description: 'Date of first conversation', category: 'metadata', format: 'date', defaultVisible: false },
  { key: 'lastConversation', label: 'Last Conversation', description: 'Date of last conversation', category: 'metadata', format: 'date', defaultVisible: false },
];

// Define all available metrics for model performance
export const MODEL_METRICS: MetricDefinition[] = [
  // Quality metrics
  { key: 'avgRating', label: 'Avg Rating', description: 'Average rating score', category: 'quality', format: 'number', defaultVisible: true },
  { key: 'successRate', label: 'Success Rate', description: 'Percentage of successful messages', category: 'quality', format: 'percentage', defaultVisible: true },
  { key: 'errorRate', label: 'Error Rate', description: 'Percentage of messages with errors', category: 'quality', format: 'percentage', defaultVisible: false },
  { key: 'evaluationCount', label: 'Evaluations', description: 'Number of evaluations', category: 'quality', format: 'number', defaultVisible: false },

  // Performance metrics
  { key: 'avgResponseTime', label: 'Avg Latency', description: 'Average response time in ms', category: 'performance', format: 'time', defaultVisible: true },

  // Volume metrics
  { key: 'totalMessages', label: 'Messages', description: 'Total number of messages', category: 'metadata', format: 'number', defaultVisible: true },
  { key: 'totalConversations', label: 'Conversations', description: 'Total number of conversations', category: 'metadata', format: 'number', defaultVisible: false },

  // Token metrics
  { key: 'avgInputTokens', label: 'Avg Input Tokens', description: 'Average tokens per input', category: 'tokens', format: 'tokens', defaultVisible: false },
  { key: 'avgOutputTokens', label: 'Avg Output Tokens', description: 'Average tokens per output', category: 'tokens', format: 'tokens', defaultVisible: false },

  // Cost metrics
  { key: 'costPerMessage', label: 'Cost/Msg', description: 'Average cost per message', category: 'cost', format: 'currency', defaultVisible: true },

  // Model metadata
  { key: 'provider', label: 'Provider', description: 'Model provider name', category: 'metadata', format: 'text', defaultVisible: false },
  { key: 'baseModel', label: 'Base Model', description: 'Foundation model', category: 'metadata', format: 'text', defaultVisible: false },
  { key: 'trainingMethod', label: 'Training Method', description: 'Training approach (SFT/DPO/RLHF)', category: 'metadata', format: 'text', defaultVisible: false },
  { key: 'trainingMetrics', label: 'Training Metrics', description: 'Training effectiveness data', category: 'metadata', format: 'text', defaultVisible: false },
];

interface MetricSelectorProps {
  type: 'session' | 'model';
  selectedMetrics: MetricKey[];
  onMetricsChange: (metrics: MetricKey[]) => void;
  className?: string;
}

export function MetricSelector({
  type,
  selectedMetrics,
  onMetricsChange,
  className = ''
}: MetricSelectorProps) {
  console.log('[MetricSelector] Rendering with:', {
    type,
    selectedCount: selectedMetrics.length,
    selectedMetrics
  });

  const metrics = type === 'session' ? SESSION_METRICS : MODEL_METRICS;

  // Group metrics by category
  const metricsByCategory = metrics.reduce((acc, metric) => {
    if (!acc[metric.category]) {
      acc[metric.category] = [];
    }
    acc[metric.category].push(metric);
    return acc;
  }, {} as Record<string, MetricDefinition[]>);

  const handleMetricToggle = (metricKey: MetricKey) => {
    const newMetrics = selectedMetrics.includes(metricKey)
      ? selectedMetrics.filter(m => m !== metricKey)
      : [...selectedMetrics, metricKey];

    console.log('[MetricSelector] Metric toggled:', {
      metric: metricKey,
      isNowSelected: !selectedMetrics.includes(metricKey),
      newCount: newMetrics.length
    });

    onMetricsChange(newMetrics);
  };

  const handleShowAll = () => {
    const allMetrics = metrics.map(m => m.key);
    console.log('[MetricSelector] Showing all metrics:', allMetrics.length);
    onMetricsChange(allMetrics);
  };

  const handleShowDefaults = () => {
    const defaultMetrics = metrics.filter(m => m.defaultVisible).map(m => m.key);
    console.log('[MetricSelector] Showing default metrics:', defaultMetrics.length);
    onMetricsChange(defaultMetrics);
  };

  const categoryLabels: Record<string, string> = {
    quality: 'Quality',
    performance: 'Performance',
    cost: 'Cost',
    tokens: 'Tokens',
    metadata: 'Metadata'
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            <CardTitle>Select Metrics</CardTitle>
            <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
              {selectedMetrics.length} selected
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShowDefaults}
              className="text-xs"
            >
              <EyeOff className="w-3 h-3 mr-1" />
              Defaults
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShowAll}
              className="text-xs"
            >
              <Eye className="w-3 h-3 mr-1" />
              Show All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(metricsByCategory).map(([category, categoryMetrics]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold mb-2 text-gray-700">
                {categoryLabels[category] || category}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {categoryMetrics.map(metric => (
                  <div key={metric.key} className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      id={`metric-${metric.key}`}
                      checked={selectedMetrics.includes(metric.key)}
                      onChange={() => handleMetricToggle(metric.key)}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 cursor-pointer"
                    />
                    <label
                      htmlFor={`metric-${metric.key}`}
                      className="text-sm cursor-pointer flex-1"
                      title={metric.description}
                    >
                      {metric.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
