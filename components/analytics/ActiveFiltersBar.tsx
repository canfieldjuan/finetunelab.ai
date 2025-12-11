"use client";

/**
 * ActiveFiltersBar Component
 *
 * Displays active filters as chips/badges with clear buttons
 * Provides visual indication of what data is currently filtered
 *
 * Phase: Analytics Filter Consolidation
 * Date: 2025-11-29
 */

import React from 'react';
import { X, Filter } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import type { AnalyticsFilters } from '@/hooks/useAnalytics';

interface ActiveFiltersBarProps {
  filters: AnalyticsFilters;
  selectedModelId: string | null;
  selectedSessionId: string | null;
  onClearModel: () => void;
  onClearSession: () => void;
  onClearFilter: (filterKey: keyof AnalyticsFilters) => void;
  availableModels: Array<{ id: string; name: string }>;
  availableSessions: Array<{ id: string; name: string }>;
}

export function ActiveFiltersBar({
  filters,
  selectedModelId,
  selectedSessionId,
  onClearModel,
  onClearSession,
  onClearFilter,
  availableModels,
  availableSessions
}: ActiveFiltersBarProps) {
  // Calculate if any filters are active
  const hasModelFilter = selectedModelId !== null;
  const hasSessionFilter = selectedSessionId !== null;
  const hasRatingFilter = filters.ratings.length > 0;
  const hasSuccessFilter = filters.successFilter !== 'all';
  const hasSessionTypeFilter = filters.widgetSessionFilter !== 'all';
  const hasTrainingMethodFilter = filters.trainingMethods.length > 0;

  const hasAnyFilter =
    hasModelFilter ||
    hasSessionFilter ||
    hasRatingFilter ||
    hasSuccessFilter ||
    hasSessionTypeFilter ||
    hasTrainingMethodFilter;

  // Don't render if no filters active
  if (!hasAnyFilter) {
    return null;
  }

  // Get model name from ID
  const getModelName = (id: string): string => {
    const model = availableModels.find(m => m.id === id);
    return model?.name || id;
  };

  // Get session name from ID
  const getSessionName = (id: string): string => {
    const session = availableSessions.find(s => s.id === id);
    return session?.name || id;
  };

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
      <CardContent className="py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-100">
            <Filter className="w-4 h-4" />
            <span>Active Filters:</span>
          </div>

          {/* Model Filter Badge */}
          {hasModelFilter && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-full text-sm">
              <span className="text-lg">📊</span>
              <span className="font-medium text-gray-700 dark:text-gray-200">Model:</span>
              <span className="text-gray-900 dark:text-white">{getModelName(selectedModelId)}</span>
              <button
                onClick={onClearModel}
                className="ml-1 p-0.5 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-colors"
                aria-label="Clear model filter"
              >
                <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              </button>
            </div>
          )}

          {/* Session Filter Badge */}
          {hasSessionFilter && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-full text-sm">
              <span className="text-lg">🧪</span>
              <span className="font-medium text-gray-700 dark:text-gray-200">Session:</span>
              <span className="text-gray-900 dark:text-white">{getSessionName(selectedSessionId)}</span>
              <button
                onClick={onClearSession}
                className="ml-1 p-0.5 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-colors"
                aria-label="Clear session filter"
              >
                <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              </button>
            </div>
          )}

          {/* Rating Filter Badge */}
          {hasRatingFilter && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-full text-sm">
              <span className="text-lg">⭐</span>
              <span className="font-medium text-gray-700 dark:text-gray-200">Ratings:</span>
              <span className="text-gray-900 dark:text-white">
                {filters.ratings.sort().join(', ')}
              </span>
              <button
                onClick={() => onClearFilter('ratings')}
                className="ml-1 p-0.5 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-colors"
                aria-label="Clear rating filter"
              >
                <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              </button>
            </div>
          )}

          {/* Success Filter Badge */}
          {hasSuccessFilter && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-full text-sm">
              <span className="text-lg">{filters.successFilter === 'success' ? '✅' : '❌'}</span>
              <span className="font-medium text-gray-700 dark:text-gray-200">Status:</span>
              <span className="text-gray-900 dark:text-white capitalize">{filters.successFilter}</span>
              <button
                onClick={() => onClearFilter('successFilter')}
                className="ml-1 p-0.5 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-colors"
                aria-label="Clear success filter"
              >
                <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              </button>
            </div>
          )}

          {/* Session Type Filter Badge */}
          {hasSessionTypeFilter && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-full text-sm">
              <span className="text-lg">💬</span>
              <span className="font-medium text-gray-700 dark:text-gray-200">Type:</span>
              <span className="text-gray-900 dark:text-white capitalize">
                {filters.widgetSessionFilter === 'widget' ? 'Widget' : 'Normal'}
              </span>
              <button
                onClick={() => onClearFilter('widgetSessionFilter')}
                className="ml-1 p-0.5 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-colors"
                aria-label="Clear session type filter"
              >
                <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              </button>
            </div>
          )}

          {/* Training Method Filter Badge */}
          {hasTrainingMethodFilter && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-full text-sm">
              <span className="text-lg">🎓</span>
              <span className="font-medium text-gray-700 dark:text-gray-200">Training:</span>
              <span className="text-gray-900 dark:text-white uppercase">
                {filters.trainingMethods.join(', ')}
              </span>
              <button
                onClick={() => onClearFilter('trainingMethods')}
                className="ml-1 p-0.5 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-colors"
                aria-label="Clear training method filter"
              >
                <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
