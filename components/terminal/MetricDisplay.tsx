'use client';

/**
 * Metric Display Component
 * 
 * Displays a metric with label, value, and optional trend indicator
 * Phase 2: ASCII Rendering Components
 * 
 * Date: 2025-11-01
 */

import React from 'react';
import { formatTrend } from '@/lib/utils/terminal-format';

export interface MetricDisplayProps {
  /** Metric label */
  label: string;
  /** Current metric value */
  value: number | string;
  /** Previous value for trend calculation */
  previousValue?: number;
  /** Show trend arrow and delta (default: false) */
  showTrend?: boolean;
  /** Number of decimal places for numeric values (default: 3) */
  decimals?: number;
  /** Color variant based on metric type */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Metric Display Component
 * 
 * Displays a single metric with optional trend indicator
 * 
 * @example
 * <MetricDisplay 
 *   label="Train Loss" 
 *   value={3.456} 
 *   previousValue={3.579}
 *   showTrend
 * />
 * // Output: Train Loss: 3.456 ▼ [-0.123]
 */
export function MetricDisplay({
  label,
  value,
  previousValue,
  showTrend = false,
  decimals = 3,
  variant = 'default',
  className = '',
}: MetricDisplayProps) {
  // Format numeric values
  const formattedValue = typeof value === 'number'
    ? value.toFixed(decimals)
    : value;
  
  // Calculate trend if needed
  const trend = showTrend && typeof value === 'number' && previousValue !== undefined
    ? formatTrend(value, previousValue)
    : null;
  
  // Determine color classes based on variant
  const variantClasses = {
    default: { label: 'text-gray-400', value: 'text-gray-100' },
    success: { label: 'text-green-600', value: 'text-green-400' },
    warning: { label: 'text-yellow-600', value: 'text-yellow-400' },
    error: { label: 'text-red-600', value: 'text-red-400' },
    info: { label: 'text-blue-600', value: 'text-blue-400' },
  };
  
  const colors = variantClasses[variant] || variantClasses.default;
  
  // Determine trend color (inverse for loss - lower is better)
  const getTrendColor = () => {
    if (!trend) return '';
    
    const isLoss = label.toLowerCase().includes('loss');
    const isImproving = trend.delta.startsWith('-');
    
    if (isLoss) {
      // For loss metrics, lower is better
      return isImproving ? 'text-green-400' : 'text-red-400';
    } else {
      // For other metrics, higher is usually better
      return isImproving ? 'text-red-400' : 'text-green-400';
    }
  };
  
  const trendColor = getTrendColor();
  
  return (
    <div className={`font-mono text-sm inline-flex items-center gap-2 ${className}`}>
      <span className={colors.label}>{label}:</span>
      <span className={`${colors.value} tabular-nums font-semibold`}>
        {formattedValue}
      </span>
      {trend && (
        <span className={`${trendColor} text-xs`}>
          {trend.arrow} [{trend.delta}]
        </span>
      )}
    </div>
  );
}

export default MetricDisplay;
