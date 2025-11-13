'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TrainingDashboard } from '@/components/training/TrainingDashboard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, StopCircle, Pause, Play } from 'lucide-react';
import Link from 'next/link';
import type { TrainingJobStatus } from '@/lib/services/training-providers/local.provider';
import { useTrainingJobsRealtime } from '@/lib/hooks/useTrainingJobsRealtime';
import { useFreshToken } from '@/hooks/useFreshToken';
import { TrainingMetricsProvider } from '@/contexts/TrainingMetricsContext';
import { AppSidebar } from '@/components/layout/AppSidebar';

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

const GPUMemoryChart = dynamic(() => import('@/components/training/GPUMemoryChart').then(mod => ({ default: mod.GPUMemoryChart })), {
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

const InferenceDeployButton = dynamic(() => import('@/components/inference/InferenceDeployButton').then(mod => ({ default: mod.InferenceDeployButton })), {
  loading: () => <div className="h-12 bg-muted animate-pulse rounded-lg w-48" />,
  ssr: false
});

const CheckpointResumeCard = dynamic(() => import('@/components/training/CheckpointResumeCard').then(mod => ({ default: mod.CheckpointResumeCard })), {
  loading: () => <div className="h-48 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const RuntimeParameterControls = dynamic(() => import('@/components/training/RuntimeParameterControls').then(mod => ({ default: mod.RuntimeParameterControls })), {
  loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

export default function TrainingMonitorPage() {
  const searchParams = useSearchParams();
  const urlJobId = searchParams?.get('jobId') || null;
  const { user, session, signOut, loading: authLoading } = useAuth();
  const getFreshToken = useFreshToken();

  const [jobId, setJobId] = useState<string>(urlJobId || '');
  const [inputJobId, setInputJobId] = useState<string>(urlJobId || '');
  const [currentStatus, setCurrentStatus] = useState<TrainingJobStatus | null>(null);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(!!urlJobId);
  const [isTrainingActive, setIsTrainingActive] = useState<boolean>(false);

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

  useEffect(() => {
    if (currentStatus) {
      const isActive = currentStatus.status === 'running' || currentStatus.status === 'pending';
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

  const handleCancelJob = async () => {
    if (!jobId) return;

    // Confirm cancellation
    const confirmed = window.confirm(
      'Are you sure you want to cancel this training job? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      console.log('[TrainingMonitor] Cancelling job:', jobId);

      const response = await fetch(`http://localhost:8000/api/training/cancel/${jobId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel job: ${response.status}`);
      }

      const result = await response.json();
      console.log('[TrainingMonitor] Cancel result:', result);

      // Show success message
      alert('Training job cancelled successfully');

      // Update current status to trigger UI refresh
      if (currentStatus) {
        setCurrentStatus({
          ...currentStatus,
          status: 'cancelled',
        });
      }
    } catch (err) {
      console.error('[TrainingMonitor] Cancel error:', err);
      alert('Failed to cancel training job. Please try again.');
    }
  };

  const handlePauseJob = async () => {
    if (!jobId) return;

    try {
      console.log('[TrainingMonitor] Pausing job:', jobId);

      const response = await fetch(`http://localhost:8000/api/training/pause/${jobId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to pause job: ${response.status}`);
      }

      const result = await response.json();
      console.log('[TrainingMonitor] Pause result:', result);

      // Show success message
      alert('Training job paused successfully');

      // Update current status to trigger UI refresh
      if (currentStatus) {
        setCurrentStatus({
          ...currentStatus,
          status: 'paused',
        });
      }
    } catch (err) {
      console.error('[TrainingMonitor] Pause error:', err);
      alert('Failed to pause training job. Please try again.');
    }
  };

  const handleResumeJob = async () => {
    if (!jobId) return;

    try {
      console.log('[TrainingMonitor] Resuming job:', jobId);

      const response = await fetch(`http://localhost:8000/api/training/resume/${jobId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to resume job: ${response.status}`);
      }

      const result = await response.json();
      console.log('[TrainingMonitor] Resume result:', result);

      // Show success message
      alert('Training job resumed successfully');

      // Update current status to trigger UI refresh
      if (currentStatus) {
        setCurrentStatus({
          ...currentStatus,
          status: 'running',
        });
      }
    } catch (err) {
      console.error('[TrainingMonitor] Resume error:', err);
      alert('Failed to resume training job. Please try again.');
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
      <div className="flex h-screen">
        <AppSidebar currentPage="training" user={user} signOut={signOut} />
        <div className="flex-1 p-8 bg-background overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <Link href="/training" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Training
            </Link>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8">
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
                  <code className="text-xs bg-white px-2 py-1 rounded mt-1 inline-block">
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
              <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Recent Training Jobs</h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {isConnected ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span>Live updates</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                        <span>Connecting...</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {recentJobs.map(job => {
                    const statusIcon = 
                      job.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> :
                      job.status === 'failed' ? <XCircle className="w-4 h-4 text-red-600" /> :
                      job.status === 'running' ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" /> :
                      <Clock className="w-4 h-4 text-gray-400" />;

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

                    return (
                      <button
                        key={job.id}
                        onClick={() => {
                          setInputJobId(job.id);
                          setJobId(job.id);
                          setIsMonitoring(true);
                        }}
                        className="w-full text-left p-4 border rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {statusIcon}
                            <span className="font-medium text-sm truncate">{cleanModelName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              job.status === 'completed' ? 'bg-green-100 text-green-800' :
                              job.status === 'failed' ? 'bg-red-100 text-red-800' :
                              job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {job.status}
                            </span>
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
                    );
                  })}
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
          </div>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <AppSidebar currentPage="training" user={user} signOut={signOut} />
      <div className="flex-1 p-8 bg-background overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/training" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Training
            </Link>

          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Job ID: <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{jobId}</code>
            </div>
            
            {/* Job Control Buttons */}
            <div className="flex items-center gap-2">
              {/* Pause Button - only show for running jobs */}
              {currentStatus && currentStatus.status === 'running' && (
                <Button
                  onClick={handlePauseJob}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </Button>
              )}

              {/* Resume Button - only show for paused jobs */}
              {currentStatus && currentStatus.status === 'paused' && (
                <Button
                  onClick={handleResumeJob}
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Resume
                </Button>
              )}

              {/* Cancel Button - show for running/pending/paused/queued jobs */}
              {currentStatus && (currentStatus.status === 'running' || currentStatus.status === 'pending' || currentStatus.status === 'paused' || currentStatus.status === 'queued') && (
                <Button
                  onClick={handleCancelJob}
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <StopCircle className="w-4 h-4" />
                  Cancel
                </Button>
              )}
            </div>
            
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
            >
              Monitor Different Job
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <TrainingDashboard
            jobId={jobId}
            onComplete={handleJobComplete}
            onStatusUpdate={handleStatusUpdate}
            pollInterval={15000}
          />

          {/* Runtime Parameter Controls - Phase 3: Advanced Training Features */}
          {currentStatus && currentStatus.status === 'running' && (
            <RuntimeParameterControls
              jobId={jobId}
              currentLearningRate={currentStatus.learning_rate}
              currentBatchSize={currentStatus.batch_size}
              currentGradAccumSteps={currentStatus.gradient_accumulation_steps}
            />
          )}

          {currentStatus && (
            <div className="flex justify-center gap-4">
              <DeployModelButton
                jobId={jobId}
                modelName={currentStatus.status === 'completed' ? 'Trained Model' : undefined}
                status={currentStatus.status as 'running' | 'completed' | 'failed'}
              />
              <InferenceDeployButton
                jobId={jobId}
                modelName={currentStatus.status === 'completed' ? 'Trained Model' : undefined}
                status={currentStatus.status as 'running' | 'completed' | 'failed'}
              />
            </div>
          )}

          {/* Checkpoint Resume Card - Phase 3: Advanced Training Features */}
          {currentStatus && (currentStatus.status === 'failed' || currentStatus.status === 'cancelled') && (
            <CheckpointResumeCard
              jobId={jobId}
              jobStatus={currentStatus.status as 'failed' | 'cancelled'}
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
              pollInterval={30000}
              autoRefresh={isTrainingActive}
            />

            <LearningRateChart
              jobId={jobId}
              sessionToken={getFreshToken() ?? undefined}
              pollInterval={30000}
              autoRefresh={isTrainingActive}
            />

            <GradNormChart
              jobId={jobId}
              sessionToken={getFreshToken() ?? undefined}
              pollInterval={30000}
              autoRefresh={isTrainingActive}
            />

            <GPUMemoryChart
              jobId={jobId}
              sessionToken={getFreshToken() ?? undefined}
              pollInterval={30000}
              autoRefresh={isTrainingActive}
            />

            <ThroughputChart
              jobId={jobId}
              sessionToken={getFreshToken() ?? undefined}
              pollInterval={30000}
              autoRefresh={isTrainingActive}
            />

            <GPUMemoryReservedChart
              jobId={jobId}
              sessionToken={getFreshToken() ?? undefined}
              pollInterval={30000}
              autoRefresh={isTrainingActive}
            />

            <GPUUtilizationChart
              jobId={jobId}
              sessionToken={getFreshToken() ?? undefined}
              pollInterval={30000}
              autoRefresh={isTrainingActive}
            />

            <PerplexityChart
              jobId={jobId}
              sessionToken={getFreshToken() ?? undefined}
              pollInterval={30000}
              autoRefresh={isTrainingActive}
            />

            <MetricsOverviewCard
              jobId={jobId}
              sessionToken={getFreshToken() ?? undefined}
              pollInterval={30000}
              autoRefresh={isTrainingActive}
            />
          </TrainingMetricsProvider>

          {currentStatus && (
            <BestModelCard status={currentStatus} />
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
