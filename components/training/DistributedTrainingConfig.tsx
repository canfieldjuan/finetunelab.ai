'use client';

/**
 * Distributed Training Configuration Component
 *
 * UI for configuring multi-GPU training strategies (DDP, FSDP, DeepSpeed)
 * Phase 2: Advanced Training Features - UI Components
 * Date: 2025-11-02
 */

import React from 'react';
import type { DistributedConfig } from '@/lib/training/distributed-training.types';

interface DistributedTrainingConfigProps {
  value?: DistributedConfig;
  onChange: (config: DistributedConfig | undefined) => void;
}

console.log('[DistributedTrainingConfig] Module loaded');

type Strategy = 'none' | 'ddp' | 'fsdp' | 'deepspeed';

export function DistributedTrainingConfig({ value, onChange }: DistributedTrainingConfigProps) {
  const numGpus = value?.num_gpus || 1;
  const strategy = value?.strategy || 'none';

  console.log('[DistributedTrainingConfig] Rendering with:', { numGpus, strategy });

  const handleNumGpusChange = (newNumGpus: number) => {
    if (newNumGpus === 1) {
      // Single GPU - clear distributed config
      onChange(undefined);
    } else {
      // Multi-GPU - create or update config
      onChange({
        num_gpus: newNumGpus,
        strategy: strategy === 'none' ? 'ddp' : strategy, // Default to DDP for multi-GPU
      });
    }
  };

  const handleStrategyChange = (newStrategy: Strategy) => {
    if (numGpus === 1 && newStrategy !== 'none') {
      // Can't use distributed strategy with 1 GPU
      return;
    }

    if (newStrategy === 'none') {
      onChange(undefined);
    } else {
      onChange({
        num_gpus: numGpus,
        strategy: newStrategy,
      });
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-purple-50 border-b border-purple-200">
        <h3 className="text-lg font-semibold text-gray-900">Distributed Training</h3>
        <p className="text-sm text-gray-600 mt-1">
          Configure multi-GPU training strategies
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* GPU Count Selector */}
        <div className="space-y-2">
          <label htmlFor="num-gpus" className="block text-sm font-medium text-gray-700">
            Number of GPUs
          </label>
          <select
            id="num-gpus"
            value={numGpus}
            onChange={(e) => handleNumGpusChange(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="1">1 GPU (Single-GPU Training)</option>
            <option value="2">2 GPUs</option>
            <option value="4">4 GPUs</option>
            <option value="8">8 GPUs</option>
          </select>
          <p className="text-xs text-gray-500">
            {numGpus === 1
              ? 'Standard single-GPU training'
              : `Multi-GPU training across ${numGpus} devices`}
          </p>
        </div>

        {/* Strategy Selector - only show if multi-GPU */}
        {numGpus > 1 && (
          <div className="space-y-2">
            <label htmlFor="strategy" className="block text-sm font-medium text-gray-700">
              Training Strategy
            </label>
            <select
              id="strategy"
              value={strategy}
              onChange={(e) => handleStrategyChange(e.target.value as Strategy)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ddp">DDP (Distributed Data Parallel)</option>
              <option value="fsdp">FSDP (Fully Sharded Data Parallel)</option>
              <option value="deepspeed">DeepSpeed ZeRO</option>
            </select>

            {/* Strategy Descriptions */}
            <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-md">
              {strategy === 'ddp' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">DDP (Distributed Data Parallel)</p>
                  <p className="text-xs text-gray-600">
                    Best for: Models &lt;13B parameters<br />
                    • Replicates model on each GPU<br />
                    • Synchronizes gradients across GPUs<br />
                    • Simple and stable<br />
                    • Memory: Each GPU holds full model copy
                  </p>
                </div>
              )}

              {strategy === 'fsdp' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">FSDP (Fully Sharded Data Parallel)</p>
                  <p className="text-xs text-gray-600">
                    Best for: Models 13B-70B parameters<br />
                    • Shards model, optimizer, and gradients<br />
                    • Reduces memory per GPU<br />
                    • Better scaling than DDP<br />
                    • Memory: ~1/N of model per GPU (N = num_gpus)
                  </p>
                </div>
              )}

              {strategy === 'deepspeed' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">DeepSpeed ZeRO</p>
                  <p className="text-xs text-gray-600">
                    Best for: Models 70B+ parameters<br />
                    • Most aggressive memory optimization<br />
                    • ZeRO stages 1-3 for different sharding levels<br />
                    • Can offload to CPU/NVMe<br />
                    • Memory: Minimal per GPU with ZeRO-3
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Strategy Options - placeholder for future expansion */}
        {numGpus > 1 && strategy === 'fsdp' && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> FSDP advanced options (sharding strategy, CPU offload) will be available in a future update.
            </p>
          </div>
        )}

        {numGpus > 1 && strategy === 'deepspeed' && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> DeepSpeed advanced options (ZeRO stage, offloading) will be available in a future update.
            </p>
          </div>
        )}

        {/* Educational Warning */}
        {numGpus > 1 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-sm text-amber-800">
              <strong>⚠️ Multi-GPU Training Requirements:</strong>
            </p>
            <ul className="text-xs text-amber-700 mt-2 list-disc list-inside space-y-1">
              <li>Ensure you have {numGpus} GPUs available on your system</li>
              <li>All GPUs should have sufficient VRAM for your model</li>
              <li>Training will fail if requested GPUs are unavailable</li>
              <li>Effective batch size = batch_size × num_gpus × gradient_accumulation_steps</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
