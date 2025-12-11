/**
 * Execution List Component
 *
 * Displays list of DAG executions with status, duration, and filtering
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DagStatusBadge } from './DagStatusBadge';
import { JobStatus } from '@/lib/training/dag-orchestrator';
import { RefreshCw } from 'lucide-react';

interface Execution {
  id: string;
  name: string;
  status: JobStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
}

interface ExecutionListProps {
  onSelectExecution: (id: string) => void;
}

export function ExecutionList({ onSelectExecution }: ExecutionListProps) {
  console.log('[ExecutionList] Rendering component');

  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [autoRefresh] = useState(true);

  const fetchExecutions = useCallback(async () => {
    console.log('[ExecutionList] Fetching executions, filter:', statusFilter);

    try {
      const params = new URLSearchParams({
        limit: '50',
        offset: '0',
        status: statusFilter
      });

      const response = await fetch(`/api/training/dag/list?${params}`);
      const data = await response.json();

      if (data.success) {
        console.log('[ExecutionList] Loaded', data.executions.length, 'executions');
        setExecutions(data.executions);
      }
    } catch (error) {
      console.error('[ExecutionList] Error fetching executions:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  useEffect(() => {
    if (!autoRefresh) {
      console.log('[ExecutionList] Auto-refresh disabled, skipping interval setup');
      return;
    }

    const hasRunning = executions.some(e => e.status === 'running');
    console.log('[ExecutionList] Has running executions:', hasRunning, 'Total executions:', executions.length);

    if (!hasRunning) {
      console.log('[ExecutionList] No running executions, skipping interval setup');
      return;
    }

    console.log('[ExecutionList] Setting up auto-refresh interval (5s)');
    const interval = setInterval(() => {
      console.log('[ExecutionList] Auto-refreshing executions');
      fetchExecutions();
    }, 5000);

    return () => {
      console.log('[ExecutionList] Cleaning up auto-refresh interval');
      clearInterval(interval);
    };
  }, [autoRefresh, executions, fetchExecutions]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Executions</CardTitle>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as JobStatus | 'all')}
            className="text-xs border rounded px-2 py-1"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchExecutions}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            Loading executions...
          </div>
        ) : executions.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            No executions found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((execution) => (
                <TableRow key={execution.id}>
                  <TableCell className="font-medium">{execution.name}</TableCell>
                  <TableCell>
                    <DagStatusBadge status={execution.status} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {execution.completedJobs}/{execution.totalJobs}
                    {execution.failedJobs > 0 && (
                      <span className="text-red-600 ml-1">
                        ({execution.failedJobs} failed)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDate(execution.startedAt)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDuration(execution.duration)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectExecution(execution.id)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
