'use client';

/**
 * Terminal Training Monitor Page
 *
 * Terminal-style UI for monitoring training jobs in real-time
 * Phase 7: Integration
 *
 * Date: 2025-11-01
 */

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTerminalData } from '@/hooks/useTerminalData';
import { agentConfig } from '@/lib/config/agent';
import { TerminalMonitor } from '@/components/terminal/TerminalMonitor';
import { ArrowLeft } from 'lucide-react';

function TerminalMonitorPageContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams?.get('jobId') || null;
  
  // Fetch training data with polling
  const { data, loading, error, refetch, isPolling } = useTerminalData(jobId, {
    refreshInterval: 2000, // Poll every 2 seconds
    autoRefresh: true,
  });
  
  console.log('[TerminalMonitor] Page loaded');
  console.log('[TerminalMonitor] jobId:', jobId);
  console.log('[TerminalMonitor] loading:', loading);
  console.log('[TerminalMonitor] error:', error);
  console.log('[TerminalMonitor] isPolling:', isPolling);
  console.log('[TerminalMonitor] data:', data ? 'exists' : 'null');
  
  // Handle cancel action
  const handleCancel = async () => {
    if (!jobId) return;
    
    // Confirm cancellation
    const confirmed = window.confirm(
      'Are you sure you want to cancel this training job? This action cannot be undone.'
    );
    
    if (!confirmed) return;
    
    try {
      console.log('[TerminalMonitor] Cancelling job:', jobId);

      const response = await fetch(`${agentConfig.server.url}/api/training/cancel/${jobId}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to cancel job: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[TerminalMonitor] Cancel result:', result);
      
      // Show success message
      alert('Training job cancelled successfully');
      
      // Refresh data immediately
      await refetch();
    } catch (err) {
      console.error('[TerminalMonitor] Cancel error:', err);
      alert('Failed to cancel training job. Please try again.');
    }
  };

  // Handle pause action
  const handlePause = async () => {
    if (!jobId) return;

    try {
      console.log('[TerminalMonitor] Pausing job:', jobId);

      const response = await fetch(`${agentConfig.server.url}/api/training/pause/${jobId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to pause job: ${response.status}`);
      }

      const result = await response.json();
      console.log('[TerminalMonitor] Pause result:', result);

      // Show success message
      alert('Training job paused successfully');

      // Refresh data immediately
      await refetch();
    } catch (err) {
      console.error('[TerminalMonitor] Pause error:', err);
      alert('Failed to pause training job. Please try again.');
    }
  };

  // Handle resume action
  const handleResume = async () => {
    if (!jobId) return;

    try {
      console.log('[TerminalMonitor] Resuming job:', jobId);

      const response = await fetch(`${agentConfig.server.url}/api/training/resume/${jobId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to resume job: ${response.status}`);
      }

      const result = await response.json();
      console.log('[TerminalMonitor] Resume result:', result);

      // Show success message
      alert('Training job resumed successfully');

      // Refresh data immediately
      await refetch();
    } catch (err) {
      console.error('[TerminalMonitor] Resume error:', err);
      alert('Failed to resume training job. Please try again.');
    }
  };
  
  // No job ID in URL
  if (!jobId) {
    return (
      <div className="h-screen overflow-hidden bg-[#0a0a0a]">
        <div className="h-full overflow-y-auto text-gray-100 font-mono p-8">
          <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link 
              href="/training/monitor" 
              className="inline-flex items-center text-green-400 hover:text-green-300 mb-4 transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Monitor
            </Link>
            
            <h1 className="text-2xl font-bold text-red-400 mb-2">
              ❌ No Job ID Provided
            </h1>
            <p className="text-gray-400">
              Please provide a job ID in the URL query parameter: <code className="text-yellow-400">?jobId=xxx</code>
            </p>
          </div>
          
          {/* Help text */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-200 mb-3">How to use Terminal Monitor:</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-400 text-sm">
              <li>Start a training job from the <Link href="/training" className="text-blue-400 hover:underline">Training page</Link></li>
              <li>Navigate to the <Link href="/training/monitor" className="text-blue-400 hover:underline">Monitor page</Link></li>
              <li>Click &quot;Terminal View&quot; to switch to this interface</li>
            </ol>
          </div>
        </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen overflow-hidden bg-[#0a0a0a]">
      <div className="h-full overflow-y-auto">
        {/* Navigation header */}
        <div className="px-4 py-2.5">
          <div className="max-w-7xl mx-auto bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5">
            <div className="flex items-center justify-between">
              <Link
                href={`/training/monitor?jobId=${jobId}`}
                className="inline-flex items-center text-green-400 hover:text-green-300 text-sm transition-colors duration-200"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Switch to Chart View
              </Link>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-2">
                  Polling: <span className={`${isPolling ? 'text-green-400' : 'text-red-400'} font-semibold`}>
                    {isPolling ? '● ON' : '○ OFF'}
                  </span>
                </span>
                <button
                  onClick={() => refetch()}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-md text-gray-300 transition-colors duration-200"
                >
                  Refresh Now
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Terminal monitor component */}
        <TerminalMonitor
          metrics={data!}
          loading={loading}
          error={error || undefined}
          onCancel={handleCancel}
          onPause={handlePause}
          onResume={handleResume}
        />
      </div>
    </div>
  );
}

export default function TerminalMonitorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <TerminalMonitorPageContent />
    </Suspense>
  );
}
