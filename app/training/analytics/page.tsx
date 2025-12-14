/**
 * Training Analytics Page
 * Side-by-side comparison of training metrics across multiple runs
 * Date: 2025-12-07
 */

'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTrainingJobsRealtime } from '@/lib/hooks/useTrainingJobsRealtime';
import { useMultiJobMetrics } from '@/hooks/useMultiJobMetrics';
import { MultiJobLossChart } from '@/components/training/comparison/MultiJobLossChart';
import { MultiJobSummaryTable } from '@/components/training/comparison/MultiJobSummaryTable';
import { MultiJobLearningRateChart } from '@/components/training/comparison/MultiJobLearningRateChart';
import { MultiJobGradientNormChart } from '@/components/training/comparison/MultiJobGradientNormChart';
import { MultiJobThroughputChart } from '@/components/training/comparison/MultiJobThroughputChart';
import { MultiJobMemoryChart } from '@/components/training/comparison/MultiJobMemoryChart';
import { MultiJobHyperparameterDiff } from '@/components/training/comparison/MultiJobHyperparameterDiff';
import { Loader2, BarChart3, RefreshCw, Info, Search, Calendar, ArrowUpDown, Star, TrendingDown, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

// Colors for jobs
const JOB_COLORS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#dc2626', // red
  '#9333ea', // purple
  '#ea580c', // orange
];

function TrainingAnalyticsContent() {
  const { user, session, signOut, loading: authLoading } = useAuth();

  // Job selection state
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'best_loss'>('newest');
  const [metricType, setMetricType] = useState<'both' | 'train_loss' | 'eval_loss'>('both');

  // Fetch all jobs
  const {
    jobs: allJobs,
    isLoading: loadingJobs,
  } = useTrainingJobsRealtime(user?.id, session?.access_token);

  // Filter and sort jobs
  const filteredJobs = useMemo(() => {
    let filtered = allJobs;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(job => job.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(job =>
        (job.model_name?.toLowerCase().includes(query)) ||
        (job.dataset_path?.toLowerCase().includes(query))
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'best_loss':
          const aLoss = a.best_eval_loss ?? Infinity;
          const bLoss = b.best_eval_loss ?? Infinity;
          return aLoss - bLoss;
        default:
          return 0;
      }
    });

    return sorted;
  }, [allJobs, statusFilter, searchQuery, sortBy]);

  // Get selected jobs
  const selectedJobs = useMemo(() => {
    return allJobs.filter(job => selectedJobIds.has(job.id));
  }, [allJobs, selectedJobIds]);

  // Create job names map
  const jobNames = useMemo(() => {
    const names: Record<string, string> = {};
    selectedJobs.forEach((job, index) => {
      // Use model name or fallback to Run #
      const modelName = job.model_name?.split('/').pop() || `Run ${index + 1}`;
      names[job.id] = modelName;
    });
    return names;
  }, [selectedJobs]);

  // Memoize the array of selected job IDs to prevent re-renders
  const selectedJobIdsArray = useMemo(() => {
    return Array.from(selectedJobIds);
  }, [selectedJobIds]);

  // Create job colors map
  const jobColors = useMemo(() => {
    const colors: Record<string, string> = {};
    selectedJobIdsArray.forEach((jobId, index) => {
      colors[jobId] = JOB_COLORS[index % JOB_COLORS.length];
    });
    return colors;
  }, [selectedJobIdsArray]);

  // Fetch metrics for selected jobs
  const {
    jobMetrics,
    isLoading: loadingMetrics,
    error: metricsError,
    refetch,
  } = useMultiJobMetrics(
    selectedJobIdsArray,
    jobNames,
    session?.access_token
  );

  // Add colors to jobMetrics
  const jobMetricsWithColors = useMemo(() => {
    return jobMetrics.map(jm => ({
      ...jm,
      color: jobColors[jm.jobId] || JOB_COLORS[0],
    }));
  }, [jobMetrics, jobColors]);

  // Calculate recommendation score for each selected job
  // Score based on: eval_loss (lower better), overfitting gap (lower better), completion status
  const recommendedJob = useMemo(() => {
    if (selectedJobs.length === 0) return null;

    // Only consider completed jobs for recommendation
    const completedJobs = selectedJobs.filter(j => j.status === 'completed');
    if (completedJobs.length === 0) return null;

    // Calculate scores for each job
    const jobScores = completedJobs.map(job => {
      const evalLoss = job.best_eval_loss ?? job.eval_loss ?? Infinity;
      const trainLoss = job.loss ?? job.final_loss ?? Infinity;
      const overfitGap = evalLoss !== Infinity && trainLoss !== Infinity
        ? evalLoss - trainLoss
        : Infinity;

      // Scoring factors (all normalized to 0-100, higher is better)
      // 1. Eval loss score (inverse, lower loss = higher score)
      const evalLossScore = evalLoss !== Infinity ? Math.max(0, 100 - (evalLoss * 50)) : 0;

      // 2. Overfitting score (penalize large gaps, ideal gap is small positive)
      let overfitScore = 50; // neutral
      if (overfitGap !== Infinity) {
        if (overfitGap < 0) {
          // Negative gap (potential data leakage) - slight penalty
          overfitScore = 40;
        } else if (overfitGap < 0.05) {
          // Excellent - very small gap
          overfitScore = 100;
        } else if (overfitGap < 0.1) {
          // Good
          overfitScore = 80;
        } else if (overfitGap < 0.2) {
          // Moderate overfitting
          overfitScore = 60;
        } else {
          // High overfitting
          overfitScore = 30;
        }
      }

      // Composite score (weighted)
      const compositeScore = (evalLossScore * 0.7) + (overfitScore * 0.3);

      // Build reasons for recommendation
      const reasons: string[] = [];
      if (evalLoss !== Infinity) {
        reasons.push(`Eval Loss: ${evalLoss.toFixed(4)}`);
      }
      if (overfitGap !== Infinity && overfitGap >= 0) {
        if (overfitGap < 0.1) {
          reasons.push('Low overfitting');
        } else {
          reasons.push(`Gap: +${overfitGap.toFixed(3)}`);
        }
      }

      return {
        job,
        evalLoss,
        overfitGap,
        compositeScore,
        reasons,
      };
    });

    // Sort by composite score (highest first)
    jobScores.sort((a, b) => b.compositeScore - a.compositeScore);

    // Return the best job with its reasons
    const best = jobScores[0];
    if (best && best.compositeScore > 0) {
      return {
        jobId: best.job.id,
        reasons: best.reasons,
        score: best.compositeScore,
      };
    }

    return null;
  }, [selectedJobs]);

  // Handle job selection toggle
  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        if (newSet.size >= 5) {
          // Max 5 jobs
          return prev;
        }
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedJobIds(new Set());
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Auth check
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-muted-foreground mb-6">
            Please log in to access training analytics.
          </p>
          <Link href="/login">
            <Button>Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper currentPage="training-analytics" user={user} signOut={signOut} maxWidth="7xl">
      <PageHeader
        title="Training Analytics"
        description="Compare training metrics across multiple runs side-by-side"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Job Selection Panel - Left Side */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-lg p-3 sticky top-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Select Runs</h3>
              {selectedJobIds.size > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
                  Clear
                </Button>
              )}
            </div>

            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search model or dataset..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-8 text-xs"
              />
            </div>

            {/* Filters Row */}
            <div className="flex gap-2 mb-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1 h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Done</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="flex-1 h-8 text-xs">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="best_loss">Best Loss</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selection count and results */}
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{selectedJobIds.size}/5 selected</span>
              <span>{filteredJobs.length} jobs</span>
            </div>

            {/* Job List */}
            <div className="space-y-1.5 max-h-[450px] overflow-y-auto">
              {loadingJobs ? (
                <div className="text-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                </div>
              ) : filteredJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {searchQuery ? 'No matching jobs' : 'No training jobs found'}
                </p>
              ) : (
                filteredJobs.map((job) => {
                  const isSelected = selectedJobIds.has(job.id);
                  const selectionIndex = Array.from(selectedJobIds).indexOf(job.id);
                  const color = isSelected ? JOB_COLORS[selectionIndex] : undefined;
                  const isRecommended = recommendedJob?.jobId === job.id;
                  const dateStr = new Date(job.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={job.id}
                      className={`p-2 rounded-md border cursor-pointer transition-colors ${
                        isRecommended && isSelected
                          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                          : isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      } ${!isSelected && selectedJobIds.size >= 5 ? 'opacity-50' : ''}`}
                      onClick={() => toggleJobSelection(job.id)}
                      title={isRecommended ? `Recommended: ${recommendedJob.reasons.join(' | ')}` : undefined}
                    >
                      <div className="flex items-start gap-2">
                        <div className="pt-0.5">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleJobSelection(job.id)}
                            disabled={!isSelected && selectedJobIds.size >= 5}
                            className="h-3.5 w-3.5"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {isRecommended && isSelected && (
                              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                            )}
                            {isSelected && !isRecommended && (
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: color }}
                              />
                            )}
                            <p className="text-xs font-medium truncate">
                              {job.model_name?.split('/').pop() || 'Unknown'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className={`text-[10px] px-1 py-0.5 rounded ${
                                job.status === 'completed'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : job.status === 'running'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                  : job.status === 'failed'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                              }`}
                            >
                              {job.status}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {job.best_eval_loss?.toFixed(4) || '-'}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {dateStr}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Charts Panel - Right Side */}
        <div className="lg:col-span-3 space-y-6">
          {selectedJobIds.size === 0 ? (
            <div className="bg-muted/30 border border-dashed rounded-lg p-12 text-center">
              <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Select Training Runs to Compare</h3>
              <p className="text-muted-foreground">
                Choose up to 5 training runs from the panel on the left to see their metrics side-by-side
              </p>
            </div>
          ) : (
            <>
              {/* Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Select value={metricType} onValueChange={(v) => setMetricType(v as typeof metricType)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Train & Eval Loss</SelectItem>
                      <SelectItem value="train_loss">Train Loss Only</SelectItem>
                      <SelectItem value="eval_loss">Eval Loss Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="outline" size="sm" onClick={refetch} disabled={loadingMetrics}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loadingMetrics ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {/* Error State */}
              {metricsError && (
                <Alert variant="destructive">
                  <AlertDescription>{metricsError}</AlertDescription>
                </Alert>
              )}

              {/* Loading State */}
              {loadingMetrics && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground">Loading metrics...</p>
                </div>
              )}

              {/* Charts */}
              {!loadingMetrics && (
                <>
                  {/* Loss Chart */}
                  <MultiJobLossChart
                    jobMetrics={jobMetricsWithColors}
                    metricType={metricType}
                    title="Loss Curves Comparison"
                    height={400}
                  />

                  {/* Additional Metric Charts - 2x2 Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <MultiJobLearningRateChart
                      jobMetrics={jobMetricsWithColors}
                      height={250}
                    />
                    <MultiJobGradientNormChart
                      jobMetrics={jobMetricsWithColors}
                      height={250}
                    />
                    <MultiJobThroughputChart
                      jobMetrics={jobMetricsWithColors}
                      height={250}
                    />
                    <MultiJobMemoryChart
                      jobMetrics={jobMetricsWithColors}
                      height={250}
                    />
                  </div>

                  {/* Summary Table */}
                  <MultiJobSummaryTable
                    jobs={selectedJobs}
                    jobColors={jobColors}
                    recommendedJobId={recommendedJob?.jobId}
                    recommendationReasons={recommendedJob?.reasons}
                  />

                  {/* Hyperparameter Comparison */}
                  <MultiJobHyperparameterDiff
                    jobs={selectedJobs}
                    jobColors={jobColors}
                  />

                  {/* Info about chart interpretation */}
                  <Alert>
                    <Info className="w-4 h-4" />
                    <AlertDescription>
                      <strong>Loss:</strong> Solid lines = training, dashed = evaluation. Lower is better.
                      <strong className="ml-2">Gradient Norm:</strong> Spikes indicate instability.
                      <strong className="ml-2">LR:</strong> Shows warmup and decay schedule.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

export default function TrainingAnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    }>
      <TrainingAnalyticsContent />
    </Suspense>
  );
}
