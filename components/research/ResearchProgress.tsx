import React from 'react';

interface ResearchProgressProps {
  progress: {
    step: number;
    totalSteps: number;
    status: string;
    message?: string;
  } | null;
  status: 'connecting' | 'streaming' | 'completed' | 'error';
}

/**
 * Displays research progress with step indicators
 * Shows current step, progress bar, and status message
 */
export function ResearchProgress({ progress, status }: ResearchProgressProps) {
  if (!progress) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span>Initializing research...</span>
      </div>
    );
  }

  const { step, totalSteps, status: stepStatus, message } = progress;
  const percentage = (step / totalSteps) * 100;

  return (
    <div className="space-y-2 py-2">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[60px]">
          {step}/{totalSteps}
        </span>
      </div>

      {/* Status text */}
      <div className="flex items-center gap-2 text-sm">
        {status === 'completed' ? (
          <span className="text-green-600 dark:text-green-400 font-medium">✓ Complete</span>
        ) : status === 'error' ? (
          <span className="text-red-600 dark:text-red-400 font-medium">✗ Error</span>
        ) : (
          <>
            <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">{stepStatus}</span>
          </>
        )}
        {message && (
          <span className="text-gray-500 dark:text-gray-400">- {message}</span>
        )}
      </div>
    </div>
  );
}
