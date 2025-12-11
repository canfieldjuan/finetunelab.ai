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
import { Loader2, BarChart3, RefreshCw, Info } from 'lucide-react';
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
  const [metricType, setMetricType] = useState<'both' | 'train_loss' | 'eval_loss'>('both');

  // Fetch all jobs
  const {
    jobs: allJobs,
    isLoading: loadingJobs,
  } = useTrainingJobsRealtime(user?.id, session?.access_token);

  // Filter jobs by status
  const filteredJobs = useMemo(() => {
    if (statusFilter === 'all') return allJobs;
    return allJobs.filter(job => job.status === statusFilter);
  }, [allJobs, statusFilter]);

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
          <div className="bg-card border border-border rounded-lg p-4 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Select Runs</h3>
              {selectedJobIds.size > 0 && (
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              )}
            </div>

            {/* Status Filter */}
            <div className="mb-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selection count */}
            <p className="text-sm text-muted-foreground mb-3">
              {selectedJobIds.size}/5 selected
            </p>

            {/* Job List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {loadingJobs ? (
                <div className="text-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </div>
              ) : filteredJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No training jobs found
                </p>
              ) : (
                filteredJobs.map((job) => {
                  const isSelected = selectedJobIds.has(job.id);
                  const selectionIndex = Array.from(selectedJobIds).indexOf(job.id);
                  const color = isSelected ? JOB_COLORS[selectionIndex] : undefined;

                  return (
                    <div
                      key={job.id}
                      className={`p-3 rounded-md border cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => toggleJobSelection(job.id)}
                    >
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleJobSelection(job.id)}
                          disabled={!isSelected && selectedJobIds.size >= 5}
                        />
                        <div className="flex-1 min-w-0">
                          {isSelected && (
                            <div
                              className="w-3 h-3 rounded-full mb-1"
                              style={{ backgroundColor: color }}
                            />
                          )}
                          <p className="text-sm font-medium truncate">
                            {job.model_name?.split('/').pop() || 'Unknown Model'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {job.status} &bull; {job.best_eval_loss?.toFixed(4) || 'N/A'}
                          </p>
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

                  {/* Summary Table */}
                  <MultiJobSummaryTable
                    jobs={selectedJobs}
                    jobColors={jobColors}
                  />

                  {/* Info about chart interpretation */}
                  <Alert>
                    <Info className="w-4 h-4" />
                    <AlertDescription>
                      <strong>Solid lines</strong> represent training loss, <strong>dashed lines</strong> represent evaluation loss.
                      Lower loss values indicate better model performance. Look for runs where eval loss closely follows train loss
                      without large gaps (which would indicate overfitting).
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
