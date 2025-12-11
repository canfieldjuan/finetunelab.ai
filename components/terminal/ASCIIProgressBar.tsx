'use client';

/**
 * ASCII Progress Bar Component
 * 
 * Renders a terminal-style progress bar using Unicode block characters
 * Phase 2: ASCII Rendering Components
 * 
 * Date: 2025-11-01
 */

import React from 'react';
import { generateProgressBar } from '@/lib/utils/terminal-format';
import { ProgressChars, DEFAULT_PROGRESS_CHARS } from '@/lib/training/terminal-monitor.types';

export interface ASCIIProgressBarProps {
  /** Progress value (0-100) */
  value: number;
  /** Width of progress bar in characters (default: 40) */
  width?: number;
  /** Label to display before progress bar */
  label?: string;
  /** Show percentage after bar (default: true) */
  showPercentage?: boolean;
  /** Custom character set for progress bar */
  chars?: ProgressChars;
  /** Additional CSS classes */
  className?: string;
  /** Color variant */
  variant?: 'default' | 'success' | 'warning' | 'error';
}

/**
 * ASCII Progress Bar Component
 * 
 * @example
 * <ASCIIProgressBar value={42.5} label="Epoch 1/2" width={30} />
 * // Output: Epoch 1/2: [████████████▒                 ] 42.5%
 */
export function ASCIIProgressBar({
  value,
  width = 40,
  label,
  showPercentage = true,
  chars = DEFAULT_PROGRESS_CHARS,
  className = '',
  variant = 'default',
}: ASCIIProgressBarProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value));
  
  // Generate the progress bar string
  const progressBar = generateProgressBar(clampedValue, width, chars);
  
  // Determine color classes based on variant
  const variantClasses = {
    default: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };
  
  const colorClass = variantClasses[variant] || variantClasses.default;
  
  return (
    <div className={`font-mono text-sm ${className}`}>
      <span className="inline-flex items-center gap-2">
        {label && <span className="text-gray-300">{label}:</span>}
        <span className={colorClass}>{progressBar}</span>
        {showPercentage && (
          <span className="text-gray-400 tabular-nums">
            {clampedValue.toFixed(1)}%
          </span>
        )}
      </span>
    </div>
  );
}

export default ASCIIProgressBar;
