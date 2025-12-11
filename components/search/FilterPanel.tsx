'use client';

import React, { useState } from 'react';
import { X, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { type SearchFilters, getActiveFilterCount } from '@/lib/utils/search-filters';

interface FilterPanelProps {
  onFilterChange: (filters: SearchFilters) => void;
  activeFilters: SearchFilters;
  totalResults: number;
  filteredResults: number;
}

export function FilterPanel({
  onFilterChange,
  activeFilters,
  totalResults,
  filteredResults,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const activeCount = getActiveFilterCount(activeFilters);

  const handleConfidenceChange = (min: number, max: number) => {
    onFilterChange({
      ...activeFilters,
      confidence: { min, max },
    });
  };

  const handleDateRangeChange = (preset: string) => {
    let start: Date | null = null;
    let end: Date | null = new Date();

    switch (preset) {
      case 'today':
        start = new Date();
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        start = null;
        end = null;
        break;
    }

    onFilterChange({
      ...activeFilters,
      dateRange: { start, end },
    });
  };

  const handleSourceTrustChange = (level: keyof SearchFilters['sourceTrust'], checked: boolean) => {
    onFilterChange({
      ...activeFilters,
      sourceTrust: {
        ...activeFilters.sourceTrust,
        [level]: checked,
      },
    });
  };

  const clearAllFilters = () => {
    onFilterChange({
      confidence: { min: 0, max: 1 },
      dateRange: { start: null, end: null },
      sourceTrust: {
        verified: true,
        high: true,
        medium: true,
        low: true,
        unknown: true,
      },
    });
  };

  const getDateRangeLabel = () => {
    if (!activeFilters.dateRange.start && !activeFilters.dateRange.end) {
      return 'All Time';
    }

    if (activeFilters.dateRange.start) {
      const daysDiff = Math.floor(
        (Date.now() - activeFilters.dateRange.start.getTime()) / (24 * 60 * 60 * 1000)
      );

      if (daysDiff <= 1) return 'Today';
      if (daysDiff <= 7) return 'Past Week';
      if (daysDiff <= 30) return 'Past Month';
      if (daysDiff <= 90) return 'Past 3 Months';
      if (daysDiff <= 365) return 'Past Year';
    }

    return 'Custom Range';
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Filters</h3>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
              {activeCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              Clear All
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Result Count */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredResults} of {totalResults} results
      </div>

      {/* Filters Content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Confidence Filter */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confidence Score
            </label>
            
            {/* Preset Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleConfidenceChange(0.8, 1)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeFilters.confidence.min === 0.8 && activeFilters.confidence.max === 1
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                } border`}
              >
                🟢 High (80%+)
              </button>
              <button
                onClick={() => handleConfidenceChange(0.5, 0.79)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeFilters.confidence.min === 0.5 && activeFilters.confidence.max === 0.79
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                } border`}
              >
                🟡 Medium (50-79%)
              </button>
              <button
                onClick={() => handleConfidenceChange(0, 0.49)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeFilters.confidence.min === 0 && activeFilters.confidence.max === 0.49
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                } border`}
              >
                🔴 Low (&lt;50%)
              </button>
              <button
                onClick={() => handleConfidenceChange(0, 1)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeFilters.confidence.min === 0 && activeFilters.confidence.max === 1
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                } border`}
              >
                All
              </button>
            </div>

            {/* Range Display */}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Current range: {Math.round(activeFilters.confidence.min * 100)}% -{' '}
              {Math.round(activeFilters.confidence.max * 100)}%
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Published Date
            </label>

            <select
              value={getDateRangeLabel()}
              onChange={(e) => handleDateRangeChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="today">Today</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
              <option value="3months">Past 3 Months</option>
              <option value="year">Past Year</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Source Trust Filter */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Source Trust Level
            </label>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeFilters.sourceTrust.verified}
                  onChange={(e) => handleSourceTrustChange('verified', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  ✓ Verified Sources
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeFilters.sourceTrust.high}
                  onChange={(e) => handleSourceTrustChange('high', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  🟢 High Trust (80%+)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeFilters.sourceTrust.medium}
                  onChange={(e) => handleSourceTrustChange('medium', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-yellow-600 focus:ring-yellow-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  🟡 Medium Trust (50-79%)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeFilters.sourceTrust.low}
                  onChange={(e) => handleSourceTrustChange('low', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  🔴 Low Trust (&lt;50%)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeFilters.sourceTrust.unknown}
                  onChange={(e) => handleSourceTrustChange('unknown', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-gray-600 focus:ring-gray-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  ⚪ Unknown Trust
                </span>
              </label>
            </div>
          </div>

          {/* Active Filters Display */}
          {activeCount > 0 && (
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Active Filters
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {activeFilters.confidence.min !== 0 || activeFilters.confidence.max !== 1 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs">
                    Confidence: {Math.round(activeFilters.confidence.min * 100)}%-
                    {Math.round(activeFilters.confidence.max * 100)}%
                    <button
                      onClick={() => handleConfidenceChange(0, 1)}
                      className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}

                {(activeFilters.dateRange.start || activeFilters.dateRange.end) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-xs">
                    Date: {getDateRangeLabel()}
                    <button
                      onClick={() => handleDateRangeChange('all')}
                      className="hover:bg-purple-200 dark:hover:bg-purple-800 rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
