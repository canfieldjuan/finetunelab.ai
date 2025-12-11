import React from 'react';
import { useResearchStream } from '@/hooks/useResearchStream';
import { ResearchProgress } from './ResearchProgress';
import { StructuredReportView } from './StructuredReportView';

interface ResearchStreamViewerProps {
  jobId: string;
  query: string;
}

/**
 * Main component for displaying live research stream
 * Combines SSE hook with progress and report view components
 */
export function ResearchStreamViewer({ jobId, query }: ResearchStreamViewerProps) {
  const { state } = useResearchStream(jobId);

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <ResearchProgress progress={state.progress} status={state.status} />
      </div>

      {/* Error state */}
      {state.status === 'error' && state.error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-300 font-medium">Error: {state.error}</p>
        </div>
      )}

      {/* Structured report view */}
      {(state.outline || state.sections.size > 0) && (
        <StructuredReportView
          query={query}
          outline={state.outline}
          sections={state.sections}
          citations={state.citations}
          status={state.status}
        />
      )}

      {/* Completion message */}
      {state.status === 'completed' && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-700 dark:text-green-300 font-medium">
            ✓ Research complete!
            {state.totalCostUsd && (
              <span className="ml-2 text-sm">
                (Cost: ${state.totalCostUsd.toFixed(4)})
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
