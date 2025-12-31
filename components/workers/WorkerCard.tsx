/**
 * Worker Card Component
 * Display individual worker with status and actions
 * Date: 2025-12-30
 */

'use client';

import React, { useState } from 'react';
import { Trash2, BarChart3, Circle, Terminal, Apple, MonitorSmartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPlatformDisplayName, getPlatformIcon } from '@/lib/workers/types';
import type { WorkerAgent } from '@/lib/workers/types';

interface WorkerCardProps {
  worker: WorkerAgent;
  onDelete: (workerId: string) => void;
  onViewDetails: () => void;
}

export function WorkerCard({ worker, onDelete, onViewDetails }: WorkerCardProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete worker "${worker.hostname}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    await onDelete(worker.worker_id);
    setDeleting(false);
  };

  const getStatusColor = () => {
    if (worker.is_online) return 'bg-green-500 text-green-500';
    if (worker.status === 'error') return 'bg-red-500 text-red-500';
    return 'bg-gray-500 text-gray-500';
  };

  const getStatusLabel = () => {
    if (worker.is_online) return 'Online';
    if (worker.status === 'error') return 'Error';
    return 'Offline';
  };

  const formatLastSeen = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  // Get platform icon component
  const iconName = getPlatformIcon(worker.platform);
  const iconMap: Record<string, React.ElementType> = {
    Terminal,
    Apple,
    MonitorSmartphone,
    HardDrive: Terminal, // Fallback
  };
  const PlatformIcon = iconMap[iconName] || Terminal;

  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        {/* Worker info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 bg-primary/10 rounded-md flex-shrink-0">
            <PlatformIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base truncate">{worker.hostname}</h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor()} bg-opacity-10`}>
                <Circle className={`h-2 w-2 ${getStatusColor()} fill-current`} />
                {getStatusLabel()}
              </span>
            </div>

            {/* Platform & version */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span>{getPlatformDisplayName(worker.platform)}</span>
              <span>•</span>
              <span>v{worker.version}</span>
            </div>

            {/* Last heartbeat */}
            <div className="text-xs text-muted-foreground mt-1">
              Last seen: {formatLastSeen(worker.last_heartbeat)}
            </div>

            {/* Metrics preview */}
            {worker.is_online && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                <span>Load: {worker.current_load}/{worker.max_concurrency}</span>
                <span>•</span>
                <span>Jobs: {worker.total_commands_executed}</span>
                {worker.total_errors > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-destructive">Errors: {worker.total_errors}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0 ml-2">
          <button
            onClick={onViewDetails}
            className="p-2 hover:bg-primary/10 rounded transition-colors text-primary"
            title="View details"
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 hover:bg-destructive/10 rounded transition-colors text-destructive disabled:opacity-50"
            title="Delete worker"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
