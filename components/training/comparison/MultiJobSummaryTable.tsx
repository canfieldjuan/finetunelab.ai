/**
 * MultiJobSummaryTable Component
 * Displays a summary comparison table of key metrics across multiple jobs
 * Date: 2025-12-07
 * Updated: 2025-12-12 - Added sortable columns, overfitting indicator, LR/batch size
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Trophy, TrendingDown, Clock, Gauge, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Star } from 'lucide-react';
import type { TrainingJob } from '@/lib/hooks/useTrainingJobsRealtime';

type SortField = 'run' | 'model' | 'status' | 'eval_loss' | 'train_loss' | 'overfit' | 'lr' | 'batch' | 'speed' | 'duration' | 'epochs';
type SortDirection = 'asc' | 'desc';

interface MultiJobSummaryTableProps {
  jobs: TrainingJob[];
  jobColors: Record<string, string>;
  recommendedJobId?: string;
  recommendationReasons?: string[];
}

export function MultiJobSummaryTable({
  jobs,
  jobColors,
  recommendedJobId,
  recommendationReasons,
}: MultiJobSummaryTableProps) {
  const [sortField, setSortField] = useState<SortField>('eval_loss');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Calculate overfitting gap for each job
  const getOverfitGap = (job: TrainingJob): number | null => {
    const evalLoss = job.best_eval_loss ?? job.eval_loss;
    const trainLoss = job.loss ?? job.final_loss;
    if (evalLoss === null || evalLoss === undefined || trainLoss === null || trainLoss === undefined) {
      return null;
    }
    return evalLoss - trainLoss;
  };

  // Calculate duration in minutes for sorting
  const getDurationMinutes = (job: TrainingJob): number => {
    if (!job.started_at) return 0;
    const start = new Date(job.started_at).getTime();
    const end = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
    return (end - start) / (1000 * 60);
  };

  // Sort jobs based on current sort field and direction
  const sortedJobs = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => {
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;

      switch (sortField) {
        case 'eval_loss':
          aVal = a.best_eval_loss ?? Infinity;
          bVal = b.best_eval_loss ?? Infinity;
          break;
        case 'train_loss':
          aVal = a.loss ?? a.final_loss ?? Infinity;
          bVal = b.loss ?? b.final_loss ?? Infinity;
          break;
        case 'overfit':
          aVal = getOverfitGap(a) ?? Infinity;
          bVal = getOverfitGap(b) ?? Infinity;
          break;
        case 'lr':
          aVal = a.learning_rate ?? 0;
          bVal = b.learning_rate ?? 0;
          break;
        case 'batch':
          aVal = a.batch_size ?? 0;
          bVal = b.batch_size ?? 0;
          break;
        case 'speed':
          aVal = a.samples_per_second ?? 0;
          bVal = b.samples_per_second ?? 0;
          break;
        case 'duration':
          aVal = getDurationMinutes(a);
          bVal = getDurationMinutes(b);
          break;
        case 'epochs':
          aVal = a.current_epoch ?? a.total_epochs ?? 0;
          bVal = b.current_epoch ?? b.total_epochs ?? 0;
          break;
        case 'model':
          aVal = a.model_name ?? '';
          bVal = b.model_name ?? '';
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      const numA = aVal as number;
      const numB = bVal as number;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });
    return sorted;
  }, [jobs, sortField, sortDirection]);

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort indicator component
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3" />
      : <ArrowDown className="w-3 h-3" />;
  };

  if (jobs.length === 0) {
    return (
      <div className="p-6 bg-muted/30 rounded-lg border border-dashed text-center">
        <p className="text-muted-foreground">Select jobs to see comparison summary</p>
      </div>
    );
  }

  // Find best values for highlighting
  const bestEvalLoss = Math.min(
    ...jobs.map(j => j.best_eval_loss ?? Infinity).filter(v => v !== Infinity)
  );
  const bestTrainLoss = Math.min(
    ...jobs.map(j => j.loss ?? j.final_loss ?? Infinity).filter(v => v !== Infinity)
  );
  const fastestSpeed = Math.max(
    ...jobs.map(j => j.samples_per_second ?? 0)
  );
  const lowestOverfit = Math.min(
    ...jobs.map(j => getOverfitGap(j) ?? Infinity).filter(v => v !== Infinity && v >= 0)
  );

  // Helper to get clean model name
  const getCleanModelName = (modelPath: string | null): string => {
    if (!modelPath) return 'Unknown';
    if (modelPath.includes('huggingface_models/')) {
      const match = modelPath.match(/huggingface_models\/([^\/]+)/);
      if (match) {
        const modelName = match[1];
        const firstHyphen = modelName.indexOf('-');
        if (firstHyphen !== -1) {
          return modelName.substring(0, firstHyphen) + '/' + modelName.substring(firstHyphen + 1);
        }
        return modelName;
      }
    }
    if (modelPath.includes('/')) {
      const parts = modelPath.split('/');
      if (parts.length >= 2) {
        return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
      }
    }
    return modelPath;
  };

  const formatDuration = (startedAt: string | null, completedAt: string | null): string => {
    if (!startedAt) return 'N/A';
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const durationMs = end - start;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-muted/50 border-b border-border">
        <h3 className="text-lg font-semibold">Metrics Summary</h3>
        <p className="text-sm text-muted-foreground">
          Key metrics comparison across selected runs
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-semibold text-xs whitespace-nowrap">Run</th>
              <th
                className="text-left p-3 font-semibold text-xs cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                onClick={() => handleSort('model')}
              >
                <div className="flex items-center gap-1">
                  Model
                  <SortIndicator field="model" />
                </div>
              </th>
              <th
                className="text-center p-3 font-semibold text-xs cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center justify-center gap-1">
                  Status
                  <SortIndicator field="status" />
                </div>
              </th>
              <th
                className="text-right p-3 font-semibold text-xs cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                onClick={() => handleSort('eval_loss')}
              >
                <div className="flex items-center justify-end gap-1">
                  <TrendingDown className="w-3 h-3" />
                  Eval Loss
                  <SortIndicator field="eval_loss" />
                </div>
              </th>
              <th
                className="text-right p-3 font-semibold text-xs cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                onClick={() => handleSort('train_loss')}
              >
                <div className="flex items-center justify-end gap-1">
                  Train Loss
                  <SortIndicator field="train_loss" />
                </div>
              </th>
              <th
                className="text-right p-3 font-semibold text-xs cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                onClick={() => handleSort('overfit')}
                title="Eval Loss - Train Loss (lower is better, negative may indicate data leakage)"
              >
                <div className="flex items-center justify-end gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Gap
                  <SortIndicator field="overfit" />
                </div>
              </th>
              <th
                className="text-right p-3 font-semibold text-xs cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                onClick={() => handleSort('lr')}
              >
                <div className="flex items-center justify-end gap-1">
                  LR
                  <SortIndicator field="lr" />
                </div>
              </th>
              <th
                className="text-right p-3 font-semibold text-xs cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                onClick={() => handleSort('batch')}
              >
                <div className="flex items-center justify-end gap-1">
                  Batch
                  <SortIndicator field="batch" />
                </div>
              </th>
              <th
                className="text-right p-3 font-semibold text-xs cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                onClick={() => handleSort('speed')}
              >
                <div className="flex items-center justify-end gap-1">
                  <Gauge className="w-3 h-3" />
                  Speed
                  <SortIndicator field="speed" />
                </div>
              </th>
              <th
                className="text-right p-3 font-semibold text-xs cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                onClick={() => handleSort('duration')}
              >
                <div className="flex items-center justify-end gap-1">
                  <Clock className="w-3 h-3" />
                  Time
                  <SortIndicator field="duration" />
                </div>
              </th>
              <th
                className="text-center p-3 font-semibold text-xs cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                onClick={() => handleSort('epochs')}
              >
                <div className="flex items-center justify-center gap-1">
                  Epochs
                  <SortIndicator field="epochs" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedJobs.map((job, index) => {
              const evalLoss = job.best_eval_loss;
              const trainLoss = job.loss ?? job.final_loss;
              const overfitGap = getOverfitGap(job);
              const isBestEval = evalLoss === bestEvalLoss && evalLoss !== undefined;
              const isBestTrain = trainLoss === bestTrainLoss && trainLoss !== undefined;
              const isBestOverfit = overfitGap === lowestOverfit && overfitGap !== null && lowestOverfit !== Infinity;
              const isFastest = job.samples_per_second === fastestSpeed && fastestSpeed > 0;
              const isOverfitting = overfitGap !== null && overfitGap > 0.1;
              const isRecommended = job.id === recommendedJobId;

              return (
                <tr
                  key={job.id}
                  className={`border-b border-border hover:bg-muted/20 transition-colors ${
                    isRecommended ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''
                  }`}
                >
                  {/* Run indicator with color */}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {isRecommended ? (
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                      ) : (
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: jobColors[job.id] }}
                        />
                      )}
                      <span className="font-medium text-xs">{index + 1}</span>
                    </div>
                  </td>

                  {/* Model name */}
                  <td className="p-3">
                    <div className="max-w-[140px] truncate text-xs" title={job.model_name || ''}>
                      {getCleanModelName(job.model_name)}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="p-3 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        job.status === 'completed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : job.status === 'running'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : job.status === 'failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>

                  {/* Best Eval Loss */}
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isBestEval && <Trophy className="w-3 h-3 text-yellow-500" />}
                      <span className={`font-mono text-xs ${isBestEval ? 'font-bold text-green-600 dark:text-green-400' : ''}`}>
                        {evalLoss?.toFixed(4) ?? 'N/A'}
                      </span>
                    </div>
                  </td>

                  {/* Train Loss */}
                  <td className="p-3 text-right">
                    <span className={`font-mono text-xs ${isBestTrain ? 'font-bold text-green-600 dark:text-green-400' : ''}`}>
                      {trainLoss?.toFixed(4) ?? 'N/A'}
                    </span>
                  </td>

                  {/* Overfitting Gap */}
                  <td className="p-3 text-right">
                    <span
                      className={`font-mono text-xs ${
                        isBestOverfit
                          ? 'font-bold text-green-600 dark:text-green-400'
                          : isOverfitting
                          ? 'text-orange-600 dark:text-orange-400'
                          : ''
                      }`}
                      title={overfitGap !== null ? `${overfitGap > 0 ? '+' : ''}${overfitGap.toFixed(4)} (eval - train)` : 'N/A'}
                    >
                      {overfitGap !== null
                        ? `${overfitGap > 0 ? '+' : ''}${overfitGap.toFixed(3)}`
                        : 'N/A'}
                    </span>
                  </td>

                  {/* Learning Rate */}
                  <td className="p-3 text-right">
                    <span className="font-mono text-xs">
                      {job.learning_rate ? job.learning_rate.toExponential(1) : 'N/A'}
                    </span>
                  </td>

                  {/* Batch Size */}
                  <td className="p-3 text-right">
                    <span className="font-mono text-xs">
                      {job.batch_size ?? 'N/A'}
                    </span>
                  </td>

                  {/* Speed */}
                  <td className="p-3 text-right">
                    <span className={`font-mono text-xs ${isFastest ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}>
                      {job.samples_per_second?.toFixed(1) ?? 'N/A'}
                    </span>
                  </td>

                  {/* Duration */}
                  <td className="p-3 text-right">
                    <span className="font-mono text-xs">
                      {formatDuration(job.started_at, job.completed_at)}
                    </span>
                  </td>

                  {/* Epochs */}
                  <td className="p-3 text-center">
                    <span className="font-mono text-xs">
                      {job.current_epoch ?? job.total_epochs ?? 'N/A'}
                      {job.total_epochs && `/${job.total_epochs}`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Recommendation callout */}
      {recommendedJobId && (
        <div className="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-400 text-sm">
            <Star className="w-4 h-4 fill-yellow-500" />
            <span className="font-medium">
              Recommended: {getCleanModelName(jobs.find(j => j.id === recommendedJobId)?.model_name || null)}
              {recommendationReasons && recommendationReasons.length > 0 && (
                <span className="ml-2 font-normal text-yellow-700 dark:text-yellow-500">
                  - {recommendationReasons.join(' | ')}
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Fallback: Best eval loss if no recommendation */}
      {!recommendedJobId && bestEvalLoss !== Infinity && (
        <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-green-800 dark:text-green-400 text-sm">
            <Trophy className="w-4 h-4" />
            <span className="font-medium">
              Best Eval Loss: {getCleanModelName(jobs.find(j => j.best_eval_loss === bestEvalLoss)?.model_name || null)}
              {' '}- {bestEvalLoss.toFixed(4)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
