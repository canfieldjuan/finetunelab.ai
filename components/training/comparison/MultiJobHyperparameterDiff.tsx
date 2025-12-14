/**
 * MultiJobHyperparameterDiff Component
 * Shows hyperparameter differences between selected training jobs
 * Date: 2025-12-12
 */

'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import type { TrainingJob } from '@/lib/hooks/useTrainingJobsRealtime';

interface MultiJobHyperparameterDiffProps {
  jobs: TrainingJob[];
  jobColors: Record<string, string>;
}

// Key hyperparameters to compare
const HYPERPARAMETERS = [
  { key: 'learning_rate', label: 'Learning Rate', format: 'scientific' },
  { key: 'batch_size', label: 'Batch Size', format: 'number' },
  { key: 'gradient_accumulation_steps', label: 'Grad Accum Steps', format: 'number' },
  { key: 'total_epochs', label: 'Total Epochs', format: 'number' },
  { key: 'warmup_steps', label: 'Warmup Steps', format: 'number' },
  { key: 'max_learning_rate', label: 'Max LR', format: 'scientific' },
  { key: 'min_learning_rate', label: 'Min LR', format: 'scientific' },
  { key: 'num_gpus', label: 'GPUs', format: 'number' },
] as const;

// Config keys to extract (if available in config JSON)
const CONFIG_KEYS = [
  { key: 'weight_decay', label: 'Weight Decay', format: 'decimal' },
  { key: 'lr_scheduler_type', label: 'LR Scheduler', format: 'string' },
  { key: 'optimizer', label: 'Optimizer', format: 'string' },
  { key: 'max_seq_length', label: 'Max Seq Length', format: 'number' },
  { key: 'lora_r', label: 'LoRA Rank', format: 'number' },
  { key: 'lora_alpha', label: 'LoRA Alpha', format: 'number' },
  { key: 'lora_dropout', label: 'LoRA Dropout', format: 'decimal' },
] as const;

type FormatType = 'scientific' | 'number' | 'decimal' | 'string';

function formatValue(value: unknown, format: FormatType): string {
  if (value === null || value === undefined) return '-';

  switch (format) {
    case 'scientific':
      return typeof value === 'number' ? value.toExponential(2) : String(value);
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    case 'decimal':
      return typeof value === 'number' ? value.toFixed(4) : String(value);
    case 'string':
      return String(value);
    default:
      return String(value);
  }
}

function getValueFromJob(job: TrainingJob, key: string): unknown {
  // First check direct fields
  if (key in job) {
    return job[key];
  }
  // Then check config
  if (job.config && typeof job.config === 'object' && key in job.config) {
    return job.config[key];
  }
  return null;
}

export function MultiJobHyperparameterDiff({
  jobs,
  jobColors,
}: MultiJobHyperparameterDiffProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract all hyperparameter values for comparison
  const parameterData = useMemo(() => {
    const allParams = [...HYPERPARAMETERS, ...CONFIG_KEYS];

    return allParams.map(param => {
      const values = jobs.map(job => getValueFromJob(job, param.key));

      // Check if values differ
      const uniqueValues = new Set(values.map(v => JSON.stringify(v)));
      const hasDifference = uniqueValues.size > 1;

      // Check if any job has this parameter
      const hasAnyValue = values.some(v => v !== null && v !== undefined);

      return {
        ...param,
        values,
        hasDifference,
        hasAnyValue,
      };
    }).filter(p => p.hasAnyValue); // Only show params that exist
  }, [jobs]);

  // Count differences
  const differenceCount = parameterData.filter(p => p.hasDifference).length;

  // Split into different and same
  const differentParams = parameterData.filter(p => p.hasDifference);
  const sameParams = parameterData.filter(p => !p.hasDifference);

  if (jobs.length === 0) {
    return (
      <div className="p-6 bg-muted/30 rounded-lg border border-dashed text-center">
        <p className="text-muted-foreground">Select jobs to compare hyperparameters</p>
      </div>
    );
  }

  if (jobs.length === 1) {
    return (
      <div className="p-6 bg-muted/30 rounded-lg border border-dashed text-center">
        <p className="text-muted-foreground">Select multiple jobs to see differences</p>
      </div>
    );
  }

  // Helper to get model short name
  const getShortName = (job: TrainingJob, index: number): string => {
    if (job.model_name) {
      const parts = job.model_name.split('/');
      return parts[parts.length - 1].substring(0, 12);
    }
    return `Run ${index + 1}`;
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      <div
        className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Hyperparameter Comparison</h3>
          {differenceCount > 0 && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs rounded-full flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {differenceCount} difference{differenceCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {isExpanded && (
        <div className="p-4">
          {/* Differences Section */}
          {differentParams.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2 uppercase tracking-wide">
                Different Values
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-semibold">Parameter</th>
                      {jobs.map((job, i) => (
                        <th key={job.id} className="text-center p-2 font-semibold">
                          <div className="flex items-center justify-center gap-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: jobColors[job.id] }}
                            />
                            <span className="truncate max-w-[80px]" title={job.model_name || ''}>
                              {getShortName(job, i)}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {differentParams.map(param => (
                      <tr key={param.key} className="border-b border-border bg-orange-50/50 dark:bg-orange-900/10">
                        <td className="p-2 font-medium">{param.label}</td>
                        {param.values.map((value, i) => (
                          <td key={i} className="p-2 text-center font-mono">
                            {formatValue(value, param.format)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Same Values Section */}
          {sameParams.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Same Values
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-semibold">Parameter</th>
                      <th className="text-center p-2 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sameParams.map(param => (
                      <tr key={param.key} className="border-b border-border">
                        <td className="p-2 font-medium">{param.label}</td>
                        <td className="p-2 text-center font-mono">
                          {formatValue(param.values[0], param.format)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {parameterData.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hyperparameter data available for selected jobs
            </p>
          )}
        </div>
      )}
    </div>
  );
}
