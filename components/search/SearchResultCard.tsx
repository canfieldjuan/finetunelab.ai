'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ExternalLink, Bookmark, BookmarkCheck, Quote, ChevronDown, ChevronUp } from 'lucide-react';
import { WebSearchDocument } from '@/lib/tools/web-search/types';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { SourceBadge } from './SourceBadge';

interface SearchResultCardProps {
  result: WebSearchDocument;
  index: number;
  onSave?: (result: WebSearchDocument) => void;
  onCite?: (result: WebSearchDocument) => void;
  isSaved?: boolean;
}

export function SearchResultCard({
  result,
  index,
  onSave,
  onCite,
  isSaved = false,
}: SearchResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const hasFullContent = result.fullContent && result.fullContent.length > 0;
  const hasSummary = result.summary && result.summary.length > 0;

  // Format published date
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return date.toLocaleDateString();
    } catch {
      return null;
    }
  };

  const publishedDate = formatDate(result.publishedAt);

  return (
    <div className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Thumbnail */}
        {result.imageUrl && !imageError && (
          <div className="flex-shrink-0 w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden">
            <Image
              src={result.imageUrl}
              alt={result.title}
              width={80}
              height={80}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Source Badge and Date */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <SourceBadge
              domain={result.source || new URL(result.url).hostname}
              trustScore={result.confidenceScore}
            />
            {publishedDate && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                • {publishedDate}
              </span>
            )}
          </div>

          {/* Title */}
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group/link inline-flex items-center gap-1 mb-2"
          >
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover/link:text-blue-600 dark:group-hover/link:text-blue-400 line-clamp-2">
              {result.title}
            </h3>
            <ExternalLink className="h-3 w-3 text-gray-400 group-hover/link:text-blue-600 dark:group-hover/link:text-blue-400 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
          </a>

          {/* Snippet */}
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
            {result.snippet}
          </p>
        </div>
      </div>

      {/* Summary (if available and not expanded) */}
      {hasSummary && !isExpanded && (
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex items-start gap-2">
            <Quote className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-100 line-clamp-3">
              {result.summary}
            </p>
          </div>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mb-3 space-y-3">
          {/* Summary */}
          {hasSummary && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="flex items-start gap-2">
                <Quote className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">
                    AI Summary
                  </p>
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    {result.summary}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Full Content */}
          {hasFullContent && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Full Content Preview
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
                {result.fullContent}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        {/* Confidence Indicator */}
        <ConfidenceIndicator score={result.confidenceScore || 0.5} />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Expand/Collapse */}
          {(hasFullContent || hasSummary) && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Read More
                </>
              )}
            </button>
          )}

          {/* Save/Bookmark */}
          {onSave && (
            <button
              onClick={() => onSave(result)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                isSaved
                  ? 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30'
                  : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title={isSaved ? 'Saved' : 'Save result'}
            >
              {isSaved ? (
                <BookmarkCheck className="h-3 w-3" />
              ) : (
                <Bookmark className="h-3 w-3" />
              )}
              {isSaved ? 'Saved' : 'Save'}
            </button>
          )}

          {/* Cite */}
          {onCite && (
            <button
              onClick={() => onCite(result)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              title="Copy citation"
            >
              <Quote className="h-3 w-3" />
              Cite
            </button>
          )}

          {/* Open Link */}
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-md transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </a>
        </div>
      </div>

      {/* Result Index Badge */}
      <div className="absolute top-2 right-2 w-6 h-6 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full flex items-center justify-center text-xs font-semibold">
        {index + 1}
      </div>
    </div>
  );
}
