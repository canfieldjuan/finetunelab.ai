'use client';

import React from 'react';
import type { TrainingJobStatus } from '@/lib/services/training-providers/local.provider';

interface BestModelCardProps {
  status: TrainingJobStatus;
}

export function BestModelCard({ status }: BestModelCardProps) {
  // console.log('[BestModelCard] Rendering with best_eval_loss:', status.best_eval_loss);
  // console.log('[BestModelCard] Loss trend:', status.loss_trend);
  // console.log('[BestModelCard] Epochs without improvement:', status.epochs_without_improvement);

  const hasBestModel = status.best_eval_loss !== undefined &&
                       status.best_eval_loss !== null &&
                       status.best_eval_loss !== Infinity;

  if (!hasBestModel) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-medium">No Best Model Yet</p>
          <p className="text-sm mt-1">Best model checkpoint will appear after first evaluation.</p>
        </div>
      </div>
    );
  }

  const getTrendIcon = (trend: string | undefined) => {
    switch (trend) {
      case 'improving': return '↓';
      case 'degrading': return '↑';
      case 'stable': return '→';
      default: return '?';
    }
  };

  const getTrendColor = (trend: string | undefined) => {
    switch (trend) {
      case 'improving': return 'text-green-600 bg-green-50 border-green-200';
      case 'degrading': return 'text-red-600 bg-red-50 border-red-200';
      case 'stable': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getEarlyStoppingMessage = () => {
    const noImprovement = status.epochs_without_improvement || 0;
    // Note: epochs_without_improvement is now binary (0 or 1)
    // 0 = last eval improved vs previous eval
    // 1 = last eval didn't improve vs previous eval
    if (noImprovement === 0) {
      return { text: 'Last eval improved!', color: 'text-green-700' };
    } else {
      return { text: 'Last eval did not improve', color: 'text-amber-700' };
    }
  };

  const earlyStoppingMsg = getEarlyStoppingMessage();

  const formatNumber = (num: number | undefined, decimals = 2) => {
    if (num === undefined || num === null) return 'N/A';
    return num.toFixed(decimals);
  };

  const currentVsBest = status.eval_loss && status.best_eval_loss
    ? ((status.eval_loss - status.best_eval_loss) / status.best_eval_loss * 100)
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Best Model Checkpoint</h3>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="text-xs text-green-800 mb-1">Best Eval Loss</div>
            <div className="text-2xl font-bold text-green-900">
              {formatNumber(status.best_eval_loss, 6)}
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-xs text-blue-800 mb-1">Best Epoch</div>
            <div className="text-2xl font-bold text-blue-900">
              {status.best_epoch}
            </div>
          </div>

          <div className="p-4 bg-purple-50 border border-purple-200 rounded-md">
            <div className="text-xs text-purple-800 mb-1">Best Step</div>
            <div className="text-2xl font-bold text-purple-900">
              {status.best_step}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-4 border rounded-md ${getTrendColor(status.loss_trend)}`}>
            <div className="text-xs font-semibold mb-1">Loss Trend</div>
            <div className="flex items-center text-lg font-bold">
              <span className="mr-2 text-2xl">{getTrendIcon(status.loss_trend)}</span>
              <span>{status.loss_trend || 'Unknown'}</span>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
            <div className="text-xs text-gray-800 font-semibold mb-1">Early Stopping</div>
            <div className={`text-sm font-medium ${earlyStoppingMsg.color}`}>
              {earlyStoppingMsg.text}
            </div>
          </div>
        </div>

        {currentVsBest !== null && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-xs text-blue-800 mb-1">Current vs Best</div>
            <div className="text-sm text-blue-900">
              Current eval loss is{' '}
              <span className="font-semibold">
                {currentVsBest > 0 ? '+' : ''}{currentVsBest.toFixed(2)}%
              </span>
              {' '}compared to best
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
