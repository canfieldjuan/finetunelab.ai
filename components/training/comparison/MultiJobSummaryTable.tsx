/**
 * MultiJobSummaryTable Component
 * Displays a summary comparison table of key metrics across multiple jobs
 * Date: 2025-12-07
 */

'use client';

import React from 'react';
import { Trophy, TrendingDown, Clock, Gauge } from 'lucide-react';
import type { TrainingJob } from '@/lib/hooks/useTrainingJobsRealtime';

interface MultiJobSummaryTableProps {
  jobs: TrainingJob[];
  jobColors: Record<string, string>;
}

export function MultiJobSummaryTable({ jobs, jobColors }: MultiJobSummaryTableProps) {
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
              <th className="text-left p-4 font-semibold text-sm">Run</th>
              <th className="text-left p-4 font-semibold text-sm">Model</th>
              <th className="text-center p-4 font-semibold text-sm">Status</th>
              <th className="text-right p-4 font-semibold text-sm">
                <div className="flex items-center justify-end gap-1">
                  <TrendingDown className="w-4 h-4" />
                  Best Eval Loss
                </div>
              </th>
              <th className="text-right p-4 font-semibold text-sm">Train Loss</th>
              <th className="text-right p-4 font-semibold text-sm">Perplexity</th>
              <th className="text-right p-4 font-semibold text-sm">
                <div className="flex items-center justify-end gap-1">
                  <Gauge className="w-4 h-4" />
                  Speed
                </div>
              </th>
              <th className="text-right p-4 font-semibold text-sm">
                <div className="flex items-center justify-end gap-1">
                  <Clock className="w-4 h-4" />
                  Duration
                </div>
              </th>
              <th className="text-center p-4 font-semibold text-sm">Epochs</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, index) => {
              const evalLoss = job.best_eval_loss;
              const trainLoss = job.loss ?? job.final_loss;
              const isBestEval = evalLoss === bestEvalLoss && evalLoss !== undefined;
              const isBestTrain = trainLoss === bestTrainLoss && trainLoss !== undefined;
              const isFastest = job.samples_per_second === fastestSpeed && fastestSpeed > 0;

              return (
                <tr
                  key={job.id}
                  className="border-b border-border hover:bg-muted/20 transition-colors"
                >
                  {/* Run indicator with color */}
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: jobColors[job.id] }}
                      />
                      <span className="font-medium">Run {index + 1}</span>
                    </div>
                  </td>

                  {/* Model name */}
                  <td className="p-4">
                    <div className="max-w-[200px] truncate text-sm" title={job.model_name || ''}>
                      {getCleanModelName(job.model_name)}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="p-4 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
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
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isBestEval && <Trophy className="w-4 h-4 text-yellow-500" />}
                      <span className={`font-mono ${isBestEval ? 'font-bold text-green-600 dark:text-green-400' : ''}`}>
                        {evalLoss?.toFixed(4) ?? 'N/A'}
                      </span>
                    </div>
                  </td>

                  {/* Train Loss */}
                  <td className="p-4 text-right">
                    <span className={`font-mono ${isBestTrain ? 'font-bold text-green-600 dark:text-green-400' : ''}`}>
                      {trainLoss?.toFixed(4) ?? 'N/A'}
                    </span>
                  </td>

                  {/* Perplexity */}
                  <td className="p-4 text-right font-mono">
                    {job.perplexity?.toFixed(2) ?? 'N/A'}
                  </td>

                  {/* Speed */}
                  <td className="p-4 text-right">
                    <span className={`font-mono ${isFastest ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}>
                      {job.samples_per_second?.toFixed(1) ?? 'N/A'}
                      {job.samples_per_second && <span className="text-muted-foreground text-xs ml-1">s/s</span>}
                    </span>
                  </td>

                  {/* Duration */}
                  <td className="p-4 text-right font-mono">
                    {formatDuration(job.started_at, job.completed_at)}
                  </td>

                  {/* Epochs */}
                  <td className="p-4 text-center font-mono">
                    {job.current_epoch ?? job.total_epochs ?? 'N/A'}
                    {job.total_epochs && `/${job.total_epochs}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Best performer callout */}
      {bestEvalLoss !== Infinity && (
        <div className="px-6 py-4 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-green-800 dark:text-green-400">
            <Trophy className="w-5 h-5" />
            <span className="font-medium">
              Best performer: {getCleanModelName(jobs.find(j => j.best_eval_loss === bestEvalLoss)?.model_name || null)}
              {' '}with eval loss of {bestEvalLoss.toFixed(4)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
