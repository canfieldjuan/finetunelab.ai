'use client';

import React from 'react';
import type { TrainingConfig, ValidationResult } from '@/lib/training/validation';

interface PreSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  config: TrainingConfig;
  validation: ValidationResult;
  isSubmitting?: boolean;
}

export function PreSubmitModal({
  isOpen,
  onClose,
  onConfirm,
  config,
  validation,
  isSubmitting = false,
}: PreSubmitModalProps) {
  if (!isOpen) return null;

  const { errors, warnings } = validation;
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  const estimateTrainingTime = () => {
    if (!config.training || !config.dataset) return null;
    
    const samplesPerSecond = 12;
    const stepsPerEpoch = Math.ceil(config.dataset.length / config.training.batch_size);
    const totalSteps = stepsPerEpoch * config.training.num_epochs;
    const estimatedSeconds = totalSteps / samplesPerSecond * config.training.batch_size;
    
    const minutes = Math.floor(estimatedSeconds / 60);
    const seconds = Math.floor(estimatedSeconds % 60);
    
    if (minutes > 0) {
      return `~${minutes}m ${seconds}s`;
    }
    return `~${seconds}s`;
  };

  const needsDownload = config.model && !config.model.isCached;
  const estimatedTime = estimateTrainingTime();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Ready to Start Training?</h2>
            <p className="mt-1 text-sm text-gray-600">
              Review your configuration before submitting
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4">
            {/* Configuration Summary */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Configuration Summary</h3>
              <div className="bg-gray-50 rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 w-1/3">Model</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {config.model?.displayName || 'Not selected'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Dataset</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {config.dataset?.length || 0} examples ({config.data?.strategy || 'standard'} format)
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Training Method</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {config.training?.method?.toUpperCase() || 'SFT'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Epochs</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {config.training?.num_epochs || 0}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Batch Size</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {config.training?.batch_size || 0}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Learning Rate</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {config.training?.learning_rate?.toExponential(2) || '0'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">LoRA Rank</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        r={config.lora?.r || 0}, alpha={config.lora?.alpha || 0}
                      </td>
                    </tr>
                    {estimatedTime && (
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">Estimated Time</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {estimatedTime}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Validation Results */}
            {hasErrors && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <h4 className="text-sm font-semibold text-red-900 flex items-center mb-2">
                  <span className="mr-2 text-lg">&#10060;</span>
                  Errors ({errors.length})
                </h4>
                <ul className="space-y-1">
                  {errors.map((error, idx) => (
                    <li key={idx} className="text-sm text-red-800 ml-6">
                      &bull; {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasWarnings && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                <h4 className="text-sm font-semibold text-amber-900 flex items-center mb-2">
                  <span className="mr-2 text-lg">&#9888;</span>
                  Warnings ({warnings.length})
                </h4>
                <ul className="space-y-1">
                  {warnings.map((warning, idx) => (
                    <li key={idx} className="text-sm text-amber-800 ml-6">
                      &bull; {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!hasErrors && !hasWarnings && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center text-sm text-green-800">
                  <span className="mr-2 text-lg">&#9989;</span>
                  <span className="font-medium">All validations passed</span>
                </div>
              </div>
            )}

            {/* Download Warning */}
            {needsDownload && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="text-sm font-semibold text-blue-900 flex items-center mb-2">
                  <span className="mr-2 text-lg">&#8505;</span>
                  Model Download Required
                </h4>
                <p className="text-sm text-blue-800">
                  This model is not cached. The first training run will download{' '}
                  <strong>{config.model?.sizeGB} GB</strong>. This may take several minutes
                  depending on your internet connection.
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  Training will start automatically after the download completes.
                </p>
              </div>
            )}

            {/* RLHF-Specific Requirements */}
            {config.training?.method === 'rlhf' && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-md">
                <h4 className="text-sm font-semibold text-orange-900 flex items-center mb-2">
                  <span className="mr-2 text-lg">&#9888;</span>
                  RLHF Training Requirements
                </h4>
                <ul className="space-y-1 text-sm text-orange-800">
                  <li className="ml-6">&bull; Dataset must have <code className="px-1 bg-orange-100 rounded">prompt</code> and <code className="px-1 bg-orange-100 rounded">response</code> fields</li>
                  <li className="ml-6">&bull; Reward model will be loaded (~2x memory usage)</li>
                  <li className="ml-6">&bull; PPO training is slower than SFT/DPO</li>
                  <li className="ml-6">&bull; LoRA is strongly recommended to reduce memory</li>
                </ul>
                <p className="text-xs text-orange-700 mt-2">
                  RLHF uses Proximal Policy Optimization (PPO) for advanced model alignment.
                </p>
              </div>
            )}

            {/* ORPO-Specific Information */}
            {config.training?.method === 'orpo' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="text-sm font-semibold text-blue-900 flex items-center mb-2">
                  <span className="mr-2 text-lg">&#8505;</span>
                  ORPO Training Information
                </h4>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li className="ml-6">&bull; Dataset must have <code className="px-1 bg-blue-100 rounded">prompt</code>, <code className="px-1 bg-blue-100 rounded">chosen</code>, and <code className="px-1 bg-blue-100 rounded">rejected</code> fields (same as DPO)</li>
                  <li className="ml-6">&bull; No reference model needed (more efficient than DPO)</li>
                  <li className="ml-6">&bull; Combines SFT + preference alignment in one step</li>
                  <li className="ml-6">&bull; LoRA recommended for memory efficiency</li>
                </ul>
                <p className="text-xs text-blue-700 mt-2">
                  ORPO (Odds Ratio Preference Optimization) is reference-model-free, reducing memory and compute requirements.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={hasErrors || isSubmitting}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                hasErrors || isSubmitting
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Starting...
                </span>
              ) : (
                'Confirm & Start Training'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
