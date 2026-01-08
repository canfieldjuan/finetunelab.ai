/**
 * Worker Agent List Section
 * Displays user's workers with status and metrics
 * Date: 2025-12-30
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WorkerCard } from './WorkerCard';
import { WorkerDetailsModal } from './WorkerDetailsModal';
import type { WorkerAgent } from '@/lib/workers/types';
import { Button } from '@/components/ui/button';
import { RefreshCw, HardDrive, AlertCircle } from 'lucide-react';

interface WorkerAgentListSectionProps {
  userId: string;
  sessionToken: string;
  refreshTrigger?: number;
}

export function WorkerAgentListSection({ userId, sessionToken, refreshTrigger }: WorkerAgentListSectionProps) {
  const [workers, setWorkers] = useState<WorkerAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<WorkerAgent | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkers = useCallback(async () => {
    try {
      const response = await fetch('/api/workers', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workers');
      }

      const data = await response.json();
      setWorkers(data.workers || []);
      setError(null);
    } catch (err) {
      console.error('[Worker List] Error fetching workers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken]);

  // Initial fetch
  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  // Refresh when trigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchWorkers();
    }
  }, [refreshTrigger, fetchWorkers]);

  // Poll for status updates every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchWorkers();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchWorkers]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchWorkers();
  };

  const handleDeleteWorker = async (workerId: string) => {
    try {
      const response = await fetch(`/api/workers/${workerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete worker');
      }

      // Remove from local state
      setWorkers((prev) => prev.filter((w) => w.worker_id !== workerId));

      // Close modal if this worker was selected
      if (selectedWorker?.worker_id === workerId) {
        setSelectedWorker(null);
      }
    } catch (err) {
      console.error('[Worker List] Error deleting worker:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete worker');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Worker Agents</h3>
          <p className="text-sm text-muted-foreground">
            {workers.length} {workers.length === 1 ? 'worker' : 'workers'} registered
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div>
              <p className="font-medium">Error loading workers</p>
              <p className="text-sm mt-1">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-3">
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-muted-foreground">Loading workers...</p>
          </div>
        </div>
      )}

      {/* Worker Cards Grid */}
      {!loading && workers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((worker) => (
            <WorkerCard
              key={worker.worker_id}
              worker={worker}
              onDelete={handleDeleteWorker}
              onViewDetails={() => setSelectedWorker(worker)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && workers.length === 0 && !error && (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <HardDrive className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No workers yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Download and install a worker agent to get started
          </p>
          <p className="text-xs text-muted-foreground">
            Workers will appear here once they connect to the platform
          </p>
        </div>
      )}

      {/* Worker Details Modal */}
      {selectedWorker && (
        <WorkerDetailsModal
          workerId={selectedWorker.worker_id}
          sessionToken={sessionToken}
          onClose={() => setSelectedWorker(null)}
        />
      )}
    </div>
  );
}
