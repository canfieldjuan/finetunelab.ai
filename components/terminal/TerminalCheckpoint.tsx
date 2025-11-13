'use client';

/**
 * Terminal Checkpoint Component
 * 
 * Displays best checkpoint information
 * Phase 3: Layout Assembly
 * 
 * Date: 2025-11-01
 */

import React from 'react';
import type { TerminalMetrics } from '@/lib/training/terminal-monitor.types';
import { ASCIIBox } from './ASCIIBox';

export interface TerminalCheckpointProps {
  metrics: TerminalMetrics;
  className?: string;
}

export function TerminalCheckpoint({ metrics, className = '' }: TerminalCheckpointProps) {
  const checkpoint = metrics.best_checkpoint;
  
  if (!checkpoint) {
    return (
      <ASCIIBox title="BEST CHECKPOINT" borderStyle="single" className={className}>
        <div className="text-gray-500 text-sm">No checkpoint saved yet</div>
      </ASCIIBox>
    );
  }
  
  return (
    <ASCIIBox title="BEST CHECKPOINT" borderStyle="single" className={className}>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Epoch:</span>
          <span className="text-gray-200">{checkpoint.epoch}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Step:</span>
          <span className="text-gray-200">{checkpoint.step.toLocaleString()}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Eval Loss:</span>
          <span className="text-green-400 font-bold">
            {checkpoint.eval_loss !== null && checkpoint.eval_loss !== undefined 
              ? checkpoint.eval_loss.toFixed(4) 
              : 'N/A'}
          </span>
        </div>
        
        {checkpoint.train_loss !== undefined && checkpoint.train_loss !== null && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Train Loss:</span>
            <span className="text-gray-200">{checkpoint.train_loss.toFixed(4)}</span>
          </div>
        )}
        
        {checkpoint.saved_at && (
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-700">
            <span>Saved:</span>
            <span>{new Date(checkpoint.saved_at).toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </ASCIIBox>
  );
}

export default TerminalCheckpoint;
