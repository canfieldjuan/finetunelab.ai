'use client';

import React from 'react';

export interface TrainingParams {
  num_epochs: number;
  batch_size: number;
  learning_rate: number;
  method: 'sft' | 'dpo' | 'rlhf' | 'orpo' | 'cpt';
  beta?: number;  // DPO/ORPO preference strength parameter
}

interface TrainingParamsProps {
  params: TrainingParams;
  onChange: (params: TrainingParams) => void;
  disabled?: boolean;
}

export function TrainingParamsComponent({ params, onChange, disabled }: TrainingParamsProps) {
  const handleEpochsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num_epochs = parseInt(e.target.value, 10);
    if (!isNaN(num_epochs) && num_epochs > 0) {
      onChange({ ...params, num_epochs });
    }
  };

  const handleBatchSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const batch_size = parseInt(e.target.value, 10);
    onChange({ ...params, batch_size });
  };

  const handleLearningRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const learning_rate = parseFloat(e.target.value);
    if (!isNaN(learning_rate) && learning_rate > 0) {
      onChange({ ...params, learning_rate });
    }
  };

  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...params, method: e.target.value as 'sft' | 'dpo' | 'rlhf' | 'orpo' | 'cpt' });
  };

  const showEpochWarning = params.num_epochs > 10;
  const showLRWarning = params.learning_rate > 0.001;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Training Parameters</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Training Method <span className="text-red-500">*</span>
          </label>
          <select
            value={params.method}
            onChange={handleMethodChange}
            disabled={disabled}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="sft">Supervised Fine-Tuning (SFT)</option>
            <option value="dpo">Direct Preference Optimization (DPO)</option>
            <option value="rlhf">Reinforcement Learning from Human Feedback (RLHF)</option>
            <option value="orpo">Odds Ratio Preference Optimization (ORPO)</option>
            <option value="cpt">Continued Pre-Training (CPT)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Choose method: SFT for instructions, DPO/ORPO/RLHF for preference learning, CPT for domain adaptation
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Number of Epochs <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={params.num_epochs}
            onChange={handleEpochsChange}
            disabled={disabled}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500">Recommended: 1-10</p>
          {showEpochWarning && (
            <p className="mt-1 text-xs text-amber-600 flex items-center">
              <span className="mr-1">&#9888;</span>
              High epoch count may lead to overfitting
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Batch Size <span className="text-red-500">*</span>
          </label>
          <select
            value={params.batch_size}
            onChange={handleBatchSizeChange}
            disabled={disabled}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="1">1 (Safest, slowest)</option>
            <option value="2">2</option>
            <option value="4">4 (Recommended)</option>
            <option value="8">8 (Requires more VRAM)</option>
            <option value="16">16 (High VRAM required)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            GPU: RTX 4060 Ti 16GB - Recommended: 4-8
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Learning Rate <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0.000001"
            max="0.01"
            step="0.000001"
            value={params.learning_rate}
            onChange={handleLearningRateChange}
            disabled={disabled}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500">
            Recommended: 0.00001 to 0.0005 (1e-5 to 5e-4)
          </p>
          {showLRWarning && (
            <p className="mt-1 text-xs text-amber-600 flex items-center">
              <span className="mr-1">&#9888;</span>
              High learning rate may cause training instability
            </p>
          )}
        </div>

        {/* DPO/ORPO Beta Parameter - only show for preference-based methods */}
        {(params.method === 'dpo' || params.method === 'orpo') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beta (Preference Strength)
            </label>
            <input
              type="number"
              min="0.01"
              max="1.0"
              step="0.01"
              value={params.beta ?? 0.1}
              onChange={(e) => {
                const beta = parseFloat(e.target.value);
                if (!isNaN(beta) && beta > 0) {
                  onChange({ ...params, beta });
                }
              }}
              disabled={disabled}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500">
              Controls preference learning strength (default: 0.1). Higher = stronger preference signal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
