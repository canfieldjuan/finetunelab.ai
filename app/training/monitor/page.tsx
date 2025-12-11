'use client';

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TrainingDashboard } from '@/components/training/TrainingDashboard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, Pause, Play, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import type { TrainingJobStatus } from '@/lib/services/training-providers/local.provider';
import { useTrainingJobsRealtime } from '@/lib/hooks/useTrainingJobsRealtime';
import { useFreshToken } from '@/hooks/useFreshToken';
import { STATUS } from '@/lib/constants';
import { TrainingMetricsProvider } from '@/contexts/TrainingMetricsContext';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AgentStatus } from '@/components/training/AgentStatus';
import { ComparisonModal } from '@/components/training/ComparisonModal';

// Lazy load chart components to reduce initial bundle size and memory usage
const LossChart = dynamic(() => import('@/components/training/LossChart').then(mod => ({ default: mod.LossChart })), {
  loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const LearningRateChart = dynamic(() => import('@/components/training/LearningRateChart').then(mod => ({ default: mod.LearningRateChart })), {
  loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const GradNormChart = dynamic(() => import('@/components/training/GradNormChart').then(mod => ({ default: mod.GradNormChart })), {
  loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const ThroughputChart = dynamic(() => import('@/components/training/ThroughputChart').then(mod => ({ default: mod.ThroughputChart })), {
  loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const GPUMemoryReservedChart = dynamic(() => import('@/components/training/GPUMemoryReservedChart').then(mod => ({ default: mod.GPUMemoryReservedChart })), {
  loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const GPUUtilizationChart = dynamic(() => import('@/components/training/GPUUtilizationChart').then(mod => ({ default: mod.GPUUtilizationChart })), {
  loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const PerplexityChart = dynamic(() => import('@/components/training/PerplexityChart').then(mod => ({ default: mod.PerplexityChart })), {
  loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const MetricsOverviewCard = dynamic(() => import('@/components/training/MetricsOverviewCard').then(mod => ({ default: mod.MetricsOverviewCard })), {
  loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const BestModelCard = dynamic(() => import('@/components/training/BestModelCard').then(mod => ({ default: mod.BestModelCard })), {
  loading: () => <div className="h-32 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const DeployModelButton = dynamic(() => import('@/components/training/DeployModelButton').then(mod => ({ default: mod.DeployModelButton })), {
  loading: () => <div className="h-12 bg-muted animate-pulse rounded-lg w-48" />,
  ssr: false
});


const CheckpointResumeCard = dynamic(() => import('@/components/training/CheckpointResumeCard').then(mod => ({ default: mod.CheckpointResumeCard })), {
  loading: () => <div className="h-48 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const JobRecoveryCard = dynamic(() => import('@/components/training/JobRecoveryCard').then(mod => ({ default: mod.JobRecoveryCard })), {
  loading: () => <div className="h-48 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const RuntimeParameterControls = dynamic(() => import('@/components/training/RuntimeParameterControls').then(mod => ({ default: mod.RuntimeParameterControls })), {
  loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const PredictionsTable = dynamic(() => import('@/components/training/PredictionsTable').then(mod => ({ default: mod.PredictionsTable })), {
  loading: () => <div className="h-96 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const PredictionsComparison = dynamic(() => import('@/components/training/PredictionsComparison').then(mod => ({ default: mod.PredictionsComparison })), {
  loading: () => <div className="h-96 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const PredictionsTrendsChart = dynamic(() => import('@/components/training/PredictionsTrendsChart').then(mod => ({ default: mod.PredictionsTrendsChart })), {
  loading: () => <div className="h-96 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

function TrainingMonitorPageContent() {
  const searchParams = useSearchParams();
  const urlJobId = searchParams?.get('jobId') || null;
  const { user, session, signOut, loading: authLoading } = useAuth();
  const getFreshToken = useFreshToken();

  // Poll interval configuration from environment variables
  const dashboardPollInterval = parseInt(process.env.NEXT_PUBLIC_DASHBOARD_POLL_INTERVAL_MS || '15000', 10);
  const metricsPollInterval = parseInt(process.env.NEXT_PUBLIC_METRICS_POLL_INTERVAL_MS || '30000', 10);

  const [jobId, setJobId] = useState<string>(urlJobId || '');
  const [inputJobId, setInputJobId] = useState<string>(urlJobId || '');
  const [currentStatus, setCurrentStatus] = useState<TrainingJobStatus | null>(null);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(!!urlJobId);
  const [isTrainingActive, setIsTrainingActive] = useState<boolean>(false);
  const [isCloudJob, setIsCloudJob] = useState<boolean>(false);

  // Filter and search state
  const [statusFilter, setStatusFilter] = useState<string>(STATUS.ALL);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAllJobs, setShowAllJobs] = useState<boolean>(false);

  // Comparison features state
  const [groupByModel, setGroupByModel] = useState<boolean>(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [showComparisonModal, setShowComparisonModal] = useState<boolean>(false);

  // Use real-time hook for jobs list
  // Pass session?.access_token directly so hooks receive fresh tokens on refresh
  const {
    jobs: recentJobs,
    isConnected,
    isLoading: loadingJobs
  } = useTrainingJobsRealtime(user?.id, session?.access_token);

  // Debug logging (only in development to prevent excessive re-compilation)
  if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
    console.log('[TrainingMonitor] State:', {
      jobId,
      isMonitoring,
      isTrainingActive,
      isConnected,
      jobsCount: recentJobs.length
    });
  }

  // Filter and search jobs
  const filteredJobs = useMemo(() => {
    const filtered = recentJobs.filter(job => {
      // Status filter
      if (statusFilter !== STATUS.ALL && job.status !== statusFilter) {
        return false;
      }

      // Search filter (search in model name and job ID)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const modelName = job.model_name?.toLowerCase() || '';
        const jobIdMatch = job.id.toLowerCase().includes(query);
        const modelNameMatch = modelName.includes(query);

        if (!jobIdMatch && !modelNameMatch) {
          return false;
        }
      }

      return true;
    });

    // If filters are active or user clicked "Show All", show all filtered results
    // Otherwise, limit to 5 most recent
    const hasActiveFilters = statusFilter !== STATUS.ALL || searchQuery.trim() !== '';
    if (hasActiveFilters || showAllJobs) {
      return filtered;
    }

    return filtered.slice(0, 5);
  }, [recentJobs, statusFilter, searchQuery, showAllJobs]);

  // Track if there are more jobs to show
  const hasMoreJobs = useMemo(() => {
    const hasActiveFilters = statusFilter !== STATUS.ALL || searchQuery.trim() !== '';
    if (hasActiveFilters || showAllJobs) {
      return false;
    }
    return recentJobs.length > 5;
  }, [recentJobs, statusFilter, searchQuery, showAllJobs]);

  // Group jobs by model when groupByModel is true
  const groupedJobs = useMemo(() => {
    if (!groupByModel) {
      return { 'All Jobs': filteredJobs };
    }

    const groups: Record<string, typeof filteredJobs> = {};

    filteredJobs.forEach(job => {
      const modelKey = job.model_name || 'Unknown Model';
      if (!groups[modelKey]) {
        groups[modelKey] = [];
      }
      groups[modelKey].push(job);
    });

    return groups;
  }, [filteredJobs, groupByModel]);

  // Find best run in each group (lowest best_eval_loss)
  const bestRunPerGroup = useMemo(() => {
    const bestRuns: Record<string, string> = {}; // modelKey -> jobId

    Object.entries(groupedJobs).forEach(([modelKey, jobs]) => {
      const bestJob = jobs.reduce((best, job) => {
        const jobLoss = job.best_eval_loss ?? Infinity;
        const bestLoss = best.best_eval_loss ?? Infinity;
        return jobLoss < bestLoss ? job : best;
      }, jobs[0]);

      if (bestJob) {
        bestRuns[modelKey] = bestJob.id;
      }
    });

    return bestRuns;
  }, [groupedJobs]);

  // Reset "show all" when filters change
  useEffect(() => {
    if (statusFilter !== STATUS.ALL || searchQuery.trim() !== '') {
      setShowAllJobs(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    if (currentStatus) {
      const isActive = currentStatus.status === STATUS.RUNNING || currentStatus.status === STATUS.PENDING;
      setIsTrainingActive(prev => {
        if (prev !== isActive && process.env.NODE_ENV === 'development') {
          console.log('[TrainingMonitor] Status changed to:', currentStatus.status);
        }
        return isActive;
      });
    } else {
      setIsTrainingActive(false);
    }
  }, [currentStatus]);

  // Check if this is a cloud job (RunPod/Lambda) to hide local-only UI elements
  useEffect(() => {
    const checkIfCloudJob = async () => {
      if (!jobId || !user) return;

      try {
        const token = getFreshToken();
        if (!token) return;

        const response = await fetch(`/api/training/cloud-check/${jobId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setIsCloudJob(data.isCloudJob || false);
        }
      } catch (err) {
        console.error('[TrainingMonitor] Error checking cloud job status:', err);
      }
    };

    checkIfCloudJob();
  }, [jobId, user, getFreshToken]);

  const handleStartMonitoring = () => {
    if (!inputJobId.trim()) {
      alert('Please enter a valid Job ID');
      return;
    }
    console.log('[TrainingMonitor] Starting monitoring for:', inputJobId);
    setJobId(inputJobId.trim());
    setIsMonitoring(true);
  };

  const handleJobComplete = useCallback((finalStatus: TrainingJobStatus) => {
    console.log('[TrainingMonitor] Job completed:', finalStatus.status);
    setCurrentStatus(finalStatus);
    // Real-time hook will automatically update the jobs list
  }, []);

  const handleStatusUpdate = useCallback((newStatus: TrainingJobStatus) => {
    // Only update if there's a meaningful change
    setCurrentStatus(prevStatus => {
      if (!prevStatus) return newStatus;
      
      // Check if key fields changed
      const hasChanged = 
        prevStatus.status !== newStatus.status ||
        prevStatus.current_step !== newStatus.current_step ||
        prevStatus.current_epoch !== newStatus.current_epoch;
      
      return hasChanged ? newStatus : prevStatus;
    });
  }, []);

  const sendJobControlRequest = async (action: 'cancel' | 'pause' | 'resume') => {
    if (!jobId) {
      throw new Error('No training job selected');
    }

    const token = getFreshToken();
    if (!token) {
      throw new Error('Session expired. Please sign in again.');
    }

    const response = await fetch(`/api/training/local/${jobId}/control`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action }),
    });

    type JobControlResponse = {
      success?: boolean;
      error?: string;
      message?: string;
      result?: unknown;
    } | null;

    const result: JobControlResponse = await response.json().catch(() => null);

    if (!response.ok || result?.success === false) {
      throw new Error(result?.error || result?.message || `Failed to ${action} training job.`);
    }

    console.log(`[TrainingMonitor] ${action} result:`, result);
    return result;
  };

  const handlePauseJob = async () => {
    if (!jobId) return;

    try {
      console.log('[TrainingMonitor] Pausing job:', jobId);
      await sendJobControlRequest('pause');

      alert('Training job paused successfully');

      if (currentStatus) {
        setCurrentStatus({
          ...currentStatus,
          status: STATUS.PAUSED,
        });
      }
    } catch (err) {
      console.error('[TrainingMonitor] Pause error:', err);
      alert(err instanceof Error ? err.message : 'Failed to pause training job. Please try again.');
    }
  };

  const handleResumeJob = async () => {
    if (!jobId) return;

    try {
      console.log('[TrainingMonitor] Resuming job:', jobId);
      await sendJobControlRequest('resume');

      alert('Training job resumed successfully');

      if (currentStatus) {
        setCurrentStatus({
          ...currentStatus,
          status: STATUS.RUNNING,
        });
      }
    } catch (err) {
      console.error('[TrainingMonitor] Resume error:', err);
      alert(err instanceof Error ? err.message : 'Failed to resume training job. Please try again.');
    }
  };

  // Loading state - show while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          </div>
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Initializing authentication</p>
        </div>
      </div>
    );
  }

  // Authentication check
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-muted-foreground mb-6">
            Please log in to access the training monitor.
          </p>
          <Link href="/">
            <Button>Go to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!isMonitoring) {
    return (
      <div className="flex h-screen overflow-hidden">
        <AppSidebar currentPage="training" user={user} signOut={signOut} />
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 bg-background min-h-full">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <Link href="/training" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Training
                </Link>
                <AgentStatus />
              </div>

              <div className="bg-card border border-border rounded-lg shadow-sm p-8">
                <h1 className="text-3xl font-bold mb-2">Training Job Monitor</h1>
                <p className="text-muted-foreground mb-6">
                  Enter a job ID to monitor training progress in real-time
                </p>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="jobId" className="block text-sm font-medium mb-2">
                      Job ID
                    </label>
                    <input
                      id="jobId"
                      type="text"
                      value={inputJobId}
                      onChange={(e) => setInputJobId(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleStartMonitoring();
                      }}
                      placeholder="e.g., aae692eb-a43a-46af-8370-7bb4a219b752"
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <Button
                    onClick={handleStartMonitoring}
                    disabled={!inputJobId.trim()}
                    className="w-full"
                  >
                    Start Monitoring
                  </Button>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Tip:</strong> You can also access this page with a job ID directly:<br />
                      <code className="text-xs bg-card px-2 py-1 rounded mt-1 inline-block">
                        /training/monitor?jobId=YOUR_JOB_ID
                      </code>
                    </p>
                  </div>
                </div>

                {/* Recent Jobs Section */}
                {loadingJobs ? (
                  <div className="mt-8 text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">Loading recent jobs...</p>
                  </div>
                ) : recentJobs.length > 0 ? (
                  <div className="mt-8 bg-card border border-border rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-semibold">Recent Training Jobs</h2>

                      {/* Group by Model Toggle */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="groupByModel"
                          checked={groupByModel}
                          onChange={(e) => setGroupByModel(e.target.checked)}
                          className="w-4 h-4 rounded border-border cursor-pointer"
                        />
                        <label htmlFor="groupByModel" className="text-sm text-muted-foreground cursor-pointer select-none">
                          Group by Model
                        </label>
                      </div>
                    </div>

                    {/* Filter and Search Controls */}
                    <div className="mb-4 flex flex-col sm:flex-row gap-3">
                      {/* Search Input */}
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search by model name or job ID..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        />
                      </div>

                      {/* Status Filter */}
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        >
                          <option value={STATUS.ALL}>All Status</option>
                          <option value={STATUS.RUNNING}>Running</option>
                          <option value={STATUS.COMPLETED}>Completed</option>
                          <option value={STATUS.FAILED}>Failed</option>
                          <option value={STATUS.QUEUED}>Queued</option>
                          <option value={STATUS.PENDING}>Pending</option>
                          <option value={STATUS.CANCELLED}>Cancelled</option>
                          <option value={STATUS.PAUSED}>Paused</option>
                        </select>
                      </div>
                    </div>

                    {/* Results Count */}
                    <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
                      <div>
                        {(statusFilter !== STATUS.ALL || searchQuery.trim()) ? (
                          <>
                            Showing {filteredJobs.length} of {recentJobs.length} jobs
                            {statusFilter !== STATUS.ALL && ` • Status: ${statusFilter}`}
                            {searchQuery.trim() && ` • Search: "${searchQuery}"`}
                          </>
                        ) : (
                          <>
                            Showing {filteredJobs.length} of {recentJobs.length} most recent jobs
                          </>
                        )}
                      </div>

                      {/* Show More / Show Less Button */}
                      {hasMoreJobs && (
                        <Button
                          onClick={() => setShowAllJobs(true)}
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          Show All ({recentJobs.length})
                        </Button>
                      )}
                      {showAllJobs && !hasMoreJobs && (statusFilter === STATUS.ALL && !searchQuery.trim()) && (
                        <Button
                          onClick={() => setShowAllJobs(false)}
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          Show Less
                        </Button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {filteredJobs.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed rounded-lg">
                          <p className="text-muted-foreground">No jobs match your filters.</p>
                          <Button
                            onClick={() => {
                              setStatusFilter(STATUS.ALL);
                              setSearchQuery('');
                            }}
                            variant="outline"
                            size="sm"
                            className="mt-3"
                          >
                            Clear Filters
                          </Button>
                        </div>
                      ) : (
                        Object.entries(groupedJobs).map(([modelKey, jobs]) => (
                        <div key={modelKey}>
                          {/* Show model group header if grouping enabled */}
                          {groupByModel && (
                            <div className="mb-2 flex items-center gap-2">
                              <h3 className="font-semibold text-sm text-foreground">
                                {modelKey}
                              </h3>
                              <span className="text-xs text-muted-foreground">
                                ({jobs.length} {jobs.length === 1 ? 'run' : 'runs'})
                              </span>
                            </div>
                          )}

                          {/* Render jobs in group */}
                          <div className="space-y-2">
                            {jobs.map(job => {
                        const statusIcon = 
                          job.status === STATUS.COMPLETED ? <CheckCircle2 className="w-4 h-4 text-green-600" /> :
                          job.status === STATUS.FAILED ? <XCircle className="w-4 h-4 text-red-600" /> :
                          job.status === STATUS.RUNNING ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" /> :
                          <Clock className="w-4 h-4 text-muted-foreground" />;

                        // Extract clean model name from path
                        const getCleanModelName = (modelPath: string | null): string => {
                          if (!modelPath) return 'Unnamed Model';
                          
                          // Handle local paths like: huggingface_models/Qwen-Qwen3-1.7B/snapshots/...
                          if (modelPath.includes('huggingface_models/')) {
                            const match = modelPath.match(/huggingface_models\/([^\/]+)/);
                            if (match) {
                              // Convert Qwen-Qwen3-1.7B back to Qwen/Qwen3-1.7B
                              const modelName = match[1];
                              // Replace only the first hyphen with a slash
                              const firstHyphen = modelName.indexOf('-');
                              if (firstHyphen !== -1) {
                                return modelName.substring(0, firstHyphen) + '/' + modelName.substring(firstHyphen + 1);
                              }
                              return modelName;
                            }
                          }
                          
                          // Handle HuggingFace IDs like: Qwen/Qwen3-1.7B
                          if (modelPath.includes('/')) {
                            const parts = modelPath.split('/');
                            // Return last 2 parts (org/model)
                            if (parts.length >= 2) {
                              return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
                            }
                          }
                          
                          return modelPath;
                        };

                        const cleanModelName = getCleanModelName(job.model_name);
                        const isBestRun = groupByModel && bestRunPerGroup[modelKey] === job.id;

                        return (
                          <div
                            key={job.id}
                            className="w-full border border-border rounded-md hover:bg-muted transition-colors"
                          >
                            <div className="flex items-start gap-3 p-4">
                              {/* Checkbox for selection */}
                              <div
                                className="pt-1 flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedJobIds.has(job.id)}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedJobIds);
                                    if (e.target.checked) {
                                      if (newSelected.size < 5) {
                                        newSelected.add(job.id);
                                      } else {
                                        alert('Maximum 5 jobs can be compared at once');
                                        return;
                                      }
                                    } else {
                                      newSelected.delete(job.id);
                                    }
                                    setSelectedJobIds(newSelected);
                                  }}
                                  className="w-4 h-4 rounded border-border cursor-pointer"
                                />
                              </div>

                              {/* Job details - clickable to monitor */}
                              <button
                                onClick={() => {
                                  setInputJobId(job.id);
                                  setJobId(job.id);
                                  setIsMonitoring(true);
                                }}
                                className="flex-1 text-left group min-w-0"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    {statusIcon}
                                    <span className="font-medium text-sm truncate">{cleanModelName}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      job.status === STATUS.COMPLETED ? 'bg-green-100 text-green-800' :
                                      job.status === STATUS.FAILED ? 'bg-red-100 text-red-800' :
                                      job.status === STATUS.RUNNING ? 'bg-blue-100 text-blue-800' :
                                      'bg-muted text-foreground'
                                    }`}>
                                      {job.status}
                                    </span>

                                    {/* Best run indicator */}
                                    {isBestRun && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1">
                                        🏆 Best
                                      </span>
                                    )}

                                    {/* Loss badge for completed jobs */}
                                    {job.status === STATUS.COMPLETED && job.best_eval_loss != null && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                        Loss: {job.best_eval_loss.toFixed(4)}
                                      </span>
                                    )}

                                    {/* Performance delta */}
                                    {groupByModel &&
                                     job.status === STATUS.COMPLETED &&
                                     job.best_eval_loss != null &&
                                     !isBestRun &&
                                     (() => {
                                       const bestJobInGroup = jobs.find(j => j.id === bestRunPerGroup[modelKey]);
                                       const bestLoss = bestJobInGroup?.best_eval_loss;

                                       if (bestLoss != null) {
                                         const deltaPct = ((job.best_eval_loss - bestLoss) / bestLoss * 100);
                                         if (Math.abs(deltaPct) > 5) {
                                           return (
                                             <span className={`text-xs px-2 py-0.5 rounded-full ${
                                               deltaPct > 25 ? 'bg-red-100 text-red-800' : 'bg-orange-50 text-orange-700'
                                             }`}>
                                               ⚠️ +{deltaPct.toFixed(0)}% worse
                                             </span>
                                           );
                                         }
                                       }
                                       return null;
                                     })()
                                    }
                                  </div>
                                  <div className="text-xs text-muted-foreground font-mono truncate">
                                    {job.id}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {job.started_at
                                      ? `Started: ${new Date(job.started_at).toLocaleString()}`
                                      : `Created: ${new Date(job.created_at).toLocaleString()}`
                                    }
                                  </div>
                                </div>
                                <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="text-sm text-blue-600">Monitor →</span>
                                </div>
                              </button>
                            </div>
                          </div>
                        );
                            })}
                          </div>
                        </div>
                      ))
                      )}
                    </div>
                      </div>
                    ) : (
                      <div className="mt-8 text-center py-8 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">No recent training jobs found.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start a new training job to see it here.
                    </p>
                  </div>
                )}

                {/* Floating Compare Button */}
                {selectedJobIds.size >= 2 && (
                  <div className="fixed bottom-8 right-8 z-50">
                    <Button
                      onClick={() => setShowComparisonModal(true)}
                      size="lg"
                      className="shadow-lg gap-2"
                    >
                      <span>Compare Selected ({selectedJobIds.size})</span>
                    </Button>
                  </div>
                )}

                {/* Comparison Modal */}
                {showComparisonModal && (
                  <ComparisonModal
                    jobs={Array.from(selectedJobIds).map(id =>
                      recentJobs.find(job => job.id === id)!
                    ).filter(Boolean)}
                    isOpen={showComparisonModal}
                    onClose={() => setShowComparisonModal(false)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar currentPage="training" user={user} signOut={signOut} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 bg-background min-h-full">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
              <Link href="/training" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Training
              </Link>

              <div className="flex items-center gap-4">
                <AgentStatus />
                <div className="text-sm text-muted-foreground">
                  Job ID: <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{jobId}</code>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <TrainingDashboard
                jobId={jobId}
                onComplete={handleJobComplete}
                onStatusUpdate={handleStatusUpdate}
                pollInterval={dashboardPollInterval}
                leftControlButton={
                  <Button
                    onClick={() => {
                      setIsMonitoring(false);
                      setJobId('');
                      setInputJobId('');
                      setCurrentStatus(null);
                      // Real-time hook keeps jobs list updated automatically
                    }}
                    variant="outline"
                    size="sm"
                    className="bg-gray-100 hover:bg-gray-200"
                  >
                    Monitor Different Job
                  </Button>
                }
                controlButtons={
                  <>
                    {/* Pause Button - only show for running jobs */}
                    {currentStatus && currentStatus.status === STATUS.RUNNING && (
                      <Button
                        onClick={handlePauseJob}
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-yellow-100 hover:bg-yellow-200"
                      >
                        <Pause className="w-4 h-4" />
                        Pause
                      </Button>
                    )}

                    {/* Resume Button - only show for paused jobs */}
                    {currentStatus && currentStatus.status === STATUS.PAUSED && (
                      <Button
                        onClick={handleResumeJob}
                        variant="default"
                        size="sm"
                        className="gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Resume
                      </Button>
                    )}
                  </>
                }
              />

              {/* Runtime Parameter Controls - Phase 3: Advanced Training Features */}
              {currentStatus && currentStatus.status === STATUS.RUNNING && (
                <RuntimeParameterControls
                  jobId={jobId}
                  currentLearningRate={currentStatus.max_learning_rate || currentStatus.learning_rate}
                  currentBatchSize={currentStatus.batch_size}
                  currentGradAccumSteps={currentStatus.gradient_accumulation_steps}
                />
              )}

              {currentStatus && (
                <div className="flex justify-center gap-4">
                  <DeployModelButton
                    jobId={jobId}
                    modelName={currentStatus.status === STATUS.COMPLETED ? 'Trained Model' : undefined}
                    status={currentStatus.status as 'running' | 'completed' | 'failed'}
                  />
                </div>
              )}

              {/* Job Recovery Card - Phase 1: Job State Management Fix */}
              {/* Show for pending/queued jobs that need manual intervention (LOCAL JOBS ONLY) */}
              {!isCloudJob && currentStatus && (currentStatus.status === STATUS.PENDING || currentStatus.status === STATUS.QUEUED) && (
                <JobRecoveryCard
                  jobId={jobId}
                  jobStatus={currentStatus.status as 'pending' | 'queued'}
                  jobName={currentStatus.job_name}
                  onForceStart={(jobId) => {
                    console.log('[TrainingMonitor] Job force-started:', jobId);
                    // Reload to show updated status
                    window.location.reload();
                  }}
                />
              )}

              {/* Checkpoint Resume Card - Phase 3: Advanced Training Features */}
              {/* Show for failed/cancelled jobs (will handle checkpoints or show fallback) */}
              {currentStatus && (currentStatus.status === STATUS.FAILED || currentStatus.status === STATUS.CANCELLED) && (
                <CheckpointResumeCard
                  jobId={jobId}
                  jobStatus={currentStatus.status as 'failed' | 'cancelled'}
                  jobStartedAt={currentStatus.started_at}
                  onResumeSuccess={(newJobId) => {
                    console.log('[TrainingMonitor] Resume successful, navigating to:', newJobId);
                    // Navigate to new job
                    window.location.href = `/training/monitor?jobId=${newJobId}`;
                  }}
                />
              )}


              {/* Wrap ALL charts in shared provider to prevent connection limit issues */}
              <TrainingMetricsProvider jobId={jobId} sessionToken={getFreshToken()}>
                <LossChart
                  jobId={jobId}
                  sessionToken={getFreshToken() ?? undefined}
                  pollInterval={metricsPollInterval}
                  autoRefresh={isTrainingActive}
                />

                <LearningRateChart
                  jobId={jobId}
                  sessionToken={getFreshToken() ?? undefined}
                  pollInterval={metricsPollInterval}
                  autoRefresh={isTrainingActive}
                />

                <GradNormChart
                  jobId={jobId}
                  sessionToken={getFreshToken() ?? undefined}
                  pollInterval={metricsPollInterval}
                  autoRefresh={isTrainingActive}
                />

                <ThroughputChart
                  jobId={jobId}
                  sessionToken={getFreshToken() ?? undefined}
                  pollInterval={metricsPollInterval}
                  autoRefresh={isTrainingActive}
                />

                <GPUMemoryReservedChart
                  jobId={jobId}
                  sessionToken={getFreshToken() ?? undefined}
                  pollInterval={metricsPollInterval}
                  autoRefresh={isTrainingActive}
                />

                <GPUUtilizationChart
                  jobId={jobId}
                  sessionToken={getFreshToken() ?? undefined}
                  pollInterval={metricsPollInterval}
                  autoRefresh={isTrainingActive}
                />

                <PerplexityChart
                  jobId={jobId}
                  sessionToken={getFreshToken() ?? undefined}
                  pollInterval={metricsPollInterval}
                  autoRefresh={isTrainingActive}
                />

                <MetricsOverviewCard
                  jobId={jobId}
                  sessionToken={getFreshToken() ?? undefined}
                  pollInterval={metricsPollInterval}
                  autoRefresh={isTrainingActive}
                />
              </TrainingMetricsProvider>

              {/* Predictions Components - W&B-style prediction tracking */}
              {getFreshToken() && (
                <>
                  <PredictionsTable
                    jobId={jobId}
                    authToken={getFreshToken()!}
                  />

                  <PredictionsComparison
                    jobId={jobId}
                    authToken={getFreshToken()!}
                  />

                  <PredictionsTrendsChart
                    jobId={jobId}
                    authToken={getFreshToken()!}
                  />
                </>
              )}

              {currentStatus && (
                <BestModelCard status={currentStatus} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TrainingMonitorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <TrainingMonitorPageContent />
    </Suspense>
  );
}
