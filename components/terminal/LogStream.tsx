'use client';

/**
 * Log Stream Component
 * 
 * Displays scrolling log entries in terminal style
 * Phase 2: ASCII Rendering Components
 * 
 * Date: 2025-11-01
 */

import React, { useEffect, useRef } from 'react';
import { formatTime } from '@/lib/utils/terminal-format';
import type { LogEntry } from '@/lib/training/terminal-monitor.types';

export interface LogStreamProps {
  /** Array of log entries to display */
  logs: LogEntry[];
  /** Maximum number of lines to show (default: 6) */
  maxLines?: number;
  /** Auto-scroll to bottom on new entries (default: true) */
  autoScroll?: boolean;
  /** Show timestamps (default: true) */
  showTimestamps?: boolean;
  /** Show log levels (default: true) */
  showLevels?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Log Stream Component
 * 
 * Displays recent log entries with auto-scrolling
 * 
 * @example
 * <LogStream 
 *   logs={[
 *     { timestamp: '2025-11-01T14:32:15Z', level: 'info', message: 'Step 145/950' }
 *   ]} 
 *   maxLines={6}
 * />
 */
export function LogStream({
  logs,
  maxLines = 6,
  autoScroll = true,
  showTimestamps = true,
  showLevels = true,
  className = '',
}: LogStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLogsLengthRef = useRef(logs.length);
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && containerRef.current && logs.length > prevLogsLengthRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    prevLogsLengthRef.current = logs.length;
  }, [logs, autoScroll]);
  
  // Get last N logs
  const recentLogs = logs.slice(-maxLines);
  
  // Level color mapping
  const levelColors = {
    debug: 'text-gray-500',
    info: 'text-blue-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };
  
  // Level symbols
  const levelSymbols = {
    debug: '🔍',
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
  };
  
  console.log('[LogStream] Rendering with logs:', logs);
  console.log('[LogStream] recentLogs length:', recentLogs.length);
  console.log('[LogStream] recentLogs sample:', recentLogs[0]);

  if (recentLogs.length === 0) {
    return (
      <div className={`font-mono text-sm ${className}`}>
        <div className="text-gray-600">No logs available (received {logs.length} log entries)</div>
        <div className="text-gray-500 text-xs mt-2">
          Debug: logs array = {JSON.stringify(logs).substring(0, 100)}...
        </div>
      </div>
    );
  }
  
  return (
    <div
      ref={containerRef}
      className={`font-mono text-xs leading-relaxed overflow-y-auto ${className}`}
      style={{ maxHeight: '24rem', minHeight: '8rem' }}
    >
      {recentLogs.map((log, index) => {
        const levelColor = levelColors[log.level] || levelColors.info;
        const levelSymbol = levelSymbols[log.level] || '•';

        return (
          <div key={index} className="flex items-start gap-2 text-gray-300 hover:bg-gray-800 px-1 py-0.5">
            {showTimestamps && (
              <span className="text-gray-600 shrink-0 w-20 text-xs">
                [{formatTime(log.timestamp)}]
              </span>
            )}

            {showLevels && (
              <span className={`${levelColor} shrink-0 w-16 uppercase text-xs font-semibold`}>
                {levelSymbol} {log.level}
              </span>
            )}

            <span className="flex-1 break-words text-gray-200">
              {log.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default LogStream;
