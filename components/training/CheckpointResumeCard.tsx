'use client';

/**
 * Checkpoint Resume Card Component
 *
 * Displays UI for resuming failed/cancelled training jobs from checkpoints
 * Phase 2: Advanced Training Features - UI Components
 * Date: 2025-11-02
 */

import React, { useState, useEffect } from 'react';

interface CheckpointInfo {
  path: string;
  epoch: number;
  step: number;
  eval_loss: number | null;
  is_best: boolean;
}

interface ConfigSuggestion {
  field: string;
  current_value: unknown;
  suggested_value: unknown;
  reason: string;
  impact: string;
}

interface FailureAnalysis {
  job_id: string;
  error_type: string;
  error_phase: string;
  description: string;
  confidence: string;
  suggestions: ConfigSuggestion[];
}

interface CheckpointResumeCardProps {
  jobId: string;
  jobStatus: 'failed' | 'cancelled' | 'pending';
  jobStartedAt?: string;  // Job start timestamp to determine if checkpoints likely exist
  onResumeSuccess?: (newJobId: string) => void;
}

console.log('[CheckpointResumeCard] Module loaded');

export function CheckpointResumeCard({ jobId, jobStatus, jobStartedAt, onResumeSuccess }: CheckpointResumeCardProps) {
  const [checkpoints, setCheckpoints] = useState<CheckpointInfo[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(null);
  const [resumeFromBest, setResumeFromBest] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Failure analysis state (Phase 4: Intelligent Resume)
  const [failureAnalysis, setFailureAnalysis] = useState<FailureAnalysis | null>(null);
  const [resumeMode, setResumeMode] = useState<'adjust' | 'original'>('adjust');
  const [configAdjustments, setConfigAdjustments] = useState<Record<string, unknown>>({});
  const [fetchingAnalysis, setFetchingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [jobConfig, setJobConfig] = useState<Record<string, unknown> | null>(null);  // Store job config for manual editing

  console.log('[CheckpointResumeCard] Rendering for job:', jobId, 'Status:', jobStatus);

  // Fetch available checkpoints from backend
  useEffect(() => {
    const fetchCheckpoints = async () => {
      // OPTIMIZATION: Don't fetch checkpoints if job failed too quickly (< 30 seconds)
      // Training needs time to initialize, save first checkpoint, etc.
      if (jobStartedAt) {
        const jobStartTime = new Date(jobStartedAt).getTime();
        const now = Date.now();
        const elapsedSeconds = (now - jobStartTime) / 1000;
        
        if (elapsedSeconds < 30) {
          console.log(`[CheckpointResumeCard] Skipping checkpoint fetch - job only ran ${elapsedSeconds.toFixed(1)}s (< 30s)`);
          setCheckpoints([]);
          setFetching(false);
          return;
        }
      }

      setFetching(true);
      setError(null);

      try {
        const backendUrl = process.env.NEXT_PUBLIC_TRAINING_BACKEND_URL || 'http://localhost:8000';
        const response = await fetch(`${backendUrl}/api/training/checkpoints/${jobId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch checkpoints: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[CheckpointResumeCard] Checkpoints fetched:', data);

        // Transform backend data to CheckpointInfo array
        const checkpointList: CheckpointInfo[] = data.checkpoints || [];
        setCheckpoints(checkpointList);

        // Auto-select best checkpoint if available
        const bestCheckpoint = checkpointList.find(cp => cp.is_best);
        if (bestCheckpoint && resumeFromBest) {
          setSelectedCheckpoint(bestCheckpoint.path);
        }

      } catch (err) {
        console.error('[CheckpointResumeCard] Error fetching checkpoints:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch checkpoints');
      } finally {
        setFetching(false);
      }
    };

    fetchCheckpoints();
  }, [jobId, resumeFromBest, jobStartedAt]);

  // Fetch failure analysis for intelligent config suggestions (Phase 4: Intelligent Resume)
  useEffect(() => {
    const fetchAnalysis = async () => {
      // Only fetch analysis for failed jobs in adjust mode
      if (jobStatus !== 'failed' || resumeMode !== 'adjust') {
        return;
      }

      setFetchingAnalysis(true);
      setAnalysisError(null);

      try {
        // Get auth token from localStorage
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!supabaseUrl) {
          throw new Error('Supabase configuration missing');
        }

        const authData = localStorage.getItem('sb-' + supabaseUrl.split('//')[1].split('.')[0] + '-auth-token');
        if (!authData) {
          throw new Error('Not authenticated');
        }

        const { access_token } = JSON.parse(authData);

        console.log('[CheckpointResumeCard] Fetching failure analysis for job:', jobId);

        const response = await fetch(`/api/training/local/${jobId}/analyze-failure`, {
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
        });

        if (!response.ok) {
          // Try to get error details from response
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || response.statusText;
          const errorDetails = errorData.details || '';
          const stderr = errorData.stderr || '';

          console.error('[CheckpointResumeCard] API error:', {
            status: response.status,
            error: errorMessage,
            details: errorDetails,
            stderr
          });

          throw new Error(`Failed to fetch analysis: ${errorMessage}${errorDetails ? ` - ${errorDetails}` : ''}${stderr ? `\n\nPython error:\n${stderr}` : ''}`);
        }

        const data = await response.json();
        console.log('[CheckpointResumeCard] Analysis fetched:', data);

        setFailureAnalysis(data.analysis);
        setJobConfig(data.job_config || null);  // Store job config for manual editing

        // Pre-fill config adjustments with suggestions
        if (data.analysis && data.analysis.suggestions && data.analysis.suggestions.length > 0) {
          const initialAdjustments: Record<string, unknown> = {};
          data.analysis.suggestions.forEach((suggestion: ConfigSuggestion) => {
            initialAdjustments[suggestion.field] = suggestion.suggested_value;
          });
          setConfigAdjustments(initialAdjustments);
          console.log('[CheckpointResumeCard] Pre-filled adjustments:', initialAdjustments);
        } else {
          console.log('[CheckpointResumeCard] No suggestions available, analysis:', data.analysis);
        }

      } catch (err) {
        console.error('[CheckpointResumeCard] Error fetching analysis:', err);
        setAnalysisError(err instanceof Error ? err.message : 'Failed to analyze failure');
      } finally {
        setFetchingAnalysis(false);
      }
    };

    fetchAnalysis();
  }, [jobId, jobStatus, resumeMode]);

  // Handle resume button click
  const handleResume = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Get auth token from Supabase
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing');
      }

      // Get session token from localStorage (Supabase stores it there)
      const authData = localStorage.getItem('sb-' + supabaseUrl.split('//')[1].split('.')[0] + '-auth-token');
      if (!authData) {
        throw new Error('Not authenticated. Please log in.');
      }

      const { access_token } = JSON.parse(authData);

      // Build resume request payload
      const resumePayload: Record<string, unknown> = {
        checkpoint_path: resumeFromBest ? undefined : selectedCheckpoint,
        resume_from_best: resumeFromBest,
      };

      // Add config adjustments if in adjust mode (Phase 4: Intelligent Resume)
      if (resumeMode === 'adjust' && Object.keys(configAdjustments).length > 0) {
        resumePayload.config_adjustments = configAdjustments;
        console.log('[CheckpointResumeCard] Including config adjustments:', configAdjustments);
      }

      console.log('[CheckpointResumeCard] Submitting resume request');

      const response = await fetch(`/api/training/local/${jobId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`,
        },
        body: JSON.stringify(resumePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resume training');
      }

      const result = await response.json();
      console.log('[CheckpointResumeCard] Resume successful:', result);

      setSuccess(true);

      // Call success callback with new job ID
      if (onResumeSuccess && result.job_id) {
        setTimeout(() => {
          onResumeSuccess(result.job_id);
        }, 1500); // Delay to show success message
      }

    } catch (err) {
      console.error('[CheckpointResumeCard] Resume error:', err);
      setError(err instanceof Error ? err.message : 'Failed to resume training');
    } finally {
      setLoading(false);
    }
  };

  // Render loading state
  if (fetching) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-medium">Loading Checkpoints...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && checkpoints.length === 0) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-center text-red-700">
          <p className="font-medium">Error Loading Checkpoints</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // Render no checkpoints state
  if (checkpoints.length === 0) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-medium">No Checkpoints Available</p>
          <p className="text-sm mt-1">This job did not save any checkpoints before {jobStatus === 'failed' ? 'failing' : jobStatus === 'pending' ? 'being started' : 'being cancelled'}.</p>
        </div>
      </div>
    );
  }

  // Render success state
  if (success) {
    return (
      <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
        <div className="text-center text-green-700">
          <p className="font-medium">✓ Training Resumed Successfully</p>
          <p className="text-sm mt-1">Redirecting to new job...</p>
        </div>
      </div>
    );
  }

  const bestCheckpoint = checkpoints.find(cp => cp.is_best);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
        <h3 className="text-lg font-semibold text-gray-900">{jobStatus === 'pending' ? 'Start Training' : 'Resume Training'}</h3>
        <p className="text-sm text-gray-600 mt-1">
          {jobStatus === 'failed' ? 'This job failed. You can resume from a checkpoint.' :
           jobStatus === 'pending' ? 'This job is pending. You can start it from a checkpoint.' :
           'This job was cancelled. You can resume from a checkpoint.'}
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Checkpoint Selection Mode */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Checkpoint Selection</label>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="checkpoint-mode"
                checked={resumeFromBest}
                onChange={() => setResumeFromBest(true)}
                className="mr-2"
              />
              <span className="text-sm">Resume from Best Checkpoint</span>
            </label>

            <label className="flex items-center">
              <input
                type="radio"
                name="checkpoint-mode"
                checked={!resumeFromBest}
                onChange={() => setResumeFromBest(false)}
                className="mr-2"
              />
              <span className="text-sm">Select Manual Checkpoint</span>
            </label>
          </div>
        </div>

        {/* Best Checkpoint Info */}
        {resumeFromBest && bestCheckpoint && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-green-900">Best Checkpoint</p>
                <p className="text-xs text-green-700 mt-1">{bestCheckpoint.path}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-700">Epoch {bestCheckpoint.epoch}</p>
                <p className="text-xs text-green-600">Step {bestCheckpoint.step}</p>
              </div>
            </div>
            {bestCheckpoint.eval_loss !== null && (
              <p className="text-xs text-green-600 mt-2">
                Eval Loss: {bestCheckpoint.eval_loss.toFixed(4)}
              </p>
            )}
          </div>
        )}

        {/* Manual Checkpoint Selector */}
        {!resumeFromBest && (
          <div className="space-y-2">
            <label htmlFor="checkpoint-select" className="block text-sm font-medium text-gray-700">
              Select Checkpoint
            </label>
            <select
              id="checkpoint-select"
              value={selectedCheckpoint || ''}
              onChange={(e) => setSelectedCheckpoint(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select a checkpoint --</option>
              {checkpoints.map((cp) => (
                <option key={cp.path} value={cp.path}>
                  {cp.path} (Epoch {cp.epoch}, Step {cp.step}
                  {cp.eval_loss !== null ? `, Loss: ${cp.eval_loss.toFixed(4)}` : ''})
                  {cp.is_best ? ' ★ BEST' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Resume Strategy Selector (Phase 4: Intelligent Resume) */}
        {jobStatus === 'failed' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Resume Strategy</label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="resume-mode"
                  checked={resumeMode === 'adjust'}
                  onChange={() => setResumeMode('adjust')}
                  className="mr-2"
                />
                <span className="text-sm">Adjust Config (recommended)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="resume-mode"
                  checked={resumeMode === 'original'}
                  onChange={() => setResumeMode('original')}
                  className="mr-2"
                />
                <span className="text-sm text-amber-600">Use Original Config (risky)</span>
              </label>
            </div>
          </div>
        )}

        {/* Failure Analysis Loading State */}
        {resumeMode === 'adjust' && fetchingAnalysis && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-sm text-gray-600">Analyzing failure...</p>
          </div>
        )}

        {/* Failure Analysis Error State */}
        {resumeMode === 'adjust' && analysisError && !failureAnalysis && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-sm text-amber-700">
              Could not analyze failure: {analysisError}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              You can still resume with original config or manually adjust parameters.
            </p>
          </div>
        )}

        {/* Config Adjustment Editor (Option A: Always show manual editor) */}
        {resumeMode === 'adjust' && jobConfig && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md space-y-3">
            {/* Intelligent Analysis Info (if available) */}
            {failureAnalysis && failureAnalysis.suggestions.length > 0 && (
              <div className="flex items-start mb-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h4 className="text-sm font-medium text-blue-900">
                    {failureAnalysis.description}
                  </h4>
                  <p className="text-xs text-blue-700 mt-1">
                    Detected: {failureAnalysis.error_type.replace(/_/g, ' ')} during {failureAnalysis.error_phase}
                  </p>
                  <p className="text-xs text-blue-600 mt-1 italic">
                    Pre-filled with intelligent suggestions below (you can modify any value)
                  </p>
                </div>
              </div>
            )}

            {/* Manual Config Editor - Always shown */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-blue-900">Training Configuration</p>
                <p className="text-xs text-gray-600">Adjust values to prevent failure</p>
              </div>

              {/* Helper function to get current value */}
              {(() => {
                const trainingConfig = (jobConfig?.training || {}) as Record<string, unknown>;
                const getSuggestion = (field: string) => failureAnalysis?.suggestions.find(s => s.field === field);

                // Map between displayed field names and stored field names
                const getFieldValue = (displayField: string, configField: string) => {
                  // Priority 1: User edited value (highest priority)
                  if (configAdjustments[displayField] !== undefined) {
                    return configAdjustments[displayField];
                  }

                  // Priority 2: Intelligent suggestion (if available)
                  const suggestion = getSuggestion(displayField);
                  if (suggestion) {
                    return suggestion.suggested_value;
                  }

                  // Priority 3: Current config value (fallback)
                  return trainingConfig[configField] || '';
                };

                const commonFields = [
                  { display: 'per_device_train_batch_size', config: 'batch_size', label: 'Training Batch Size', type: 'number' as const },
                  { display: 'per_device_eval_batch_size', config: 'eval_batch_size', label: 'Evaluation Batch Size', type: 'number' as const },
                  { display: 'gradient_accumulation_steps', config: 'gradient_accumulation_steps', label: 'Gradient Accumulation Steps', type: 'number' as const },
                  { display: 'learning_rate', config: 'learning_rate', label: 'Learning Rate', type: 'number' as const, step: 0.00001 },
                  { display: 'gradient_checkpointing', config: 'gradient_checkpointing', label: 'Gradient Checkpointing', type: 'boolean' as const },
                ];

                return commonFields.map((field) => {
                  const suggestion = getSuggestion(field.display);
                  const currentValue = getFieldValue(field.display, field.config);

                  return (
                    <div key={field.display} className="bg-white p-3 rounded border border-blue-200">
                      <div className="flex justify-between items-start mb-2">
                        <label className="text-sm font-medium text-gray-900">
                          {field.label}
                        </label>
                        {suggestion && (
                          <span className="text-xs text-green-600 font-medium">
                            {suggestion.impact}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <div>
                          <span className="text-xs text-gray-600">Current:</span>
                          <div className="mt-1 px-2 py-1 bg-gray-100 rounded text-sm font-mono text-gray-900">
                            {String(trainingConfig[field.config] || 'not set')}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-600">New Value:</span>
                          {field.type === 'boolean' ? (
                            <select
                              value={String(currentValue)}
                              onChange={(e) => {
                                setConfigAdjustments(prev => ({
                                  ...prev,
                                  [field.display]: e.target.value === 'true'
                                }));
                              }}
                              className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                          ) : (
                            <input
                              type="number"
                              step={field.step || 1}
                              value={String(currentValue)}
                              onChange={(e) => {
                                const value = field.display === 'learning_rate'
                                  ? parseFloat(e.target.value)
                                  : parseInt(e.target.value) || 0;
                                setConfigAdjustments(prev => ({
                                  ...prev,
                                  [field.display]: value
                                }));
                              }}
                              className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          )}
                        </div>
                      </div>

                      {suggestion && (
                        <p className="text-xs text-gray-600 italic">
                          {suggestion.reason}
                        </p>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Resume Button */}
        <button
          onClick={handleResume}
          disabled={loading || (!resumeFromBest && !selectedCheckpoint)}
          className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
            loading || (!resumeFromBest && !selectedCheckpoint)
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading
            ? (jobStatus === 'pending' ? 'Starting Training...' : 'Resuming Training...')
            : (jobStatus === 'pending' ? 'Start Training' : 'Resume Training')}
        </button>
      </div>
    </div>
  );
}
