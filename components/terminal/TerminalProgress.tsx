'use client';

/**
 * Terminal Progress Component
 * 
 * Displays epoch and step progress bars
 * Phase 3: Layout Assembly
 * 
 * Date: 2025-11-01
 */

import React from 'react';
import type { TerminalMetrics } from '@/lib/training/terminal-monitor.types';
import { ASCIIProgressBar } from './ASCIIProgressBar';

export interface TerminalProgressProps {
  metrics: TerminalMetrics;
  className?: string;
}

export function TerminalProgress({ metrics, className = '' }: TerminalProgressProps) {
  // Safely handle null/undefined values
  const totalEpochs = metrics.total_epochs || 1;
  const totalSteps = metrics.total_steps || 1;
  const currentEpoch = metrics.current_epoch || 0;
  const currentStep = metrics.current_step || 0;
  
  const epochPercent = (currentEpoch / totalEpochs) * 100;
  const stepPercent = (currentStep / totalSteps) * 100;
  const overallProgress = Math.round(epochPercent); // Overall = epoch completion
  
  return (
    <div className={`font-mono space-y-3 ${className}`}>
      {/* Epoch progress */}
      <div>
        <div className="text-gray-400 text-sm mb-1">
          EPOCH: {currentEpoch} / {totalEpochs}
        </div>
        <ASCIIProgressBar
          value={epochPercent}
          width={60}
          showPercentage
          variant={epochPercent === 100 ? 'success' : 'default'}
        />
      </div>
      
      {/* Step progress */}
      <div>
        <div className="text-gray-400 text-sm mb-1">
          STEP: {currentStep.toLocaleString()} / {totalSteps.toLocaleString()}
        </div>
        <ASCIIProgressBar
          value={stepPercent}
          width={60}
          showPercentage
          variant={stepPercent === 100 ? 'success' : 'default'}
        />
      </div>
      
      {/* Overall completion */}
      <div className="pt-2 border-t border-gray-700">
        <div className="text-gray-400 text-sm mb-1">OVERALL PROGRESS</div>
        <ASCIIProgressBar
          value={overallProgress}
          width={60}
          showPercentage
          variant={overallProgress === 100 ? 'success' : 'default'}
        />
      </div>
    </div>
  );
}

export default TerminalProgress;
