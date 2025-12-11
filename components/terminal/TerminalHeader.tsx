'use client';

/**
 * Terminal Header Component
 * 
 * Displays job info, model, dataset, and status at top of terminal
 * Phase 3: Layout Assembly
 * 
 * Date: 2025-11-01
 */

import React from 'react';
import type { TerminalMetrics } from '@/lib/training/terminal-monitor.types';
import { STATUS_SYMBOLS } from '@/lib/training/terminal-monitor.types';
import { formatTime } from '@/lib/utils/terminal-format';

export interface TerminalHeaderProps {
  metrics: TerminalMetrics;
  className?: string;
  /** Optional callback for cancel action */
  onCancel?: () => void;
  /** Optional callback for pause action */
  onPause?: () => void;
  /** Optional callback for resume action */
  onResume?: () => void;
}

export function TerminalHeader({ 
  metrics, 
  className = '', 
  onCancel,
  onPause,
  onResume 
}: TerminalHeaderProps) {
  const statusSymbol = STATUS_SYMBOLS[metrics.status] || '•';

  const statusColors = {
    queued: 'text-purple-400',
    pending: 'text-yellow-400',
    running: 'text-blue-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
    cancelled: 'text-orange-400',
    paused: 'text-amber-400',
  };

  const statusColor = statusColors[metrics.status] || 'text-gray-400';

  // Show pause button for running jobs
  const canPause = onPause && metrics.status === 'running';

  // Show resume button for paused jobs
  const canResume = onResume && metrics.status === 'paused';

  // Show cancel button for active jobs
  const canCancel = onCancel && (
    metrics.status === 'queued' ||
    metrics.status === 'pending' ||
    metrics.status === 'running' ||
    metrics.status === 'paused'
  );

  return (
    <div className={`font-mono ${className}`}>
      <div className="px-6 py-3">
        <div className="max-w-7xl mx-auto">
          {/* Title bar */}
          <div className="bg-gray-800 border-b-2 border-gray-700 px-6 py-3 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-green-400 font-bold text-lg">⚡ Training Monitor</span>
              <span className="text-gray-500">│</span>
              <span className="text-gray-400 text-sm font-mono">Job: {metrics.job_id.slice(0, 8)}...</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">Status:</span>
                <span className={`${statusColor} font-bold uppercase flex items-center gap-1.5 px-3 py-1.5 rounded-md border ${statusColor.replace('text-', 'bg-')}/10 ${statusColor.replace('text-', 'border-')}/30`}>
                  {statusSymbol} {metrics.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Pause button for running jobs */}
                {canPause && (
                  <button
                    onClick={onPause}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-1.5 rounded-md text-sm transition-colors duration-200 shadow-lg shadow-amber-600/20"
                    title="Pause training job (Keyboard: P)"
                  >
                    ⏸ Pause
                  </button>
                )}

                {/* Resume button for paused jobs */}
                {canResume && (
                  <button
                    onClick={onResume}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-1.5 rounded-md text-sm transition-colors duration-200 shadow-lg shadow-green-600/20"
                    title="Resume training job (Keyboard: U)"
                  >
                    ▶ Resume
                  </button>
                )}

                {/* Cancel button for active jobs */}
                {canCancel && (
                  <button
                    onClick={onCancel}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-1.5 rounded-md text-sm transition-colors duration-200 shadow-lg shadow-red-600/20"
                    title="Cancel training job (Keyboard: C)"
                  >
                    ⏹ Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Info panel */}
          <div className="bg-gray-900 border-b border-x border-gray-700 rounded-b-lg px-6 py-4">
            <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <span className="text-gray-500">MODEL:</span>{' '}
            <span className="text-gray-200">{metrics.model_name}</span>
          </div>
          <div>
            <span className="text-gray-500">DATASET:</span>{' '}
            <span className="text-gray-200">
              {metrics.dataset_name} ({metrics.dataset_samples.toLocaleString()} samples)
            </span>
            {metrics.dataset_id && (
              <div className="text-gray-500 text-xs mt-0.5">
                ID: {metrics.dataset_id}
              </div>
            )}
          </div>
          <div>
            <span className="text-gray-500">STARTED:</span>{' '}
            <span className="text-gray-200">
              {metrics.started_at ? formatTime(metrics.started_at) : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">ELAPSED:</span>{' '}
            <span className="text-gray-200">
              {Math.floor(metrics.elapsed_seconds / 60)}m {metrics.elapsed_seconds % 60}s
            </span>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TerminalHeader;
