'use client';

/**
 * Terminal Monitor - Main Component
 * 
 * Assembles all terminal UI components into cohesive monitor
 * Phase 3: Layout Assembly
 * 
 * Date: 2025-11-01
 */

import React from 'react';
import type { TerminalMetrics } from '@/lib/training/terminal-monitor.types';
import { TerminalHeader } from './TerminalHeader';
import { TerminalProgress } from './TerminalProgress';
import { TerminalMetrics as TerminalMetricsPanel } from './TerminalMetrics';
import { TerminalGPU } from './TerminalGPU';
import { TerminalPerformance } from './TerminalPerformance';
import { TerminalCheckpoint } from './TerminalCheckpoint';
import { LogStream } from './LogStream';
import { KeyboardShortcuts } from './KeyboardShortcuts';

export interface TerminalMonitorProps {
  /** Training metrics data */
  metrics: TerminalMetrics;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string;
  /** Callback for cancel action */
  onCancel?: () => void;
  /** Callback for pause action */
  onPause?: () => void;
  /** Callback for resume action */
  onResume?: () => void;
  /** Custom CSS class */
  className?: string;
}

export function TerminalMonitor({
  metrics,
  loading = false,
  error,
  onCancel,
  onPause,
  onResume,
  className = '',
}: TerminalMonitorProps) {
  // Keyboard shortcuts
  const shortcuts = [
    { key: 'R', label: 'Refresh', action: () => window.location.reload() },
    ...(onCancel ? [{ key: 'C', label: 'Cancel', action: onCancel }] : []),
    ...(onPause ? [{ key: 'P', label: 'Pause', action: onPause }] : []),
    ...(onResume ? [{ key: 'U', label: 'Resume', action: onResume }] : []),
  ];
  
  // Loading state
  if (loading && !metrics) {
    return (
      <div className={`bg-[#0a0a0a] text-green-400 font-mono p-8 ${className}`}>
        <div className="text-center max-w-4xl mx-auto">
          <div className="text-2xl mb-4">▒▒▒ LOADING ▒▒▒</div>
          <div className="text-sm text-gray-500">Connecting to training server...</div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className={`bg-[#0a0a0a] text-red-400 font-mono p-8 ${className}`}>
        <div className="max-w-4xl mx-auto">
          <div className="border-2 border-red-500 rounded-lg p-6">
            <div className="text-xl mb-2">❌ ERROR</div>
            <div className="text-sm">{error}</div>
          </div>
        </div>
      </div>
    );
  }
  
  // No metrics
  if (!metrics) {
    return (
      <div className={`bg-[#0a0a0a] text-yellow-400 font-mono p-8 ${className}`}>
        <div className="text-center max-w-4xl mx-auto">No metrics available</div>
      </div>
    );
  }
  
  return (
    <div className={`bg-[#0a0a0a] text-gray-100 font-mono ${className}`}>
      {/* Header */}
      <TerminalHeader 
        metrics={metrics} 
        onCancel={onCancel}
        onPause={onPause}
        onResume={onResume}
      />

      {/* Warning Banner for Stale Jobs */}
      {metrics.warning && (
        <div className="mx-4 mt-4 bg-yellow-900/30 border-2 border-yellow-500/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-yellow-400 text-xl mt-0.5">⚠️</div>
            <div className="flex-1">
              <div className="text-yellow-400 font-bold mb-1">WARNING</div>
              <div className="text-yellow-200 text-sm mb-3">{metrics.warning}</div>
              <button
                onClick={() => window.location.reload()}
                className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-4 py-2 rounded-md text-sm transition-colors duration-200"
              >
                🔄 Refresh Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content - centered with standard width */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Terminal Logs - Full width at top */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 shadow-lg shadow-black/20">
            <div className="text-gray-400 text-sm mb-4 font-bold tracking-wide border-b border-gray-700/50 pb-2">
              📋 TERMINAL LOGS
              <span className="ml-2 text-xs text-gray-600">
                ({metrics.recent_logs?.length || 0} entries)
              </span>
            </div>
            <LogStream
              logs={metrics.recent_logs || []}
              maxLines={100}
              autoScroll
              showTimestamps
              showLevels
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left column - Progress & Metrics */}
          <div className="space-y-6">
            {/* Progress section */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 shadow-lg shadow-black/20">
              <div className="text-gray-400 text-sm mb-4 font-bold tracking-wide border-b border-gray-700/50 pb-2">
                📊 TRAINING PROGRESS
              </div>
              <TerminalProgress metrics={metrics} />
            </div>
            
            {/* Metrics section */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 shadow-lg shadow-black/20">
              <div className="text-gray-400 text-sm mb-4 font-bold tracking-wide border-b border-gray-700/50 pb-2">
                📈 LOSS & LEARNING
              </div>
              <TerminalMetricsPanel metrics={metrics} />
            </div>
          </div>
          
          {/* Right column - GPU, Performance */}
          <div className="flex flex-col gap-6">
            {/* GPU status */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 shadow-lg shadow-black/20">
              <div className="text-gray-400 text-sm mb-4 font-bold tracking-wide border-b border-gray-700/50 pb-2">
                🎮 GPU STATUS
              </div>
              <TerminalGPU metrics={metrics} />
            </div>

            {/* Performance metrics - flex-1 to fill remaining space */}
            <div className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-5 shadow-lg shadow-black/20">
              <div className="text-gray-400 text-sm mb-4 font-bold tracking-wide border-b border-gray-700/50 pb-2">
                ⚡ PERFORMANCE
              </div>
              <TerminalPerformance metrics={metrics} />
            </div>
          </div>

          {/* Full width - Checkpoint */}
          <div className="xl:col-span-2">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 shadow-lg shadow-black/20">
              <div className="text-gray-400 text-sm mb-4 font-bold tracking-wide border-b border-gray-700/50 pb-2">
                💾 CHECKPOINT
              </div>
              <TerminalCheckpoint metrics={metrics} />
            </div>
          </div>

          {/* Keyboard shortcuts */}
          <div className="xl:col-span-2">
            <KeyboardShortcuts actions={shortcuts} compact className="text-xs" />
          </div>
        </div>
        </div>
      </div>
      
      {/* Loading overlay for updates */}
      {loading && (
        <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-xs shadow-lg">
          <span className="text-green-400">●</span> Updating...
        </div>
      )}
    </div>
  );
}

export default TerminalMonitor;
