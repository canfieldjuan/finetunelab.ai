/**
 * Finetuned Model Card Component
 * Displays a completed training job as a deployable model card
 * Date: 2025-12-03
 */

'use client';

import React, { useState } from 'react';
import { Clock, Loader2, ChevronDown, ChevronUp, TrendingDown, Database, Gauge, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { TrainingJob } from '@/lib/hooks/useTrainingJobsRealtime';
import {
  calculateLossGap,
  getPerplexityStatus,
  getLossTrendStatus,
  getEpochsWithoutImprovementStatus,
  calculateTrainingDuration,
  getStatusColorClasses,
  type TrainingMetrics
} from '@/lib/training/metrics-calculator';

interface FinetunedModelCardProps {
  job: TrainingJob;
}

export function FinetunedModelCard({ job }: FinetunedModelCardProps) {
  const router = useRouter();
  const { session } = useAuth();
  const [deployingServerless, setDeployingServerless] = useState(false);
  const [deployingProduction, setDeployingProduction] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);

  // Extract clean model name from path
  const getCleanModelName = (modelPath: string | null): string => {
    if (!modelPath) return 'Unnamed Model';

    // Handle local paths like: huggingface_models/Qwen-Qwen3-1.7B/snapshots/...
    if (modelPath.includes('huggingface_models/')) {
      const match = modelPath.match(/huggingface_models\/([^\/]+)/);
      if (match) {
        // Convert Qwen-Qwen3-1.7B back to Qwen/Qwen3-1.7B
        const modelName = match[1];
        // Replace only the first hyphen with a slash
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
      // Return last 2 parts (org/model)
      if (parts.length >= 2) {
        return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
      }
    }

    return modelPath;
  };

  const cleanModelName = getCleanModelName(job.model_name);
  const completedDate = job.completed_at ? new Date(job.completed_at).toLocaleDateString() : 'Unknown';

  // Use shared metrics calculator
  const metricsData: TrainingMetrics = {
    final_loss: job.final_loss,
    final_eval_loss: job.final_eval_loss,
    loss_trend: job.loss_trend,
    perplexity: job.perplexity,
    train_perplexity: job.train_perplexity,
    epochs_without_improvement: job.epochs_without_improvement,
    best_eval_loss: job.best_eval_loss,
  };

  const lossGap = calculateLossGap(metricsData);
  const perplexityStatus = getPerplexityStatus(metricsData);
  const lossTrendStatus = getLossTrendStatus(metricsData);
  const epochsWithoutImprovementStatus = getEpochsWithoutImprovementStatus(metricsData);
  const trainingDuration = calculateTrainingDuration(job.started_at, job.completed_at);

  const handleDeployServerless = async () => {
    if (!session?.access_token) {
      toast.error('Authentication required');
      return;
    }

    setDeployingServerless(true);
    try {
      const response = await fetch('/api/training/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          job_id: job.id,
          server_type: 'runpod-serverless',
          name: `${cleanModelName}-serverless`,
          config: {
            gpu_type: 'NVIDIA RTX A4000',
            budget_limit: 5.0,
            gpu_memory_utilization: 0.85,
            max_model_len: 8192,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Deployment failed');
      }

      toast.success('Serverless deployment started!', {
        description: data.message,
      });

      // Redirect to models page
      if (data.model_id) {
        router.push(`/models?modelId=${data.model_id}`);
      }
    } catch (error) {
      console.error('[FinetunedModelCard] Serverless deployment error:', error);
      toast.error('Deployment failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setDeployingServerless(false);
    }
  };

  const handleDeployProduction = async () => {
    if (!session?.access_token) {
      toast.error('Authentication required');
      return;
    }

    setDeployingProduction(true);
    try {
      const response = await fetch('/api/training/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          job_id: job.id,
          server_type: 'runpod',
          name: `${cleanModelName}-production`,
          config: {
            gpu_type: 'NVIDIA RTX A5000',
            budget_limit: 10.0,
            gpu_memory_utilization: 0.7,
            max_model_len: 8192,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Deployment failed');
      }

      toast.success('Production deployment started!', {
        description: data.message,
      });

      // Redirect to models page
      if (data.model_id) {
        router.push(`/models?modelId=${data.model_id}`);
      }
    } catch (error) {
      console.error('[FinetunedModelCard] Production deployment error:', error);
      toast.error('Deployment failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setDeployingProduction(false);
    }
  };

  return (
    <>
      <div className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow bg-card">
        {/* Model Name & Status */}
        <div className="mb-3">
          <h3 className="font-semibold text-base mb-1 truncate" title={cleanModelName}>
            {cleanModelName}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Ready
            </span>
            {job.best_eval_loss != null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Loss: {job.best_eval_loss.toFixed(4)}
              </span>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="mb-4 space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            <span>Completed: {completedDate}</span>
          </div>
          <div className="font-mono text-xs truncate" title={job.id}>
            ID: {job.id}
          </div>
        </div>

        {/* Training Metrics Toggle */}
        <button
          onClick={() => setShowMetrics(!showMetrics)}
          className="w-full mb-3 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors flex items-center justify-between text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Training Metrics
          </span>
          {showMetrics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Expandable Metrics Section */}
        {showMetrics && (
          <div className="mb-4 p-3 bg-muted/30 rounded-md space-y-2 text-xs">
            {/* Epochs & Steps */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                Epochs
              </span>
              <span className="font-mono font-medium">
                {job.current_epoch != null && job.total_epochs != null
                  ? `${job.current_epoch}/${job.total_epochs}`
                  : job.total_epochs ?? 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                Steps
              </span>
              <span className="font-mono font-medium">
                {job.current_step != null && job.total_steps != null
                  ? `${job.current_step}/${job.total_steps}`
                  : job.total_steps ?? 'N/A'}
              </span>
            </div>

            <div className="h-px bg-border my-2"></div>

            {/* Training Health Indicators */}
            {lossTrendStatus && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <TrendingDown className="w-3 h-3" />
                  Loss Trend
                </span>
                <span className={`font-mono font-medium ${getStatusColorClasses(lossTrendStatus.status)}`}>
                  {lossTrendStatus.trend}
                </span>
              </div>
            )}

            {perplexityStatus && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Gauge className="w-3 h-3" />
                  Perplexity
                </span>
                <span className={`font-mono font-medium ${getStatusColorClasses(perplexityStatus.status)}`}>
                  {perplexityStatus.value.toFixed(2)}
                </span>
              </div>
            )}

            {epochsWithoutImprovementStatus && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Epochs w/o Improvement
                </span>
                <span className={`font-mono font-medium ${getStatusColorClasses(epochsWithoutImprovementStatus.status)}`}>
                  {epochsWithoutImprovementStatus.value}
                </span>
              </div>
            )}

            <div className="h-px bg-border my-2"></div>

            {/* Loss Metrics */}
            {job.best_eval_loss != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <TrendingDown className="w-3 h-3" />
                  Best Eval Loss
                </span>
                <span className="font-mono font-medium text-green-600 dark:text-green-400">
                  {job.best_eval_loss.toFixed(4)}
                </span>
              </div>
            )}

            {job.final_loss != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <TrendingDown className="w-3 h-3" />
                  Final Train Loss
                </span>
                <span className="font-mono font-medium">
                  {job.final_loss.toFixed(4)}
                </span>
              </div>
            )}

            {job.final_eval_loss != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <TrendingDown className="w-3 h-3" />
                  Final Eval Loss
                </span>
                <span className="font-mono font-medium">
                  {job.final_eval_loss.toFixed(4)}
                </span>
              </div>
            )}

            {/* Train/Eval Loss Gap (Overfitting Indicator) */}
            {lossGap && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <TrendingDown className="w-3 h-3" />
                  Train/Eval Gap
                </span>
                <span className={`font-mono font-medium ${getStatusColorClasses(lossGap.status)}`}>
                  {lossGap.gap.toFixed(4)}
                  {lossGap.status === 'good' ? ' ✓' : lossGap.status === 'warning' ? ' ⚠' : ' ⚠'}
                </span>
              </div>
            )}

            <div className="h-px bg-border my-2"></div>

            {/* Dataset Info */}
            {job.train_samples != null && job.val_samples != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Database className="w-3 h-3" />
                  Dataset
                </span>
                <span className="font-mono font-medium">
                  {job.train_samples} train / {job.val_samples} val
                </span>
              </div>
            )}

            {/* Training Duration */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Duration
              </span>
              <span className="font-mono font-medium">{trainingDuration}</span>
            </div>

            {/* Performance */}
            {job.samples_per_second != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Gauge className="w-3 h-3" />
                  Speed
                </span>
                <span className="font-mono font-medium">
                  {job.samples_per_second.toFixed(2)} samples/sec
                </span>
              </div>
            )}

            {/* Best Checkpoint */}
            {job.best_checkpoint_path && (
              <div className="pt-2 border-t border-border">
                <div className="text-muted-foreground mb-1">Best Checkpoint:</div>
                <div className="font-mono text-[10px] truncate bg-background px-2 py-1 rounded">
                  {job.best_checkpoint_path}
                </div>
              </div>
            )}

            {/* Hyperparameters */}
            {(job.learning_rate != null || job.batch_size != null) && (
              <div className="pt-2 border-t border-border space-y-1">
                <div className="text-muted-foreground mb-1">Hyperparameters:</div>
                {job.learning_rate != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Learning Rate</span>
                    <span className="font-mono">{job.learning_rate}</span>
                  </div>
                )}
                {job.batch_size != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Batch Size</span>
                    <span className="font-mono">{job.batch_size}</span>
                  </div>
                )}
                {job.gradient_accumulation_steps != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Grad Accum Steps</span>
                    <span className="font-mono">{job.gradient_accumulation_steps}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Deployment Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleDeployServerless}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={deployingServerless || deployingProduction}
          >
            {deployingServerless ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Image src="/icons/runpod.png" alt="RunPod" width={14} height={14} />
                Deploy for Testing
              </>
            )}
          </Button>
          <Button
            onClick={handleDeployProduction}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={deployingServerless || deployingProduction}
          >
            {deployingProduction ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Image src="/icons/runpod.png" alt="RunPod" width={14} height={14} />
                Deploy to Production
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
