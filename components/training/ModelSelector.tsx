'use client';

import React from 'react';

export interface ModelInfo {
  id: string;
  name: string;
  displayName: string;
  family: 'gpt2' | 'llama' | 'phi' | 'mistral' | 'other';
  sizeGB: number;
  isCached: boolean;
  supportsChatTemplate: boolean;
  loraTargets: string[];
  description: string;
}

export const KNOWN_MODELS: ModelInfo[] = [
  {
    id: 'gpt2',
    name: 'gpt2',
    displayName: 'GPT-2 (124M)',
    family: 'gpt2',
    sizeGB: 0.5,
    isCached: true,
    supportsChatTemplate: false,
    loraTargets: ['c_attn', 'c_proj'],
    description: 'Small, fast model for testing. No chat template support.',
  },
  {
    id: 'microsoft/phi-2',
    name: 'microsoft/phi-2',
    displayName: 'Phi-2 (2.7B)',
    family: 'phi',
    sizeGB: 2.94,
    isCached: false,
    supportsChatTemplate: true,
    loraTargets: ['q_proj', 'v_proj', 'k_proj', 'dense'],
    description: 'Efficient 2.7B model with strong reasoning. Supports chat.',
  },
  {
    id: 'meta-llama/Llama-2-7b-hf',
    name: 'meta-llama/Llama-2-7b-hf',
    displayName: 'Llama 2 7B',
    family: 'llama',
    sizeGB: 13.5,
    isCached: false,
    supportsChatTemplate: true,
    loraTargets: ['q_proj', 'v_proj', 'k_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
    description: 'Popular 7B model with excellent performance. Supports chat.',
  },
];

interface ModelSelectorProps {
  selectedModel?: string;
  onChange: (modelInfo: ModelInfo | null) => void;
  disabled?: boolean;
}

export function ModelSelector({ selectedModel, onChange, disabled }: ModelSelectorProps) {
  const selectedModelInfo = KNOWN_MODELS.find((m) => m.id === selectedModel);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = e.target.value;
    if (!modelId) {
      onChange(null);
      return;
    }

    const modelInfo = KNOWN_MODELS.find((m) => m.id === modelId);
    if (modelInfo) {
      onChange(modelInfo);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Model <span className="text-red-500">*</span>
      </label>

      <select
        value={selectedModel || ''}
        onChange={handleModelChange}
        disabled={disabled}
        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="">Select a model...</option>
        {KNOWN_MODELS.map((model) => (
          <option key={model.id} value={model.id}>
            {model.displayName} {model.isCached ? '\u2713' : '\u2B07'}
          </option>
        ))}
      </select>

      {selectedModelInfo && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{selectedModelInfo.displayName}</h4>
            <p className="text-sm text-gray-600 mt-1">{selectedModelInfo.description}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Size:</span>{' '}
              <span className="font-medium">{selectedModelInfo.sizeGB} GB</span>
            </div>
            <div>
              <span className="text-gray-500">Chat:</span>{' '}
              <span className="font-medium">
                {selectedModelInfo.supportsChatTemplate ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>{' '}
              <span className="font-medium">
                {selectedModelInfo.isCached ? 'Cached' : 'Not cached'}
              </span>
            </div>
          </div>

          {!selectedModelInfo.isCached && (
            <div className="flex items-start space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <span className="text-amber-600 text-lg" aria-label="Warning">&#9888;</span>
              <div className="flex-1">
                <p className="text-sm text-amber-800">
                  This model is not cached. First run will download {selectedModelInfo.sizeGB} GB.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">LoRA Target Modules:</div>
            <div className="flex flex-wrap gap-2">
              {selectedModelInfo.loraTargets.map((target) => (
                <span
                  key={target}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {target}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
