'use client';

import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TrainingJob } from '@/lib/hooks/useTrainingJobsRealtime';

interface ComparisonModalProps {
  jobs: TrainingJob[];
  isOpen: boolean;
  onClose: () => void;
}

export function ComparisonModal({ jobs, isOpen, onClose }: ComparisonModalProps) {
  // Find best run (lowest eval_loss)
  const bestRun = useMemo(() => {
    if (!jobs || jobs.length === 0) return null;
    return jobs.reduce((best, job) => {
      const jobLoss = job.best_eval_loss ?? Infinity;
      const bestLoss = best?.best_eval_loss ?? Infinity;
      return jobLoss < bestLoss ? job : best;
    }, jobs[0]);
  }, [jobs]);

  if (!isOpen) return null;
  if (!bestRun) return null;

  // Helper to get clean model name
  const getCleanModelName = (modelPath: string | null): string => {
    if (!modelPath) return 'Unknown Model';

    // Handle local paths like: huggingface_models/Qwen-Qwen3-1.7B/snapshots/...
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

    // Handle HuggingFace IDs like: Qwen/Qwen3-1.7B
    if (modelPath.includes('/')) {
      const parts = modelPath.split('/');
      if (parts.length >= 2) {
        return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
      }
    }

    return modelPath;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Checkpoint Comparison</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Comparing {jobs.length} training runs
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Metrics Comparison Table */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Loss Metrics Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-left p-3 text-sm font-semibold bg-muted/50">Metric</th>
                    {jobs.map((job, idx) => (
                      <th key={job.id} className="text-center p-3 text-sm font-semibold bg-muted/50">
                        <div>Run #{idx + 1}</div>
                        {bestRun.id === job.id && <div className="text-yellow-600">🏆</div>}
                      </th>
                    ))}
                    <th className="text-center p-3 text-sm font-semibold bg-green-50">Best Value</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Model Name */}
                  <tr className="border-b border-border hover:bg-muted/30">
                    <td className="p-3 text-sm font-medium">Model</td>
                    {jobs.map(job => (
                      <td key={job.id} className="p-3 text-sm text-center">
                        <div className="truncate max-w-[200px]">
                          {getCleanModelName(job.model_name)}
                        </div>
                      </td>
                    ))}
                    <td className="p-3 text-sm text-center text-muted-foreground bg-green-50/30">-</td>
                  </tr>

                  {/* Job ID */}
                  <tr className="border-b border-border hover:bg-muted/30">
                    <td className="p-3 text-sm font-medium">Job ID</td>
                    {jobs.map(job => (
                      <td key={job.id} className="p-3 text-xs text-center font-mono">
                        {job.id.substring(0, 8)}...
                      </td>
                    ))}
                    <td className="p-3 text-sm text-center text-muted-foreground bg-green-50/30">-</td>
                  </tr>

                  {/* Status */}
                  <tr className="border-b border-border hover:bg-muted/30">
                    <td className="p-3 text-sm font-medium">Status</td>
                    {jobs.map(job => (
                      <td key={job.id} className="p-3 text-sm text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          job.status === 'completed' ? 'bg-green-100 text-green-800' :
                          job.status === 'failed' ? 'bg-red-100 text-red-800' :
                          job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                    ))}
                    <td className="p-3 text-sm text-center text-muted-foreground bg-green-50/30">-</td>
                  </tr>

                  {/* Best Eval Loss - Primary metric */}
                  <tr className="border-b-2 border-border hover:bg-muted/30 bg-blue-50/30">
                    <td className="p-3 text-sm font-bold">Best Eval Loss ⭐</td>
                    {jobs.map(job => {
                      const loss = job.best_eval_loss;
                      const isBest = bestRun.id === job.id;
                      const deltaVsBest = loss != null && bestRun.best_eval_loss != null && !isBest
                        ? ((loss - bestRun.best_eval_loss) / bestRun.best_eval_loss * 100)
                        : null;

                      return (
                        <td key={job.id} className={`p-3 text-sm text-center ${isBest ? 'font-bold bg-green-50' : ''}`}>
                          <div className={isBest ? 'text-green-700 text-base' : ''}>
                            {loss != null ? loss.toFixed(4) : 'N/A'}
                          </div>
                          {deltaVsBest != null && deltaVsBest > 0 && (
                            <div className={`text-xs mt-1 ${
                              deltaVsBest > 25 ? 'text-red-600' :
                              deltaVsBest > 10 ? 'text-orange-600' :
                              'text-yellow-600'
                            }`}>
                              +{deltaVsBest.toFixed(1)}%
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-3 text-sm text-center font-bold text-green-700 bg-green-50">
                      {bestRun.best_eval_loss?.toFixed(4) || 'N/A'}
                    </td>
                  </tr>

                  {/* Final Loss (Training) */}
                  <tr className="border-b border-border hover:bg-muted/30">
                    <td className="p-3 text-sm font-medium">Final Training Loss</td>
                    {jobs.map(job => {
                      const loss = job.loss || job.final_loss;
                      return (
                        <td key={job.id} className="p-3 text-sm text-center">
                          {loss != null ? loss.toFixed(4) : 'N/A'}
                        </td>
                      );
                    })}
                    <td className="p-3 text-sm text-center text-muted-foreground bg-green-50/30">-</td>
                  </tr>

                  {/* Final Eval Loss */}
                  <tr className="border-b border-border hover:bg-muted/30">
                    <td className="p-3 text-sm font-medium">Final Eval Loss</td>
                    {jobs.map(job => {
                      const loss = job.eval_loss || job.final_eval_loss;
                      return (
                        <td key={job.id} className="p-3 text-sm text-center">
                          {loss != null ? loss.toFixed(4) : 'N/A'}
                        </td>
                      );
                    })}
                    <td className="p-3 text-sm text-center text-muted-foreground bg-green-50/30">-</td>
                  </tr>

                  {/* Best Epoch */}
                  <tr className="border-b border-border hover:bg-muted/30">
                    <td className="p-3 text-sm font-medium">Best Checkpoint Epoch</td>
                    {jobs.map(job => (
                      <td key={job.id} className="p-3 text-sm text-center">
                        {job.best_epoch != null ? `${job.best_epoch}/${job.total_epochs || '?'}` : 'N/A'}
                      </td>
                    ))}
                    <td className="p-3 text-sm text-center bg-green-50/30">
                      {bestRun.best_epoch != null ? `Epoch ${bestRun.best_epoch}` : '-'}
                    </td>
                  </tr>

                  {/* Checkpoint Path */}
                  <tr className="border-b border-border hover:bg-muted/30">
                    <td className="p-3 text-sm font-medium">Checkpoint Path</td>
                    {jobs.map(job => (
                      <td key={job.id} className="p-3 text-xs text-center font-mono">
                        {job.best_checkpoint_path ? (
                          <div className="truncate max-w-[150px] mx-auto">
                            {job.best_checkpoint_path.split('/').pop()}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No checkpoint</span>
                        )}
                      </td>
                    ))}
                    <td className="p-3 text-sm text-center text-muted-foreground bg-green-50/30">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-green-900 mb-2 flex items-center gap-2">
              🎯 Recommendation
            </h3>
            <div className="space-y-2">
              <p className="text-sm text-green-800">
                <strong>Best Checkpoint:</strong> Run #{jobs.findIndex(j => j.id === bestRun.id) + 1} - {getCleanModelName(bestRun.model_name)}
              </p>
              <ul className="text-sm text-green-800 space-y-1 ml-4 list-disc">
                <li>
                  <strong>Best eval loss:</strong> {bestRun.best_eval_loss?.toFixed(4) || 'N/A'}
                  {bestRun.best_epoch && ` (achieved at epoch ${bestRun.best_epoch}/${bestRun.total_epochs})`}
                </li>
                {bestRun.best_checkpoint_path && (
                  <li>
                    <strong>Checkpoint:</strong> {bestRun.best_checkpoint_path.split('/').pop()}
                  </li>
                )}
                <li className="text-xs text-green-700 mt-2">
                  <strong>Job ID:</strong> <code className="bg-green-100 px-1 rounded">{bestRun.id}</code>
                </li>
              </ul>

              {/* Performance Summary */}
              {jobs.length > 1 && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="text-sm text-green-800 font-medium mb-1">Performance Summary:</p>
                  <ul className="text-sm text-green-700 space-y-1 ml-4 list-disc">
                    {jobs.map((job, idx) => {
                      if (job.id === bestRun.id) return null;
                      const delta = job.best_eval_loss && bestRun.best_eval_loss
                        ? ((job.best_eval_loss - bestRun.best_eval_loss) / bestRun.best_eval_loss * 100)
                        : null;

                      return delta != null ? (
                        <li key={job.id}>
                          Run #{idx + 1} is{' '}
                          <span className={delta > 25 ? 'font-bold text-red-700' : delta > 10 ? 'font-bold text-orange-700' : ''}>
                            {delta.toFixed(1)}% worse
                          </span>
                          {delta > 25 && ' (consider archiving)'}
                        </li>
                      ) : null;
                    }).filter(Boolean)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex justify-end gap-3">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
