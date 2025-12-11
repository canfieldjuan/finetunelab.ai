"use client";

import React from 'react';
import { 
  Shield, 
  Clock, 
  CheckCircle, 
  Newspaper, 
  Search, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { SearchFilters, getFilterPresets, FilterPreset } from '@/lib/utils/search-filters';

interface FilterPresetsProps {
  onPresetSelect: (preset: FilterPreset) => void;
  currentFilters: SearchFilters;
}

/**
 * FilterPresets Component
 * 
 * Displays predefined filter configurations as clickable preset buttons.
 * Users can quickly apply common filter combinations.
 * 
 * Features:
 * - 6 predefined presets with icons and descriptions
 * - Visual indicator for currently active preset
 * - Hover tooltips with detailed descriptions
 * - Responsive grid layout
 * - Full dark mode support
 * - Accessibility with proper labels
 * 
 * Presets:
 * 1. High Confidence Only - Results with 80%+ confidence
 * 2. Recent & Reliable - High quality recent content (past 30 days, 70%+)
 * 3. Verified Sources - Only verified and high trust sources (50%+)
 * 4. Latest News - Recent news regardless of confidence (past 7 days)
 * 5. Deep Dive - Comprehensive research mode (past year, all filters)
 * 6. All Results - Clear all filters
 * 
 * @component
 * @example
 * ```tsx
 * <FilterPresets
 *   onPresetSelect={(preset) => {
 *     setFilters(preset.filters);
 *     setSortOption(preset.sortOption);
 *   }}
 *   currentFilters={filters}
 * />
 * ```
 */
export function FilterPresets({
  onPresetSelect,
  currentFilters
}: FilterPresetsProps) {
  
  const presets = getFilterPresets();

  // Get icon component for each preset
  const getPresetIcon = (icon: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      Shield: <Shield className="h-5 w-5" />,
      Clock: <Clock className="h-5 w-5" />,
      CheckCircle: <CheckCircle className="h-5 w-5" />,
      Newspaper: <Newspaper className="h-5 w-5" />,
      Search: <Search className="h-5 w-5" />,
      RotateCcw: <RotateCcw className="h-5 w-5" />
    };
    return iconMap[icon] || <Sparkles className="h-5 w-5" />;
  };

  // Check if a preset is currently active
  const isPresetActive = (preset: FilterPreset): boolean => {
    const { confidence, dateRange, sourceTrust } = currentFilters;
    const pf = preset.filters;

    // Compare confidence
    const confidenceMatch = 
      confidence.min === pf.confidence.min && 
      confidence.max === pf.confidence.max;

    // Compare date range
    const dateRangeMatch = 
      dateRange.start === pf.dateRange.start && 
      dateRange.end === pf.dateRange.end;

    // Compare source trust
    const sourceTrustMatch = 
      sourceTrust.verified === pf.sourceTrust.verified &&
      sourceTrust.high === pf.sourceTrust.high &&
      sourceTrust.medium === pf.sourceTrust.medium &&
      sourceTrust.low === pf.sourceTrust.low &&
      sourceTrust.unknown === pf.sourceTrust.unknown;

    return confidenceMatch && dateRangeMatch && sourceTrustMatch;
  };

  // Get color scheme for each preset
  const getPresetColors = (id: string, isActive: boolean) => {
    const colorMap: Record<string, { active: string; inactive: string }> = {
      'high-confidence': {
        active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
        inactive: 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/20'
      },
      'recent-reliable': {
        active: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
        inactive: 'bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20'
      },
      'verified-sources': {
        active: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
        inactive: 'bg-purple-50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/20'
      },
      'latest-news': {
        active: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
        inactive: 'bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/20'
      },
      'deep-dive': {
        active: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700',
        inactive: 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/20'
      },
      'all-results': {
        active: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600',
        inactive: 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
      }
    };

    const colors = colorMap[id] || colorMap['all-results'];
    return isActive ? colors.active : colors.inactive;
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Quick Filters
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {presets.map((preset) => {
          const isActive = isPresetActive(preset);
          const colors = getPresetColors(preset.id, isActive);

          return (
            <button
              key={preset.id}
              onClick={() => onPresetSelect(preset)}
              title={preset.description}
              className={`relative flex flex-col items-start gap-2 p-3 border rounded-lg transition-all text-left ${colors} ${
                isActive ? 'shadow-md ring-2 ring-offset-2 ring-current' : 'shadow-sm hover:shadow-md'
              }`}
            >
              {/* Icon and active indicator */}
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  {getPresetIcon(preset.icon)}
                  <span className="text-sm font-semibold">
                    {preset.name}
                  </span>
                </div>
                {isActive && (
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-current animate-pulse" />
                    <span className="text-xs font-medium">Active</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="text-xs opacity-90 line-clamp-2">
                {preset.description}
              </p>

              {/* Filter summary */}
              <div className="flex flex-wrap gap-1 mt-1">
                {/* Confidence badge */}
                {(preset.filters.confidence.min > 0 || preset.filters.confidence.max < 1) && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-current/10 font-medium">
                    {Math.round(preset.filters.confidence.min * 100)}%-{Math.round(preset.filters.confidence.max * 100)}%
                  </span>
                )}

                {/* Date range badge */}
                {preset.filters.dateRange.start && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-current/10 font-medium">
                    {(() => {
                      const days = Math.floor((Date.now() - preset.filters.dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
                      if (days <= 1) return 'Today';
                      if (days <= 7) return 'Week';
                      if (days <= 30) return 'Month';
                      if (days <= 90) return '3mo';
                      return 'Year';
                    })()}
                  </span>
                )}

                {/* Source trust badge */}
                {(!preset.filters.sourceTrust.verified || 
                  !preset.filters.sourceTrust.high || 
                  !preset.filters.sourceTrust.medium || 
                  !preset.filters.sourceTrust.low || 
                  !preset.filters.sourceTrust.unknown) && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-current/10 font-medium">
                    Trust Filter
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Help text */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          💡 Click any preset to quickly apply predefined filters. The active preset is highlighted.
        </p>
      </div>
    </div>
  );
}
