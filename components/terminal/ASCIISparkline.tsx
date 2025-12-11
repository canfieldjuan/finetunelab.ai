'use client';

/**
 * ASCII Sparkline Chart Component
 * 
 * Renders a mini line chart using ASCII/Unicode characters
 * Phase 2: ASCII Rendering Components
 * 
 * Date: 2025-11-01
 */

import React, { useMemo } from 'react';
import type { ChartDataPoint } from '@/lib/training/terminal-monitor.types';

export interface ASCIISparklineProps {
  /** Array of data points to plot */
  data: ChartDataPoint[];
  /** Height of chart in characters (default: 5) */
  height?: number;
  /** Width of chart in characters (default: 50) */
  width?: number;
  /** Label for the chart */
  label?: string;
  /** Show min/max labels (default: true) */
  showLabels?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Color variant */
  variant?: 'default' | 'success' | 'warning' | 'error';
}

/**
 * ASCII Sparkline Component
 * 
 * Renders a compact line chart using block characters
 * 
 * @example
 * <ASCIISparkline 
 *   data={[{x:0,y:4.5}, {x:1,y:4.0}, {x:2,y:3.5}]} 
 *   height={5} 
 *   width={20} 
 * />
 */
export function ASCIISparkline({
  data,
  height = 5,
  width = 50,
  label,
  showLabels = true,
  className = '',
  variant = 'default',
}: ASCIISparklineProps) {
  // Generate sparkline characters
  const sparkline = useMemo(() => {
    if (!data || data.length === 0) {
      return { lines: [], min: 0, max: 0 };
    }
    
    // Extract y values
    const values = data.map(d => d.y);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1; // Avoid division by zero
    
    // Create 2D grid for plotting
    const grid: string[][] = Array(height).fill(0).map(() => 
      Array(width).fill(' ')
    );
    
    // Plot points
    for (let i = 0; i < data.length && i < width; i++) {
      const value = data[i].y;
      const normalized = (value - min) / range; // 0 to 1
      const row = Math.floor((1 - normalized) * (height - 1)); // Invert for top-to-bottom
      
      // Use different characters for the line
      grid[row][i] = '●';
      
      // Connect points with lines
      if (i > 0) {
        const prevValue = data[i - 1].y;
        const prevNormalized = (prevValue - min) / range;
        const prevRow = Math.floor((1 - prevNormalized) * (height - 1));
        
        // Draw connecting line
        const startRow = Math.min(row, prevRow);
        const endRow = Math.max(row, prevRow);
        
        for (let r = startRow; r <= endRow; r++) {
          if (grid[r][i] === ' ' && grid[r][i - 1] === ' ') {
            grid[r][i] = r === row || r === prevRow ? '●' : '│';
          }
        }
      }
    }
    
    // Convert grid to strings
    const lines = grid.map(row => row.join(''));
    
    return { lines, min, max };
  }, [data, height, width]);
  
  // Determine color classes based on variant
  const variantClasses = {
    default: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };
  
  const colorClass = variantClasses[variant] || variantClasses.default;
  
  if (!data || data.length === 0) {
    return (
      <div className={`font-mono text-sm ${className}`}>
        {label && <div className="text-gray-400 mb-1">{label}</div>}
        <div className="text-gray-600">No data</div>
      </div>
    );
  }
  
  return (
    <div className={`font-mono text-sm ${className}`}>
      {label && <div className="text-gray-400 mb-1">{label}</div>}
      
      <div className={`${colorClass} leading-tight`}>
        {showLabels && (
          <div className="text-xs text-gray-500 mb-1">
            {sparkline.max.toFixed(2)}
          </div>
        )}
        
        {sparkline.lines.map((line, i) => (
          <div key={i} className="whitespace-pre">
            {line}
          </div>
        ))}
        
        {showLabels && (
          <div className="text-xs text-gray-500 mt-1">
            {sparkline.min.toFixed(2)}
          </div>
        )}
      </div>
      
      {showLabels && (
        <div className="text-xs text-gray-500 mt-1 flex justify-between">
          <span>0</span>
          <span>{data.length - 1}</span>
        </div>
      )}
    </div>
  );
}

export default ASCIISparkline;
