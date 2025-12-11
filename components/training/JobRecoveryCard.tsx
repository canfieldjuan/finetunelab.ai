'use client';

/**
 * Job Recovery Card Component
 *
 * Provides UI controls for stuck or orphaned training jobs
 * Works for jobs without checkpoints or in pending/queued states
 * Phase 1: Job State Management Fix
 * Date: 2025-11-14
 */

import React, { useState } from 'react';
import { LocalTrainingProvider } from '@/lib/services/training-providers/local.provider';
import { AlertTriangle, Play, XCircle, Clock, AlertCircle } from 'lucide-react';

interface JobRecoveryCardProps {
  jobId: string;
  jobStatus: 'pending' | 'queued' | 'failed' | 'cancelled';
  jobName?: string;
  onForceStart?: (jobId: string) => void;
  onMarkFailed?: (jobId: string) => void;
}

console.log('[JobRecoveryCard] Module loaded');

export function JobRecoveryCard({
  jobId,
  jobStatus,
  jobName,
  onForceStart,
  onMarkFailed
}: JobRecoveryCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  console.log('[JobRecoveryCard] Rendering for job:', jobId, 'Status:', jobStatus);

  const handleForceStart = async () => {
    setLoading(true);
    setError(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_TRAINING_BACKEND_URL || 'http://localhost:8000';
      const provider = new LocalTrainingProvider({
        type: 'local',
        base_url: backendUrl,
      });

      console.log('[JobRecoveryCard] Force-starting job:', jobId);
      const result = await provider.forceStartJob(jobId);

      if (result.success) {
        console.log('[JobRecoveryCard] Job force-started successfully:', result);
        setSuccess(true);
        setQueuePosition(result.queue_position || null);

        // Call callback if provided
        if (onForceStart) {
          onForceStart(jobId);
        }

        // Redirect to monitor page after 2 seconds
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to force-start job');
      }
    } catch (err) {
      console.error('[JobRecoveryCard] Error force-starting job:', err);
      setError(err instanceof Error ? err.message : 'Failed to force-start job');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkFailed = async () => {
    if (!confirm('Are you sure you want to mark this job as failed? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call Next.js API to update job status
      const response = await fetch(`/api/training/local/${jobId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'failed',
          error: 'Manually marked as failed by user',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update job status');
      }

      console.log('[JobRecoveryCard] Job marked as failed');

      // Call callback if provided
      if (onMarkFailed) {
        onMarkFailed(jobId);
      }

      // Reload page
      window.location.reload();
    } catch (err) {
      console.error('[JobRecoveryCard] Error marking job as failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark job as failed');
    } finally {
      setLoading(false);
    }
  };

  // Get status-specific messaging
  const getStatusInfo = () => {
    switch (jobStatus) {
      case 'pending':
        return {
          icon: <Clock className="w-5 h-5 text-blue-500" />,
          title: 'Job Stuck in Pending State',
          description: 'This job has been pending for too long. It may have been created but never started.',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          actionLabel: 'Start Job Now',
          actionIcon: <Play className="w-4 h-4" />,
        };
      case 'queued':
        return {
          icon: <Clock className="w-5 h-5 text-amber-500" />,
          title: 'Job Stuck in Queue',
          description: 'This job has been queued but hasn\'t started. It may be waiting for resources.',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          actionLabel: 'Retry Queue',
          actionIcon: <Play className="w-4 h-4" />,
        };
      case 'failed':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
          title: 'Job Failed - Restart Required',
          description: 'This job failed without creating checkpoints. You can restart it from the beginning.',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          actionLabel: 'Restart Job',
          actionIcon: <Play className="w-4 h-4" />,
        };
      case 'cancelled':
        return {
          icon: <XCircle className="w-5 h-5 text-gray-500" />,
          title: 'Job Cancelled - Restart Available',
          description: 'This job was cancelled before creating checkpoints. You can restart it from the beginning.',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          actionLabel: 'Restart Job',
          actionIcon: <Play className="w-4 h-4" />,
        };
      default:
        return {
          icon: <AlertCircle className="w-5 h-5 text-gray-500" />,
          title: 'Job Recovery',
          description: 'Manual intervention required for this job.',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          actionLabel: 'Start Job',
          actionIcon: <Play className="w-4 h-4" />,
        };
    }
  };

  const statusInfo = getStatusInfo();

  // Render success state
  if (success) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className={`px-6 py-4 ${statusInfo.bgColor} border-b ${statusInfo.borderColor}`}>
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Job Started Successfully</h3>
          </div>
        </div>
        <div className="p-6 bg-green-50 border border-green-200 rounded-lg m-4">
          <div className="text-center text-green-700">
            <p className="font-medium">✓ Job Queued Successfully</p>
            {queuePosition !== null && (
              <p className="text-sm mt-1">Queue position: {queuePosition}</p>
            )}
            <p className="text-sm mt-2">Refreshing page...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 ${statusInfo.bgColor} border-b ${statusInfo.borderColor}`}>
        <div className="flex items-center gap-2">
          {statusInfo.icon}
          <h3 className="text-lg font-semibold text-gray-900">{statusInfo.title}</h3>
        </div>
        <p className="text-sm text-gray-600 mt-1">{statusInfo.description}</p>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {/* Job Info */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Job ID:</span>
            <span className="font-mono text-gray-900">{jobId.slice(0, 12)}...</span>
          </div>
          {jobName && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Job Name:</span>
              <span className="text-gray-900">{jobName}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Status:</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              jobStatus === 'pending' ? 'bg-blue-100 text-blue-800' :
              jobStatus === 'queued' ? 'bg-amber-100 text-amber-800' :
              jobStatus === 'failed' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {jobStatus.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Recovery Options */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Recovery Options:</p>

          {/* Force Start Button */}
          <button
            onClick={handleForceStart}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Starting Job...</span>
              </>
            ) : (
              <>
                {statusInfo.actionIcon}
                <span>{statusInfo.actionLabel}</span>
              </>
            )}
          </button>

          {/* Mark as Failed Button (only for pending/queued) */}
          {(jobStatus === 'pending' || jobStatus === 'queued') && (
            <button
              onClick={handleMarkFailed}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <XCircle className="w-4 h-4" />
              <span>Mark as Failed</span>
            </button>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-900">
            <strong>Note:</strong> Force-starting will add this job to the queue.
            If there are other jobs running, it will wait for them to complete.
          </p>
        </div>
      </div>
    </div>
  );
}

console.log('[JobRecoveryCard] Component exported');
