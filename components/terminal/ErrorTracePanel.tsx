'use client';

/**
 * Error Trace Panel Component - Production Version
 *
 * Displays training errors with full traceback in terminal style
 * Uses structured API endpoint for robust error extraction
 *
 * Date: 2025-12-12
 */

import React, { useState, useEffect, useCallback } from 'react';

interface TracebackFrame {
  file: string;
  line: number;
  function: string;
  code: string | null;
}

interface TracebackInfo {
  raw: string;
  frames: TracebackFrame[];
  exception_type: string;
  exception_message: string;
}

interface StructuredError {
  timestamp: string;
  level: string;
  phase: string;
  message: string;
  dedupe_key: string;
  count: number;
}

interface ErrorResponse {
  job_id: string;
  error_summary: string | null;
  errors: StructuredError[];
  traceback: TracebackInfo | null;
  error_count: number;
  unique_error_count: number;
}

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

export interface ErrorTracePanelProps {
  /** Job ID for fetching errors */
  jobId: string;
  /** Error message from job status (fallback) */
  errorMessage?: string;
  /** Job status */
  status: string;
  /** Additional CSS classes */
  className?: string;
}

export function ErrorTracePanel({
  jobId,
  errorMessage,
  status,
  className = '',
}: ErrorTracePanelProps) {
  const [errorData, setErrorData] = useState<ErrorResponse | null>(null);
  const [analysis, setAnalysis] = useState<FailureAnalysis | null>(null);
  const [isLoadingErrors, setIsLoadingErrors] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [showFullTrace, setShowFullTrace] = useState(false);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [copied, setCopied] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Fetch structured errors from API
  const fetchErrors = useCallback(async () => {
    setIsLoadingErrors(true);
    setApiError(null);

    try {
      const response = await fetch(`/api/training/local/${jobId}/errors`);

      if (response.ok) {
        const data: ErrorResponse = await response.json();
        setErrorData(data);
      } else {
        const errData = await response.json().catch(() => ({}));
        setApiError(errData.error || `Failed to fetch errors: ${response.status}`);
      }
    } catch (err) {
      console.error('[ErrorTracePanel] Error fetching errors:', err);
      setApiError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsLoadingErrors(false);
    }
  }, [jobId]);

  // Fetch failure analysis
  const fetchAnalysis = useCallback(async () => {
    setIsLoadingAnalysis(true);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) return;

      const authData = localStorage.getItem('sb-' + supabaseUrl.split('//')[1].split('.')[0] + '-auth-token');
      if (!authData) return;

      const { access_token } = JSON.parse(authData);

      const response = await fetch(`/api/training/local/${jobId}/analyze-failure`, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysis(data.analysis);
      }
    } catch (err) {
      console.error('[ErrorTracePanel] Error fetching analysis:', err);
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (status === 'failed') {
      fetchErrors();
      fetchAnalysis();
    }
  }, [jobId, status, fetchErrors, fetchAnalysis]);

  // Only show for failed jobs - must be after all hooks
  if (status !== 'failed') {
    return null;
  }

  // Copy error to clipboard
  const handleCopy = () => {
    const parts: string[] = [];

    // Error summary
    if (errorData?.error_summary) {
      parts.push(`Error Summary: ${errorData.error_summary}`);
    }

    // Traceback
    if (errorData?.traceback) {
      parts.push('');
      parts.push('=== TRACEBACK ===');
      parts.push(errorData.traceback.raw);
    }

    // Structured errors
    if (errorData?.errors && errorData.errors.length > 0) {
      parts.push('');
      parts.push('=== ERRORS ===');
      errorData.errors.forEach(e => {
        parts.push(`[${e.level.toUpperCase()}] (${e.count}x) [${e.phase}] ${e.message}`);
      });
    }

    // Analysis
    if (analysis) {
      parts.push('');
      parts.push('=== ANALYSIS ===');
      parts.push(`Type: ${analysis.error_type}`);
      parts.push(`Phase: ${analysis.error_phase}`);
      parts.push(`Description: ${analysis.description}`);
    }

    navigator.clipboard.writeText(parts.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine what to display
  const hasErrors = errorData && (errorData.errors.length > 0 || errorData.traceback);
  const displayError = errorData?.error_summary || errorMessage;

  // If no error data at all, don't show
  if (!isLoadingErrors && !hasErrors && !displayError && !apiError) {
    return null;
  }

  // Display errors (max 5 unless expanded)
  const displayedErrors = showAllErrors
    ? errorData?.errors || []
    : (errorData?.errors || []).slice(0, 5);

  return (
    <div className={`bg-gray-900 border-2 border-red-500/50 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-5 py-3 bg-red-900/30 border-b border-red-500/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-red-400 text-lg">🚨</span>
          <span className="text-red-400 font-bold tracking-wide">ERROR TRACE</span>
          {errorData && (
            <span className="text-gray-500 text-xs">
              ({errorData.unique_error_count} unique / {errorData.error_count} total)
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-gray-300 transition-colors"
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Loading State */}
        {isLoadingErrors && (
          <div className="text-gray-500 text-sm flex items-center gap-2">
            <span className="animate-pulse">●</span> Loading error details...
          </div>
        )}

        {/* API Error */}
        {apiError && (
          <div className="bg-yellow-900/20 rounded p-3 border border-yellow-700/30 text-sm">
            <span className="text-yellow-400">⚠️</span>
            <span className="text-yellow-200 ml-2">{apiError}</span>
          </div>
        )}

        {/* Error Type & Phase (from analysis) */}
        {analysis && (
          <div className="flex flex-wrap gap-4 text-xs">
            <div>
              <span className="text-gray-500">Type:</span>{' '}
              <span className="text-yellow-400 font-semibold">
                {analysis.error_type.replace(/_/g, ' ')}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Phase:</span>{' '}
              <span className="text-yellow-400">{analysis.error_phase}</span>
            </div>
            {analysis.confidence && (
              <div>
                <span className="text-gray-500">Confidence:</span>{' '}
                <span className="text-gray-400">{analysis.confidence}</span>
              </div>
            )}
          </div>
        )}

        {/* Main Error Message / Summary */}
        {displayError && (
          <div className="bg-black/50 rounded p-4 border border-red-900/50">
            <div className="text-gray-500 text-xs mb-2 uppercase tracking-wide">Error Summary</div>
            <pre className="text-red-400 text-sm whitespace-pre-wrap font-mono break-words">
              {displayError}
            </pre>
          </div>
        )}

        {/* Analysis Description */}
        {analysis?.description && (
          <div className="bg-yellow-900/20 rounded p-4 border border-yellow-700/30">
            <div className="text-yellow-500 text-xs mb-2 uppercase tracking-wide flex items-center gap-2">
              <span>💡</span> Analysis
            </div>
            <p className="text-yellow-200 text-sm">{analysis.description}</p>
          </div>
        )}

        {/* Traceback Section */}
        {errorData?.traceback && (
          <div className="bg-black/50 rounded border border-gray-700">
            <button
              onClick={() => setShowFullTrace(!showFullTrace)}
              className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-gray-800/50 transition-colors"
            >
              <span className="text-gray-500 text-xs uppercase tracking-wide">
                Traceback ({errorData.traceback.frames.length} frames)
              </span>
              <span className="text-gray-500 text-xs">
                {showFullTrace ? '▼ Hide' : '▶ Show'}
              </span>
            </button>
            {showFullTrace && (
              <div className="px-4 pb-4 max-h-80 overflow-y-auto">
                {/* Exception line */}
                {errorData.traceback.exception_type && (
                  <div className="mb-3 pb-2 border-b border-gray-700">
                    <span className="text-red-400 font-semibold">
                      {errorData.traceback.exception_type}
                    </span>
                    {errorData.traceback.exception_message && (
                      <span className="text-red-300">
                        : {errorData.traceback.exception_message}
                      </span>
                    )}
                  </div>
                )}

                {/* Stack frames */}
                <div className="space-y-2">
                  {errorData.traceback.frames.map((frame, i) => (
                    <div key={i} className="text-xs font-mono">
                      <div className="text-blue-400">
                        File &quot;{frame.file}&quot;, line {frame.line}, in{' '}
                        <span className="text-cyan-400">{frame.function}</span>
                      </div>
                      {frame.code && (
                        <div className="text-gray-400 pl-4 mt-0.5">
                          {frame.code}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Deduplicated Errors */}
        {displayedErrors.length > 0 && (
          <div className="bg-black/50 rounded p-4 border border-gray-700">
            <div className="text-gray-500 text-xs mb-3 uppercase tracking-wide flex items-center justify-between">
              <span>Errors ({errorData?.unique_error_count || displayedErrors.length})</span>
              {errorData && errorData.errors.length > 5 && (
                <button
                  onClick={() => setShowAllErrors(!showAllErrors)}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {showAllErrors ? 'Show less' : `Show all ${errorData.errors.length}`}
                </button>
              )}
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {displayedErrors.map((error, i) => (
                <div
                  key={error.dedupe_key || i}
                  className="text-xs font-mono bg-gray-800/50 rounded p-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs ${
                        error.level === 'error'
                          ? 'bg-red-900/50 text-red-400'
                          : 'bg-yellow-900/50 text-yellow-400'
                      }`}
                    >
                      {error.level.toUpperCase()}
                    </span>
                    {error.count > 1 && (
                      <span className="text-gray-500">({error.count}x)</span>
                    )}
                    <span className="text-gray-600">[{error.phase}]</span>
                    {error.timestamp && (
                      <span className="text-gray-600 ml-auto">{error.timestamp}</span>
                    )}
                  </div>
                  <div className="text-gray-300 break-words">{error.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Fixes */}
        {analysis?.suggestions && analysis.suggestions.length > 0 && (
          <div className="bg-green-900/20 rounded p-4 border border-green-700/30">
            <div className="text-green-500 text-xs mb-3 uppercase tracking-wide flex items-center gap-2">
              <span>🔧</span> Suggested Fixes
            </div>
            <div className="space-y-3">
              {analysis.suggestions.map((suggestion, idx) => (
                <div key={idx} className="bg-black/30 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-green-400 text-sm font-semibold">
                      {suggestion.field.replace(/_/g, ' ')}
                    </span>
                    <span className="text-green-600 text-xs">{suggestion.impact}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-mono mb-1">
                    <span className="text-gray-500">{String(suggestion.current_value)}</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-green-400">{String(suggestion.suggested_value)}</span>
                  </div>
                  <p className="text-gray-500 text-xs italic">{suggestion.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading Analysis */}
        {isLoadingAnalysis && !analysis && (
          <div className="text-gray-500 text-xs flex items-center gap-2">
            <span className="animate-pulse">●</span> Analyzing failure...
          </div>
        )}
      </div>
    </div>
  );
}

export default ErrorTracePanel;
