'use client';

/**
 * Terminal GPU Component
 * 
 * Displays GPU status with memory and utilization bars
 * Phase 3: Layout Assembly
 * 
 * Date: 2025-11-01
 */

import React from 'react';
import type { TerminalMetrics } from '@/lib/training/terminal-monitor.types';
import { ASCIIProgressBar } from './ASCIIProgressBar';
import { ASCIIBox } from './ASCIIBox';

export interface TerminalGPUProps {
  metrics: TerminalMetrics;
  className?: string;
}

export function TerminalGPU({ metrics, className = '' }: TerminalGPUProps) {
  // Default GPU status if not available
  const gpu = metrics.gpu || {
    memory_allocated_gb: 0,
    memory_reserved_gb: 0,
    memory_total_gb: 8,
    utilization_percent: 0,
    temperature_celsius: 0,
  };
  
  const memoryPercent = (gpu.memory_allocated_gb / gpu.memory_total_gb) * 100;
  const utilizationPercent = gpu.utilization_percent;
  
  // Memory variant based on usage
  let memoryVariant: 'default' | 'success' | 'warning' | 'error' = 'default';
  if (memoryPercent < 60) memoryVariant = 'success';
  else if (memoryPercent < 80) memoryVariant = 'warning';
  else memoryVariant = 'error';
  
  // Utilization variant
  let utilVariant: 'default' | 'success' | 'warning' | 'error' = 'default';
  if (utilizationPercent > 80) utilVariant = 'success';
  else if (utilizationPercent > 50) utilVariant = 'warning';
  else utilVariant = 'error';
  
  return (
    <ASCIIBox title="GPU STATUS" borderStyle="single" className={className}>
      <div className="space-y-4">
        {/* GPU name and temp */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">GPU 0</span>
          <span className="text-gray-400">
            {gpu.temperature_celsius ? `${gpu.temperature_celsius}°C` : 'N/A'}
          </span>
        </div>
        
        {/* Memory usage */}
        <div>
          <div className="text-gray-400 text-sm mb-1 flex items-center justify-between">
            <span>MEMORY</span>
            <span>
              {gpu.memory_allocated_gb.toFixed(2)} / {gpu.memory_total_gb.toFixed(2)} GB
            </span>
          </div>
          <ASCIIProgressBar
            value={memoryPercent}
            width={50}
            showPercentage
            variant={memoryVariant}
          />
        </div>
        
        {/* Utilization */}
        <div>
          <div className="text-gray-400 text-sm mb-1">UTILIZATION</div>
          <ASCIIProgressBar
            value={utilizationPercent}
            width={50}
            showPercentage
            variant={utilVariant}
          />
        </div>
      </div>
    </ASCIIBox>
  );
}

export default TerminalGPU;
