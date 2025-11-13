'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface ConfidenceIndicatorProps {
  score: number; // 0-1 range
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ConfidenceIndicator({
  score,
  showLabel = true,
  size = 'md',
}: ConfidenceIndicatorProps) {
  // Clamp score between 0 and 1
  const clampedScore = Math.max(0, Math.min(1, score));
  const percentage = Math.round(clampedScore * 100);

  // Determine confidence level
  const getConfidenceLevel = () => {
    if (clampedScore >= 0.8) return 'high';
    if (clampedScore >= 0.5) return 'medium';
    return 'low';
  };

  const confidenceLevel = getConfidenceLevel();

  // Size classes
  const sizeClasses = {
    sm: {
      container: 'gap-1.5',
      icon: 'h-3 w-3',
      bar: 'h-1.5',
      text: 'text-xs',
    },
    md: {
      container: 'gap-2',
      icon: 'h-4 w-4',
      bar: 'h-2',
      text: 'text-sm',
    },
    lg: {
      container: 'gap-2.5',
      icon: 'h-5 w-5',
      bar: 'h-2.5',
      text: 'text-base',
    },
  };

  // Color classes based on confidence level
  const colorClasses = {
    high: {
      icon: 'text-green-600 dark:text-green-400',
      bar: 'bg-green-500 dark:bg-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-800 dark:text-green-200',
      label: '🟢 High Confidence',
    },
    medium: {
      icon: 'text-yellow-600 dark:text-yellow-400',
      bar: 'bg-yellow-500 dark:bg-yellow-400',
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-800 dark:text-yellow-200',
      label: '🟡 Medium Confidence',
    },
    low: {
      icon: 'text-red-600 dark:text-red-400',
      bar: 'bg-red-500 dark:bg-red-400',
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-800 dark:text-red-200',
      label: '🔴 Low Confidence',
    },
  };

  const Icon =
    confidenceLevel === 'high'
      ? CheckCircle2
      : confidenceLevel === 'medium'
      ? AlertCircle
      : XCircle;

  return (
    <div className={`flex items-center ${sizeClasses[size].container}`}>
      {/* Icon */}
      <Icon className={`${sizeClasses[size].icon} ${colorClasses[confidenceLevel].icon} flex-shrink-0`} />

      {/* Progress Bar */}
      <div className="flex-1 min-w-0">
        <div className={`w-full ${sizeClasses[size].bar} bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden`}>
          <div
            className={`h-full ${colorClasses[confidenceLevel].bar} transition-all duration-300 ease-out`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Label or Score */}
      {showLabel && (
        <div className={`flex-shrink-0 ${sizeClasses[size].text} font-medium ${colorClasses[confidenceLevel].text}`}>
          {percentage}%
        </div>
      )}
    </div>
  );
}

// Confidence badge variant (more compact)
export function ConfidenceBadge({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(1, score));
  const percentage = Math.round(clampedScore * 100);

  const getConfidenceLevel = () => {
    if (clampedScore >= 0.8) return 'high';
    if (clampedScore >= 0.5) return 'medium';
    return 'low';
  };

  const confidenceLevel = getConfidenceLevel();

  const colorClasses = {
    high: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
    medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
    low: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
  };

  const labels = {
    high: '🟢',
    medium: '🟡',
    low: '🔴',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${colorClasses[confidenceLevel]}`}
      title={`Confidence Score: ${percentage}%`}
    >
      <span>{labels[confidenceLevel]}</span>
      <span>{percentage}%</span>
    </span>
  );
}
