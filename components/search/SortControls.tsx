"use client";

import React from 'react';
import { ArrowUpDown, Calendar, TrendingUp, Clock } from 'lucide-react';
import { SortOption } from '@/lib/utils/search-filters';

interface SortControlsProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  resultCount: number;
  variant?: 'dropdown' | 'buttons';
}

/**
 * SortControls Component
 * 
 * Provides sorting controls for search results with multiple display variants.
 * 
 * Features:
 * - 5 sort options: relevance, date-desc, date-asc, confidence-desc, confidence-asc
 * - Two display variants: dropdown or button group
 * - Visual indicators for current sort
 * - Result count display
 * - Full dark mode support
 * - Accessible with proper labels
 * 
 * @component
 * @example
 * ```tsx
 * <SortControls
 *   currentSort="relevance"
 *   onSortChange={(sort) => setSortOption(sort)}
 *   resultCount={42}
 *   variant="dropdown"
 * />
 * ```
 */
export function SortControls({
  currentSort,
  onSortChange,
  resultCount,
  variant = 'dropdown'
}: SortControlsProps) {
  
  const sortOptions: Array<{
    value: SortOption;
    label: string;
    icon: React.ReactNode;
    description: string;
  }> = [
    {
      value: 'relevance',
      label: 'Relevance',
      icon: <TrendingUp className="h-4 w-4" />,
      description: 'Most relevant results first'
    },
    {
      value: 'date-desc',
      label: 'Newest First',
      icon: <Calendar className="h-4 w-4" />,
      description: 'Most recent publications first'
    },
    {
      value: 'date-asc',
      label: 'Oldest First',
      icon: <Clock className="h-4 w-4" />,
      description: 'Earliest publications first'
    },
    {
      value: 'confidence-desc',
      label: 'Highest Confidence',
      icon: <ArrowUpDown className="h-4 w-4" />,
      description: 'Most confident results first'
    },
    {
      value: 'confidence-asc',
      label: 'Lowest Confidence',
      icon: <ArrowUpDown className="h-4 w-4" />,
      description: 'Least confident results first'
    }
  ];

  const getCurrentLabel = () => {
    const option = sortOptions.find(opt => opt.value === currentSort);
    return option ? option.label : 'Relevance';
  };

  const getCurrentIcon = () => {
    const option = sortOptions.find(opt => opt.value === currentSort);
    return option ? option.icon : <TrendingUp className="h-4 w-4" />;
  };

  // Dropdown variant - compact select element
  if (variant === 'dropdown') {
    return (
      <div className="flex items-center justify-between gap-4 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Sort by:
          </span>
          <select
            value={currentSort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="px-3 py-1.5 text-sm font-medium bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </span>
      </div>
    );
  }

  // Button group variant - visual buttons with icons
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Sort by:
          </span>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {sortOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onSortChange(option.value)}
            title={option.description}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border transition-all ${
              currentSort === option.value
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 shadow-sm'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        ))}
      </div>

      {/* Current sort indicator */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          {getCurrentIcon()}
          <span>
            Currently sorted by: <span className="font-medium text-gray-700 dark:text-gray-300">{getCurrentLabel()}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
