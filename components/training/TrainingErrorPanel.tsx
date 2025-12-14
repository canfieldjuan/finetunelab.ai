'use client';

/**
 * Training Error Panel Component
 *
 * Displays training failure errors and intelligent analysis
 * Shows raw error message and actionable suggestions
 * Date: 2025-12-12
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Lightbulb, RefreshCw } from 'lucide-react';

interface ConfigSuggestion {
  field: string;
  current_value: unknown;
  suggested_value: unknown;
  reason: string;
  impact: string;
}

interface FailureAnalysis {
  error_type: string;
  error_phase: string;
  description: string;
  confidence: string;
  suggestions: ConfigSuggestion[];
}

interface TrainingErrorPanelProps {
  jobId: string;
  errorMessage?: string;
  jobStatus: 'failed' | 'cancelled';
}

export function TrainingErrorPanel({ jobId, errorMessage, jobStatus }: TrainingErrorPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [analysis, setAnalysis] = useState<FailureAnalysis | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Fetch failure analysis
  useEffect(() => {
    const fetchAnalysis = async () => {
      if (jobStatus !== 'failed' || !errorMessage) {
        return;
      }

      setIsLoadingAnalysis(true);
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

        const response = await fetch(`/api/training/local/${jobId}/analyze-failure`, {
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to analyze failure');
        }

        const data = await response.json();
        setAnalysis(data.analysis);

      } catch (err) {
        console.error('[TrainingErrorPanel] Error fetching analysis:', err);
        setAnalysisError(err instanceof Error ? err.message : 'Failed to analyze failure');
      } finally {
        setIsLoadingAnalysis(false);
      }
    };

    fetchAnalysis();
  }, [jobId, jobStatus, errorMessage]);

  // Don't render if no error
  if (!errorMessage && jobStatus !== 'failed') {
    return null;
  }

  // Determine if error is long (multi-line or > 200 chars)
  const isLongError = errorMessage && (errorMessage.includes('\n') || errorMessage.length > 200);
  const truncatedError = isLongError && !isExpanded
    ? errorMessage.split('\n')[0].substring(0, 200) + '...'
    : errorMessage;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-red-100 border-b border-red-200">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-semibold text-red-900">
            {jobStatus === 'failed' ? 'Training Failed' : 'Training Cancelled'}
          </h3>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Raw Error Message */}
        {errorMessage && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-red-800">Error Message</span>
              {isLongError && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      Show full error
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="p-3 bg-white border border-red-200 rounded-md">
              <pre className="text-sm text-red-700 whitespace-pre-wrap font-mono overflow-x-auto">
                {truncatedError}
              </pre>
            </div>
          </div>
        )}

        {/* No error message fallback */}
        {!errorMessage && jobStatus === 'failed' && (
          <div className="p-3 bg-white border border-red-200 rounded-md">
            <p className="text-sm text-red-700">
              No error details available. The job may have crashed unexpectedly.
            </p>
          </div>
        )}

        {/* Analysis Section */}
        {jobStatus === 'failed' && (
          <div className="border-t border-red-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-gray-800">Intelligent Analysis</span>
            </div>

            {/* Loading State */}
            {isLoadingAnalysis && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" />
                <span className="text-sm text-amber-700">Analyzing failure...</span>
              </div>
            )}

            {/* Analysis Error */}
            {analysisError && !analysis && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-700">
                  Could not analyze failure: {analysisError}
                </p>
              </div>
            )}

            {/* Analysis Results */}
            {analysis && (
              <div className="space-y-3">
                {/* Error Type & Description */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900">
                        {analysis.description}
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        Type: {analysis.error_type.replace(/_/g, ' ')} | Phase: {analysis.error_phase}
                        {analysis.confidence && ` | Confidence: ${analysis.confidence}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Suggestions */}
                {analysis.suggestions && analysis.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-800">Suggested Fixes:</p>
                    <div className="space-y-2">
                      {analysis.suggestions.map((suggestion, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-green-50 border border-green-200 rounded-md"
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-medium text-green-900">
                              {suggestion.field.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-green-700 font-medium">
                              {suggestion.impact}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-sm">
                            <span className="text-gray-600">
                              {String(suggestion.current_value)}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="text-green-700 font-medium">
                              {String(suggestion.suggested_value)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1 italic">
                            {suggestion.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No suggestions */}
                {(!analysis.suggestions || analysis.suggestions.length === 0) && (
                  <p className="text-sm text-gray-600 italic">
                    No automatic config suggestions available. Check the error message above for details.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
