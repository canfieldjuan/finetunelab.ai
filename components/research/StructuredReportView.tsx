import React from 'react';
import type { Citation } from '@/lib/tools/web-search/types';

interface StructuredReportViewProps {
  query: string;
  outline: string[] | null;
  sections: Map<string, string>;
  citations: Map<string, Citation[]>;
  status: 'connecting' | 'streaming' | 'completed' | 'error';
}

/**
 * Renders structured research report with progressive loading
 * Shows sections as they are generated via SSE
 */
export function StructuredReportView({
  query,
  outline,
  sections,
  citations,
  status
}: StructuredReportViewProps) {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      {/* Report Title */}
      <h1 className="text-2xl font-bold mb-4">Research Report: {query}</h1>

      {/* Outline (if available) */}
      {outline && outline.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Report Outline</h3>
          <ul className="space-y-1">
            {outline.map((section, index) => {
              const hasContent = sections.has(section);
              return (
                <li
                  key={index}
                  className={`text-sm ${
                    hasContent
                      ? 'text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-blue-600/50 dark:text-blue-400/50'
                  }`}
                >
                  {hasContent ? '✓' : '○'} {section}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Sections */}
      {Array.from(sections.entries()).map(([sectionName, content]) => (
        <div key={sectionName} className="mb-6">
          <h2 className="text-xl font-semibold mb-3 border-b border-gray-300 dark:border-gray-700 pb-2">
            {sectionName}
          </h2>
          <div className="whitespace-pre-wrap">{content}</div>

          {/* Citations for this section */}
          {citations.has(sectionName) && citations.get(sectionName)!.length > 0 && (
            <div className="mt-3 pl-4 border-l-2 border-blue-300 dark:border-blue-700">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Sources:</p>
              <ul className="space-y-1">
                {citations.get(sectionName)!.map((citation, idx) => (
                  <li key={idx} className="text-sm">
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {citation.title}
                    </a>
                    {citation.source && (
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        - {citation.source}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}

      {/* Loading indicator */}
      {status === 'streaming' && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-4">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span>Generating additional sections...</span>
        </div>
      )}
    </div>
  );
}
