/**
 * Execution Logs Component
 *
 * Real-time log viewer using Server-Sent Events (SSE)
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogEntry } from './types';
import { Trash2, Download } from 'lucide-react';

interface ExecutionLogsProps {
  executionId: string;
}

export function ExecutionLogs({ executionId }: ExecutionLogsProps) {
  console.log('[ExecutionLogs] Rendering for execution:', executionId);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'error' | 'warn'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [connected, setConnected] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    console.log('[ExecutionLogs] Connecting to SSE for execution:', executionId);

    const eventSource = new EventSource(
      `/api/training/dag/logs/${executionId}`
    );

    eventSource.onopen = () => {
      console.log('[ExecutionLogs] SSE connection opened');
      setConnected(true);
    };

    eventSource.addEventListener('log', (event) => {
      console.log('[ExecutionLogs] Received log event');
      const logEntry: LogEntry = JSON.parse(event.data);
      setLogs(prev => [...prev, logEntry]);
    });

    eventSource.addEventListener('end', () => {
      console.log('[ExecutionLogs] Stream ended');
      eventSource.close();
      setConnected(false);
    });

    eventSource.onerror = (error) => {
      console.error('[ExecutionLogs] SSE error:', error);
      eventSource.close();
      setConnected(false);
    };

    eventSourceRef.current = eventSource;

    return () => {
      console.log('[ExecutionLogs] Cleaning up SSE connection');
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
      eventSourceRef.current = null;
    };
  }, [executionId]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter(log =>
    levelFilter === 'all' || log.level === levelFilter
  );

  const handleClear = () => {
    console.log('[ExecutionLogs] Clearing logs');
    setLogs([]);
  };

  const handleDownload = () => {
    console.log('[ExecutionLogs] Downloading logs');
    const logText = logs
      .map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.jobId}: ${log.message}`)
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-${executionId}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warn':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'info':
      default:
        return 'text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-medium">Logs</CardTitle>
          {connected && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}
            className="text-xs border rounded px-2 py-1"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={logs.length === 0}
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={logs.length === 0}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 p-2 h-96 overflow-y-auto font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 text-center py-4">
              {logs.length === 0 ? 'No logs yet...' : 'No logs match the selected filter'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-gray-400 dark:text-gray-600 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`font-semibold shrink-0 w-12 ${getLevelColor(log.level)}`}>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 shrink-0">
                    {log.jobId}:
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
