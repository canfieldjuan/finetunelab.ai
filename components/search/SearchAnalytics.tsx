'use client';

import React from 'react';
import { 
  generateAnalytics, 
  type AnalyticsData 
} from '@/lib/utils/search-analytics';
import { WebSearchDocument } from '@/lib/tools/web-search/types';
import { 
  BarChart3, 
  TrendingUp, 
  CheckCircle2, 
  Calendar, 
  Award,
  Globe
} from 'lucide-react';

interface SearchAnalyticsProps {
  results: WebSearchDocument[];
  /**
   * Whether to show analytics (can be used for collapsible behavior)
   * @default true
   */
  show?: boolean;
  /**
   * Variant for display style
   * @default 'full'
   */
  variant?: 'full' | 'compact';
}

/**
 * SearchAnalytics Component
 * 
 * Displays comprehensive analytics about search results including:
 * - Quality score (0-100)
 * - Confidence distribution
 * - Source trust breakdown
 * - Date distribution
 * - Top sources
 * 
 * Phase 3: Advanced Search Features
 * Uses search-analytics utilities for metric calculation
 */
export function SearchAnalytics({ 
  results, 
  show = true,
  variant = 'full'
}: SearchAnalyticsProps) {
  if (!show) return null;

  const analytics: AnalyticsData = generateAnalytics(results);

  if (variant === 'compact') {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              Quality Score: {analytics.qualityScore}/100
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              <span>{(analytics.averageConfidence * 100).toFixed(1)}% avg</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>{analytics.sourceTrustBreakdown.verified} verified</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Search Analytics
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {analytics.qualityScore}/100
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Overall quality score based on confidence, trust, recency, and diversity
        </p>
      </div>

      {/* Analytics Grid */}
      <div className="p-4 space-y-4">
        {/* Average Confidence */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Average Confidence
              </span>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {(analytics.averageConfidence * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${analytics.averageConfidence * 100}%` }}
            />
          </div>
        </div>

        {/* Confidence Distribution */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Confidence Distribution
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-2 text-center">
              <div className="text-xs text-green-600 dark:text-green-400 font-medium">High</div>
              <div className="text-lg font-bold text-green-700 dark:text-green-300">
                {analytics.confidenceDistribution.high}
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 text-center">
              <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Medium</div>
              <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                {analytics.confidenceDistribution.medium}
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2 text-center">
              <div className="text-xs text-red-600 dark:text-red-400 font-medium">Low</div>
              <div className="text-lg font-bold text-red-700 dark:text-red-300">
                {analytics.confidenceDistribution.low}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-2 text-center">
              <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">Unknown</div>
              <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                {analytics.confidenceDistribution.unknown}
              </div>
            </div>
          </div>
        </div>

        {/* Source Trust Breakdown */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Source Trust Breakdown
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded p-2 text-center">
              <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">Verified</div>
              <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
                {analytics.sourceTrustBreakdown.verified}
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-2 text-center">
              <div className="text-xs text-green-600 dark:text-green-400 font-medium">High</div>
              <div className="text-lg font-bold text-green-700 dark:text-green-300">
                {analytics.sourceTrustBreakdown.high}
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 text-center">
              <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Medium</div>
              <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                {analytics.sourceTrustBreakdown.medium}
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2 text-center">
              <div className="text-xs text-red-600 dark:text-red-400 font-medium">Low</div>
              <div className="text-lg font-bold text-red-700 dark:text-red-300">
                {analytics.sourceTrustBreakdown.low}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-2 text-center">
              <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">Unknown</div>
              <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                {analytics.sourceTrustBreakdown.unknown}
              </div>
            </div>
          </div>
        </div>

        {/* Date Distribution */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Date Distribution
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded p-2 text-center">
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Today</div>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {analytics.dateDistribution.today}
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-2 text-center">
              <div className="text-xs text-green-600 dark:text-green-400 font-medium">This Week</div>
              <div className="text-lg font-bold text-green-700 dark:text-green-300">
                {analytics.dateDistribution.thisWeek}
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 text-center">
              <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">This Month</div>
              <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                {analytics.dateDistribution.thisMonth}
              </div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-2 text-center">
              <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">Older</div>
              <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
                {analytics.dateDistribution.older}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-2 text-center">
              <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">Undated</div>
              <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                {analytics.dateDistribution.undated}
              </div>
            </div>
          </div>
        </div>

        {/* Date Range Coverage */}
        {analytics.dateRangeCoverage.earliest && analytics.dateRangeCoverage.latest && (
          <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Date Range Coverage
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>
                Earliest: {new Date(analytics.dateRangeCoverage.earliest).toLocaleDateString()}
              </span>
              <span>→</span>
              <span>
                Latest: {new Date(analytics.dateRangeCoverage.latest).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}

        {/* Top Sources */}
        {analytics.topSources.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Top Sources (by count)
              </span>
            </div>
            <div className="space-y-1">
              {analytics.topSources.slice(0, 5).map((source) => (
                <div 
                  key={source.domain}
                  className="flex items-center justify-between text-sm p-2 rounded bg-gray-50 dark:bg-gray-700/50"
                >
                  <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                    {source.domain}
                  </span>
                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                    <span className="text-xs">
                      {(source.avgConfidence * 100).toFixed(0)}% avg
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {source.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
