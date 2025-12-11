/**
 * Execution Detail Component
 *
 * Comprehensive view of a DAG execution with status, jobs, logs, and metrics
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DagStatusBadge } from './DagStatusBadge';
import { DagProgressBar } from './DagProgressBar';
import { ExecutionLogs } from './ExecutionLogs';
import { ExecutionStatusResponse } from './types';
import { X, RefreshCw } from 'lucide-react';

interface ExecutionDetailProps {
  executionId: string;
  onClose: () => void;
}

export function ExecutionDetail({ executionId, onClose }: ExecutionDetailProps) {
  console.log('[ExecutionDetail] Rendering for execution:', executionId);

  const [execution, setExecution] = useState<ExecutionStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh] = useState(true);

  const fetchExecution = useCallback(async () => {
    console.log('[ExecutionDetail] Fetching execution status');

    try {
      const response = await fetch(`/api/training/dag/status/${executionId}`);
      const data = await response.json();

      if (data.success) {
        console.log('[ExecutionDetail] Loaded execution:', data.name, data.status);
        setExecution(data);
      }
    } catch (error) {
      console.error('[ExecutionDetail] Error fetching execution:', error);
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => {
    fetchExecution();
  }, [fetchExecution]);

  useEffect(() => {
    if (!autoRefresh || !execution) return;

    if (execution.status === 'running' || execution.status === 'pending') {
      const interval = setInterval(() => {
        console.log('[ExecutionDetail] Auto-refreshing execution status');
        fetchExecution();
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, execution, fetchExecution]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500 dark:text-gray-400">
            Loading execution details...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!execution) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-red-600 dark:text-red-400">
            Failed to load execution details
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">{execution.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchExecution}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Status
              </div>
              <DagStatusBadge status={execution.status} />
            </div>

            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Progress
              </div>
              <DagProgressBar progress={execution.progress} showPercentage />
            </div>

            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Jobs
              </div>
              <div className="text-sm font-medium">
                {execution.completedJobs}/{execution.totalJobs}
                {execution.failedJobs > 0 && (
                  <span className="text-red-600 dark:text-red-400 ml-1">
                    ({execution.failedJobs} failed)
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Duration
              </div>
              <div className="text-sm font-medium">
                {formatDuration(execution.duration)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Started:</span>{' '}
              <span className="text-gray-900 dark:text-gray-100">
                {formatDate(execution.startedAt)}
              </span>
            </div>
            {execution.completedAt && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Completed:</span>{' '}
                <span className="text-gray-900 dark:text-gray-100">
                  {formatDate(execution.completedAt)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Job Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {execution.jobs.map((job) => (
              <div
                key={job.jobId}
                className="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{job.jobId}</div>
                  {job.error && (
                    <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {job.error}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <DagStatusBadge status={job.status} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ExecutionLogs executionId={executionId} />
    </div>
  );
}
