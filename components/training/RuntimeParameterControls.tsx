'use client';

/**
 * Runtime Parameter Controls Component
 *
 * Allows modifying training parameters during active training
 * Phase 2: Advanced Training Features - UI Components
 * Date: 2025-11-02
 */

import React, { useState } from 'react';

interface RuntimeParameterControlsProps {
  jobId: string;
  currentLearningRate?: number;
  currentBatchSize?: number;
  currentGradAccumSteps?: number;
}

console.log('[RuntimeParameterControls] Module loaded');

export function RuntimeParameterControls({
  jobId,
  currentLearningRate,
  currentBatchSize,
  currentGradAccumSteps,
}: RuntimeParameterControlsProps) {
  const [learningRate, setLearningRate] = useState(currentLearningRate?.toString() || '');
  const [batchSize, setBatchSize] = useState(currentBatchSize?.toString() || '');
  const [gradAccumSteps, setGradAccumSteps] = useState(currentGradAccumSteps?.toString() || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  console.log('[RuntimeParameterControls] Rendering for job:', jobId);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Build update object with only changed values
      const updates: Record<string, number> = {};

      if (learningRate && parseFloat(learningRate) !== currentLearningRate) {
        updates.learning_rate = parseFloat(learningRate);
      }
      if (batchSize && parseInt(batchSize) !== currentBatchSize) {
        updates.batch_size = parseInt(batchSize);
      }
      if (gradAccumSteps && parseInt(gradAccumSteps) !== currentGradAccumSteps) {
        updates.gradient_accumulation_steps = parseInt(gradAccumSteps);
      }

      // Validate at least one parameter changed
      if (Object.keys(updates).length === 0) {
        setError('No parameters were changed');
        setLoading(false);
        return;
      }

      console.log('[RuntimeParameterControls] Submitting updates:', updates);

      // Get auth token
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase configuration missing');
      }

      const authData = localStorage.getItem('sb-' + supabaseUrl.split('//')[1].split('.')[0] + '-auth-token');
      if (!authData) {
        throw new Error('Not authenticated. Please log in.');
      }

      const { access_token } = JSON.parse(authData);

      const response = await fetch(`/api/training/local/${jobId}/update-params`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update parameters');
      }

      const result = await response.json();
      console.log('[RuntimeParameterControls] Update successful:', result);

      setSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      console.error('[RuntimeParameterControls] Update error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update parameters');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900">Runtime Parameter Controls</h3>
        <p className="text-sm text-gray-600 mt-1">
          Modify training parameters while the job is running
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Learning Rate */}
        <div className="space-y-2">
          <label htmlFor="learning-rate" className="block text-sm font-medium text-gray-700">
            Learning Rate
          </label>
          <input
            id="learning-rate"
            type="number"
            step="0.000001"
            value={learningRate}
            onChange={(e) => setLearningRate(e.target.value)}
            placeholder={currentLearningRate?.toString() || '0.0001'}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {currentLearningRate && (
            <p className="text-xs text-gray-500">Current: {currentLearningRate}</p>
          )}
        </div>

        {/* Batch Size */}
        <div className="space-y-2">
          <label htmlFor="batch-size" className="block text-sm font-medium text-gray-700">
            Batch Size
          </label>
          <input
            id="batch-size"
            type="number"
            step="1"
            value={batchSize}
            onChange={(e) => setBatchSize(e.target.value)}
            placeholder={currentBatchSize?.toString() || '8'}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {currentBatchSize && (
            <p className="text-xs text-gray-500">Current: {currentBatchSize}</p>
          )}
          <p className="text-xs text-amber-600">⚠️ Changing batch size may affect training stability</p>
        </div>

        {/* Gradient Accumulation Steps */}
        <div className="space-y-2">
          <label htmlFor="grad-accum-steps" className="block text-sm font-medium text-gray-700">
            Gradient Accumulation Steps
          </label>
          <input
            id="grad-accum-steps"
            type="number"
            step="1"
            value={gradAccumSteps}
            onChange={(e) => setGradAccumSteps(e.target.value)}
            placeholder={currentGradAccumSteps?.toString() || '4'}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {currentGradAccumSteps && (
            <p className="text-xs text-gray-500">Current: {currentGradAccumSteps}</p>
          )}
        </div>

        {/* Success Message */}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700">✓ Parameters updated successfully</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
            loading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading ? 'Applying Changes...' : 'Apply Parameter Changes'}
        </button>

        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-xs text-gray-600">
            <strong>Note:</strong> Parameter updates are recorded immediately but may take effect on the next training step.
            Backend support for live parameter updates is pending.
          </p>
        </div>
      </div>
    </div>
  );
}
