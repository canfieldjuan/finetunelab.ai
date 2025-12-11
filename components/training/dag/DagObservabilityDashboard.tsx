/**
 * DAG Observability Dashboard
 * 
 * Real-time monitoring dashboard for DAG executions with:
 * - Live execution visualization
 * - Job-level progress tracking
 * - Performance metrics
 * - Error monitoring
 * - Historical trends
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Activity, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { JobStatus } from '@/lib/training/dag-orchestrator';

// Constants
const REFRESH_INTERVAL_MS = 2000;
const STATUS_COLORS = {
  pending: 'text-gray-500',
  running: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
  cancelled: 'text-orange-500',
  skipped: 'text-yellow-500',
} as const;

const STATUS_ICONS = {
  pending: Clock,
  running: Activity,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: AlertCircle,
  skipped: AlertCircle,
} as const;

// Types
interface ExecutionMetrics {
  id: string;
  name: string;
  status: JobStatus;
  startedAt: string;
  completedAt?: string;
  jobs: Map<string, JobMetrics>;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  skippedJobs: number;
  runningJobs: number;
  pendingJobs: number;
  duration?: number;
  averageJobDuration?: number;
  longestJob?: string;
  bottlenecks: string[];
}

interface JobMetrics {
  jobId: string;
  name: string;
  status: JobStatus;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  attempt: number;
  error?: string;
  progress?: number;
}

interface DagObservabilityDashboardProps {
  executionId?: string;
  autoRefresh?: boolean;
}

export function DagObservabilityDashboard({
  executionId,
  autoRefresh = true,
}: DagObservabilityDashboardProps) {
  const [metrics, setMetrics] = useState<ExecutionMetrics | null>(null);
  const [allExecutions, setAllExecutions] = useState<ExecutionMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch metrics for a specific execution
  const fetchExecutionMetrics = useCallback(async (id: string) => {
    console.log('[Observatory] Fetching metrics for execution:', id);

    try {
      const response = await fetch(`/api/training/dag/status/${id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch metrics');
      }

      const execution = data.execution;
      const jobsMap = new Map<string, JobMetrics>();
      let completedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      let runningCount = 0;
      let pendingCount = 0;
      let totalDuration = 0;
      let maxDuration = 0;
      let longestJobId = '';

      type JobData = {
        name?: string;
        status: JobStatus;
        startedAt?: string;
        completedAt?: string;
        attempt?: number;
        error?: string;
        progress?: number;
      };

      Object.entries(execution.jobs || {}).forEach(([jobId, jobData]) => {
        const job = jobData as JobData;
        const duration = job.startedAt && job.completedAt
          ? (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000
          : undefined;

        if (duration && duration > maxDuration) {
          maxDuration = duration;
          longestJobId = jobId;
        }

        if (duration) {
          totalDuration += duration;
        }

        jobsMap.set(jobId, {
          jobId,
          name: job.name || jobId,
          status: job.status,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          duration,
          attempt: job.attempt || 1,
          error: job.error,
          progress: job.progress,
        });

        if (job.status === 'completed') completedCount++;
        else if (job.status === 'failed') failedCount++;
        else if (job.status === 'skipped') skippedCount++;
        else if (job.status === 'running') runningCount++;
        else if (job.status === 'pending') pendingCount++;
      });

      const totalJobs = jobsMap.size;
      const avgDuration = completedCount > 0 ? totalDuration / completedCount : undefined;

      const executionDuration = execution.startedAt && execution.completedAt
        ? (new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000
        : execution.startedAt
        ? (Date.now() - new Date(execution.startedAt).getTime()) / 1000
        : undefined;

      const bottlenecks: string[] = [];
      if (avgDuration && maxDuration > avgDuration * 2) {
        bottlenecks.push(longestJobId);
      }

      const metricsData: ExecutionMetrics = {
        id: execution.id,
        name: execution.name,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        jobs: jobsMap,
        totalJobs,
        completedJobs: completedCount,
        failedJobs: failedCount,
        skippedJobs: skippedCount,
        runningJobs: runningCount,
        pendingJobs: pendingCount,
        duration: executionDuration,
        averageJobDuration: avgDuration,
        longestJob: longestJobId,
        bottlenecks,
      };

      console.log('[Observatory] Metrics computed:', {
        totalJobs,
        completed: completedCount,
        failed: failedCount,
        running: runningCount,
        duration: executionDuration,
      });

      setMetrics(metricsData);
      setError(null);
    } catch (err) {
      console.error('[Observatory] Error fetching metrics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  // Fetch all running executions
  const fetchAllExecutions = useCallback(async () => {
    console.log('[Observatory] Fetching all running executions');

    try {
      const response = await fetch('/api/training/dag/list?status=running&limit=10');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch executions');
      }

      const executionsData = await Promise.all(
        data.executions.map(async (exec: { id: string }) => {
          const statusResponse = await fetch(`/api/training/dag/status/${exec.id}`);
          const statusData = await statusResponse.json();
          return statusData.execution;
        })
      );

      console.log('[Observatory] Loaded', executionsData.length, 'running executions');
      setAllExecutions(executionsData as ExecutionMetrics[]);
    } catch (err) {
      console.error('[Observatory] Error fetching all executions:', err);
    }
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (executionId) {
      fetchExecutionMetrics(executionId);
    } else {
      fetchAllExecutions();
      setLoading(false);
    }
  }, [executionId, fetchExecutionMetrics, fetchAllExecutions]);

  useEffect(() => {
    if (!autoRefresh) {
      console.log('[Observatory] Auto-refresh disabled');
      return;
    }

    const hasRunningJobs = metrics?.runningJobs && metrics.runningJobs > 0;
    const isRunning = metrics?.status === 'running';

    if (!hasRunningJobs && !isRunning && executionId) {
      console.log('[Observatory] No active jobs, skipping auto-refresh');
      return;
    }

    console.log('[Observatory] Setting up auto-refresh interval');
    const interval = setInterval(() => {
      if (executionId) {
        fetchExecutionMetrics(executionId);
      } else {
        fetchAllExecutions();
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      console.log('[Observatory] Cleaning up auto-refresh');
      clearInterval(interval);
    };
  }, [autoRefresh, metrics, executionId, fetchExecutionMetrics, fetchAllExecutions]);

  // Helper functions
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (minutes < 60) return `${minutes}m ${secs}s`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getStatusIcon = (status: JobStatus) => {
    const Icon = STATUS_ICONS[status];
    return Icon;
  };

  const getCompletionPercentage = () => {
    if (!metrics || metrics.totalJobs === 0) return 0;
    return Math.round(((metrics.completedJobs + metrics.skippedJobs) / metrics.totalJobs) * 100);
  };

  const manualRefresh = () => {
    if (executionId) {
      fetchExecutionMetrics(executionId);
    } else {
      fetchAllExecutions();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Loading metrics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center text-red-500">
            <AlertCircle className="w-6 h-6 mr-2" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!executionId && allExecutions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">
            No active executions
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">DAG Observability Dashboard</h2>
          <p className="text-sm text-gray-500">
            Real-time monitoring and metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={manualRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {metrics && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {React.createElement(getStatusIcon(metrics.status), {
                      className: `w-6 h-6 ${STATUS_COLORS[metrics.status]}`,
                    })}
                    <span className="text-2xl font-bold capitalize">
                      {metrics.status}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold">
                      {getCompletionPercentage()}%
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${getCompletionPercentage()}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      {metrics.completedJobs + metrics.skippedJobs}/{metrics.totalJobs} jobs
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Duration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatDuration(metrics.duration)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Avg: {formatDuration(metrics.averageJobDuration)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Jobs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-600">Completed:</span>
                      <span className="font-medium">{metrics.completedJobs}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">Running:</span>
                      <span className="font-medium">{metrics.runningJobs}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">Failed:</span>
                      <span className="font-medium">{metrics.failedJobs}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Job Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.from(metrics.jobs.values()).map((job) => {
                    const Icon = getStatusIcon(job.status);
                    return (
                      <div
                        key={job.jobId}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Icon className={`w-5 h-5 ${STATUS_COLORS[job.status]}`} />
                          <div className="flex-1">
                            <div className="font-medium">{job.name}</div>
                            <div className="text-xs text-gray-500">
                              {job.jobId}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium capitalize">
                            {job.status}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDuration(job.duration)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium mb-2">Job Duration Distribution</div>
                    <div className="space-y-2">
                      {Array.from(metrics.jobs.values())
                        .filter((j) => j.duration)
                        .sort((a, b) => (b.duration || 0) - (a.duration || 0))
                        .slice(0, 5)
                        .map((job) => (
                          <div key={job.jobId} className="flex items-center gap-2">
                            <div className="w-32 text-sm truncate">{job.name}</div>
                            <div className="flex-1 bg-gray-200 rounded-full h-4">
                              <div
                                className="bg-blue-600 h-4 rounded-full flex items-center justify-end pr-2"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    ((job.duration || 0) / (metrics.duration || 1)) * 100
                                  )}%`,
                                }}
                              >
                                <span className="text-xs text-white font-medium">
                                  {formatDuration(job.duration)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {metrics.bottlenecks.length > 0 && (
                    <div className="border-t pt-4">
                      <div className="text-sm font-medium mb-2 text-orange-600">
                        ⚠️ Potential Bottlenecks
                      </div>
                      <div className="space-y-1">
                        {metrics.bottlenecks.map((jobId) => {
                          const job = metrics.jobs.get(jobId);
                          return (
                            <div key={jobId} className="text-sm text-gray-600">
                              • {job?.name} ({formatDuration(job?.duration)})
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Errors Tab */}
          <TabsContent value="errors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Failed Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.failedJobs === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    No failed jobs
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Array.from(metrics.jobs.values())
                      .filter((j) => j.status === 'failed')
                      .map((job) => (
                        <div
                          key={job.jobId}
                          className="p-3 border border-red-200 rounded-lg bg-red-50"
                        >
                          <div className="flex items-start gap-2">
                            <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                            <div className="flex-1">
                              <div className="font-medium text-red-900">{job.name}</div>
                              <div className="text-xs text-red-700 mt-1">
                                {job.jobId}
                              </div>
                              {job.error && (
                                <div className="mt-2 text-sm text-red-800 bg-red-100 p-2 rounded">
                                  {job.error}
                                </div>
                              )}
                              <div className="text-xs text-red-600 mt-2">
                                Attempt: {job.attempt}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
