"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { TrainingEffectivenessMetrics } from '@/hooks/useAnalytics';
import { formatModelName } from '@/lib/utils/format-labels';

interface TrainingEffectivenessChartProps {
  data: TrainingEffectivenessMetrics[];
}

export function TrainingEffectivenessChart({ data }: TrainingEffectivenessChartProps) {
  console.log('[TrainingEffectivenessChart] Rendering with data:', {
    methodCount: data?.length || 0
  });

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Training Effectiveness</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            No training data available. To track training effectiveness:
          </p>
          <ul className="mt-2 text-xs text-gray-400 list-disc list-inside space-y-1">
            <li>Add models to LLM Registry with training metadata</li>
            <li>Set training_method (sft, dpo, or rlhf) on fine-tuned models</li>
            <li>Use the models in conversations and evaluate responses</li>
          </ul>
        </CardContent>
      </Card>
    );
  }

  // Helper to get display name for training method
  const getMethodDisplay = (method: string): string => {
    const map: Record<string, string> = {
      'base': 'Base Models',
      'sft': 'Supervised Fine-Tuning (SFT)',
      'dpo': 'Direct Preference Optimization (DPO)',
      'rlhf': 'Reinforcement Learning from Human Feedback (RLHF)'
    };
    return map[method] || method;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Training Method Effectiveness</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Compare performance across different training approaches
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="py-2 px-3">Training Method</th>
                  <th className="py-2 px-3 text-right">Models</th>
                  <th className="py-2 px-3 text-right">Messages</th>
                  <th className="py-2 px-3 text-right">Avg Rating</th>
                  <th className="py-2 px-3 text-right">Success Rate</th>
                  <th className="py-2 px-3 text-right">Avg Latency</th>
                  <th className="py-2 px-3 text-right">Cost/Msg</th>
                </tr>
              </thead>
              <tbody>
                {data.map((method) => (
                  <tr key={method.trainingMethod} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-3">
                      <div className="font-medium">{getMethodDisplay(method.trainingMethod)}</div>
                      {/* List models explicitly to avoid confusion */}
                      <div className="text-xs text-muted-foreground mt-1">
                        {method.models.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {method.models.slice(0, 3).map(m => (
                              <span key={m.modelId} className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[10px] border border-gray-200 dark:border-gray-700">
                                {m.modelName}
                              </span>
                            ))}
                            {method.models.length > 3 && (
                              <span className="text-[10px] text-gray-500 self-center">
                                +{method.models.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="italic text-gray-400">No specific models identified</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-medium">
                      {method.modelCount}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {method.totalMessages}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {method.evaluationCount > 0 ? (
                        <span className="text-yellow-600">
                          {method.avgRating.toFixed(1)} ⭐
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {method.evaluationCount > 0 ? (
                        <span
                          className={
                            method.successRate >= 80
                              ? 'text-green-600 font-medium'
                              : method.successRate >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600 font-medium'
                          }
                        >
                          {method.successRate.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {method.avgResponseTime > 0 ? (
                        <span className="text-gray-700">
                          {Math.round(method.avgResponseTime)}ms
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-gray-700 font-mono">
                        ${method.avgCostPerMessage.toFixed(4)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Model Details - Expandable sections */}
          {data.filter(m => m.models.length > 0).map((method) => (
            <div key={`details-${method.trainingMethod}`} className="border rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-3 text-gray-700">
                {getMethodDisplay(method.trainingMethod)} - Model Breakdown
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="py-2 px-2">Model Name</th>
                      <th className="py-2 px-2">Base Model</th>
                      <th className="py-2 px-2 text-right">Avg Rating</th>
                      <th className="py-2 px-2 text-right">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {method.models.map((model) => (
                      <tr key={model.modelId} className="border-b">
                        <td className="py-2 px-2 font-medium">
                          {formatModelName(model.modelName)}
                        </td>
                        <td className="py-2 px-2 text-gray-600">
                          {formatModelName(model.baseModel) || '-'}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <span className="text-yellow-600">
                            {model.avgRating > 0 ? `${model.avgRating.toFixed(1)} ⭐` : '-'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <span
                            className={
                              model.successRate >= 80
                                ? 'text-green-600'
                                : model.successRate >= 60
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }
                          >
                            {model.successRate > 0 ? `${model.successRate.toFixed(1)}%` : '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Info footer */}
          <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="font-medium text-blue-800 mb-1">Training Effectiveness Insights:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Compare base models vs fine-tuned models to measure training impact</li>
              <li>Higher success rates and ratings indicate more effective training</li>
              <li>SFT typically improves task-specific performance</li>
              <li>DPO and RLHF refine model behavior based on preferences</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
