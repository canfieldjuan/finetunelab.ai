"use client";

import React, { useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import type { ContextUsage } from '@/lib/context';

interface ContextIndicatorProps {
  usage: ContextUsage | null;
  modelName?: string;
  className?: string;
  showThreshold?: number; // Percentage threshold to show indicator (default: 70)
}

/**
 * Minimal ContextIndicator Component
 * Only shows when context usage exceeds threshold (default 70%)
 *
 * Display:
 * - Hidden when < 70%
 * - Yellow badge at 70-85%: ⚠ 75% context used
 * - Orange badge at 85-95%: ⚠ 90% - consider new conversation
 * - Red badge at 95%+: 🔴 95% - start new conversation soon
 *
 * Hover for full details (tooltip)
 */
export function ContextIndicator({
  usage,
  modelName,
  className = '',
  showThreshold = 70
}: ContextIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Don't render if no usage data or below threshold
  if (!usage || usage.percentageUsed < showThreshold) {
    return null;
  }

  const { totalTokens, maxContextTokens, percentageUsed, warningLevel } = usage;
  const formattedPercentage = Math.round(percentageUsed);
  const formattedTokens = totalTokens.toLocaleString();
  const formattedMax = maxContextTokens.toLocaleString();

  // Get badge styling based on warning level
  const getBadgeStyles = () => {
    switch (warningLevel) {
      case 'high': // 95%+
        return {
          bg: 'bg-red-100 dark:bg-red-900/30',
          text: 'text-red-700 dark:text-red-300',
          border: 'border-red-300 dark:border-red-700',
          icon: '🔴',
          message: 'Start new conversation soon'
        };
      case 'medium': // 85-95%
        return {
          bg: 'bg-orange-100 dark:bg-orange-900/30',
          text: 'text-orange-700 dark:text-orange-300',
          border: 'border-orange-300 dark:border-orange-700',
          icon: '⚠️',
          message: 'Consider new conversation'
        };
      case 'low': // 70-85%
        return {
          bg: 'bg-yellow-100 dark:bg-yellow-900/30',
          text: 'text-yellow-700 dark:text-yellow-300',
          border: 'border-yellow-300 dark:border-yellow-700',
          icon: '⚠',
          message: 'Context filling up'
        };
      default:
        return {
          bg: 'bg-yellow-100 dark:bg-yellow-900/30',
          text: 'text-yellow-700 dark:text-yellow-300',
          border: 'border-yellow-300 dark:border-yellow-700',
          icon: '⚠',
          message: 'Context usage'
        };
    }
  };

  const styles = getBadgeStyles();

  return (
    <div className={`relative inline-flex ${className}`}>
      {/* Compact Badge */}
      <div
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
          border ${styles.border} ${styles.bg} ${styles.text}
          text-xs font-medium cursor-help transition-all
          hover:shadow-md
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span>{styles.icon}</span>
        <span>{formattedPercentage}% context</span>
        {warningLevel === 'high' && <AlertTriangle className="w-3 h-3" />}
      </div>

      {/* Tooltip (on hover) */}
      {showTooltip && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50">
          <div className="bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg p-3 min-w-[200px]">
            <div className="flex items-start gap-2 mb-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">{styles.message}</p>
                <p className="text-gray-300 dark:text-gray-400">
                  {formattedTokens} / {formattedMax} tokens
                </p>
                {modelName && (
                  <p className="text-gray-400 dark:text-gray-500 mt-1">
                    Model: {modelName}
                  </p>
                )}
              </div>
            </div>
            {/* Tooltip arrow */}
            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-800 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}
