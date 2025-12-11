'use client';

import React from 'react';
import type { ModelInfo } from './ModelSelector';

export interface LoRAConfig {
  r: number;
  alpha: number;
  dropout: number;
  target_modules: string[];
}

interface LoRAConfigProps {
  config: LoRAConfig;
  onChange: (config: LoRAConfig) => void;
  selectedModel?: ModelInfo;
  disabled?: boolean;
}

export function LoRAConfigComponent({ config, onChange, selectedModel, disabled }: LoRAConfigProps) {
  const handleRankChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const r = parseInt(e.target.value, 10);
    if (!isNaN(r) && r > 0) {
      onChange({ ...config, r });
    }
  };

  const handleAlphaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const alpha = parseInt(e.target.value, 10);
    if (!isNaN(alpha) && alpha > 0) {
      onChange({ ...config, alpha });
    }
  };

  const handleDropoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dropout = parseFloat(e.target.value);
    if (!isNaN(dropout) && dropout >= 0 && dropout <= 1) {
      onChange({ ...config, dropout });
    }
  };

  const showRankWarning = config.r > 64;
  const suggestedAlpha = config.r * 2;
  const showAlphaHint = config.alpha !== suggestedAlpha;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">LoRA Configuration</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rank (r) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            max="256"
            value={config.r}
            onChange={handleRankChange}
            disabled={disabled}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500">Recommended: 8-64</p>
          {showRankWarning && (
            <p className="mt-1 text-xs text-amber-600 flex items-center">
              <span className="mr-1">&#9888;</span>
              High rank value may increase training time and memory usage
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alpha <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            max="512"
            value={config.alpha}
            onChange={handleAlphaChange}
            disabled={disabled}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500">
            Typically 2x rank {showAlphaHint && `(recommended: ${suggestedAlpha})`}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dropout
          </label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={config.dropout}
            onChange={handleDropoutChange}
            disabled={disabled}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500">0.0-0.2 recommended</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Modules
          </label>
          <div className="flex flex-wrap gap-2">
            {config.target_modules.map((module) => (
              <span
                key={module}
                className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-gray-100 text-gray-700 border border-gray-300"
              >
                {module}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Auto-populated based on model architecture. Cannot be edited.
          </p>
          {!selectedModel && (
            <p className="mt-1 text-xs text-amber-600 flex items-center">
              <span className="mr-1">&#9888;</span>
              Select a model to see target modules
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
