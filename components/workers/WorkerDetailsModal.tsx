/**
 * Worker Details Modal Component
 * Display detailed worker information, metrics, and commands
 * Date: 2025-12-30
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Activity, Terminal, Clock, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getPlatformDisplayName } from '@/lib/workers/types';
import type { WorkerDetails } from '@/lib/workers/types';

interface WorkerDetailsModalProps {
  workerId: string;
  sessionToken: string;
  onClose: () => void;
}

export function WorkerDetailsModal({ workerId, sessionToken, onClose }: WorkerDetailsModalProps) {
  const [details, setDetails] = useState<WorkerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workers/${workerId}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch worker details');
      }

      const data = await response.json();
      setDetails(data);
    } catch (err) {
      console.error('[Worker Details] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load details');
    } finally {
      setLoading(false);
    }
  }, [workerId, sessionToken]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'failed':
      case 'timeout':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'executing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold">Worker Details</h2>
            <p className="text-sm text-muted-foreground">
              {details?.worker.hostname || workerId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={fetchDetails} className="mt-2">
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && details && (
            <Tabs defaultValue="info">
              <TabsList>
                <TabsTrigger value="info" className="flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Info
                </TabsTrigger>
                <TabsTrigger value="metrics" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Metrics ({details.metrics.length})
                </TabsTrigger>
                <TabsTrigger value="commands" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Commands ({details.commands.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4">
                {/* Worker information display */}
                <div className="space-y-6">
                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                      details.worker.is_online
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                    }`}>
                      <Circle className={`h-2 w-2 ${
                        details.worker.is_online ? 'bg-green-600 dark:bg-green-400' : 'bg-gray-600 dark:bg-gray-400'
                      } fill-current`} />
                      {details.worker.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  {/* Basic Info Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Worker ID</span>
                      <div className="text-foreground mt-1 font-mono text-sm">{details.worker.worker_id}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Platform</span>
                      <div className="text-foreground mt-1 capitalize">{getPlatformDisplayName(details.worker.platform)}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Version</span>
                      <div className="text-foreground mt-1">v{details.worker.version}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Status</span>
                      <div className="text-foreground mt-1 capitalize">{details.worker.status}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Current Load</span>
                      <div className="text-foreground mt-1">
                        {details.worker.current_load} / {details.worker.max_concurrency}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Total Jobs</span>
                      <div className="text-foreground mt-1">{details.worker.total_commands_executed}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Total Errors</span>
                      <div className="text-foreground mt-1">{details.worker.total_errors}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Registered</span>
                      <div className="text-foreground mt-1">{formatTimestamp(details.worker.registered_at)}</div>
                    </div>
                  </div>

                  {/* Last Heartbeat */}
                  {details.worker.last_heartbeat && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Last Heartbeat</span>
                      <div className="text-foreground mt-1">{formatTimestamp(details.worker.last_heartbeat)}</div>
                    </div>
                  )}

                  {/* Capabilities */}
                  {details.worker.capabilities && details.worker.capabilities.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Capabilities</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {details.worker.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="metrics" className="mt-4">
                {/* Metrics display */}
                {details.metrics.length > 0 ? (
                  <div className="space-y-2">
                    {details.metrics.map((metric) => (
                      <div key={metric.id} className="border rounded-lg p-3">
                        <div className="text-xs text-muted-foreground mb-2">
                          {formatTimestamp(metric.timestamp)}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          {metric.cpu_percent !== null && (
                            <div>
                              <span className="text-muted-foreground">CPU:</span>{' '}
                              <span className="font-medium">{metric.cpu_percent.toFixed(1)}%</span>
                            </div>
                          )}
                          {metric.memory_used_mb !== null && metric.memory_total_mb !== null && (
                            <div>
                              <span className="text-muted-foreground">Memory:</span>{' '}
                              <span className="font-medium">
                                {metric.memory_used_mb.toFixed(0)} / {metric.memory_total_mb.toFixed(0)} MB
                              </span>
                            </div>
                          )}
                          {metric.disk_used_gb !== null && (
                            <div>
                              <span className="text-muted-foreground">Disk:</span>{' '}
                              <span className="font-medium">{metric.disk_used_gb.toFixed(1)} GB</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No metrics data yet</p>
                )}
              </TabsContent>

              <TabsContent value="commands" className="mt-4">
                {/* Commands display */}
                {details.commands.length > 0 ? (
                  <div className="space-y-2">
                    {details.commands.map((command) => (
                      <div key={command.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{command.command_type}</span>
                          <span className={`text-xs px-2 py-1 rounded ${getStatusColor(command.status)}`}>
                            {command.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Created: {formatTimestamp(command.created_at)}</div>
                          {command.started_at && (
                            <div>Started: {formatTimestamp(command.started_at)}</div>
                          )}
                          {command.completed_at && (
                            <div>Completed: {formatTimestamp(command.completed_at)}</div>
                          )}
                          {command.error_message && (
                            <div className="text-destructive mt-2">Error: {command.error_message}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No commands yet</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
