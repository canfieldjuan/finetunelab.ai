/**
 * Checkpoint Selector Component
 *
 * Displays list of available training checkpoints with radio button selection
 * Shows metadata: eval loss, train loss, file size
 * Pre-selects best checkpoint by default
 *
 * Phase: Checkpoint Selection Feature
 * Date: 2025-10-31
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { TrainingCheckpoint } from '@/lib/training/checkpoint.types';

interface CheckpointSelectorProps {
  /** Training job ID */
  jobId: string;

  /** Callback when checkpoint is selected */
  onSelect: (checkpoint: TrainingCheckpoint | null) => void;

  /** Default selection strategy */
  defaultSelection?: 'best' | 'latest' | null;
}

export function CheckpointSelector({
  jobId,
  onSelect,
  defaultSelection = 'best'
}: CheckpointSelectorProps) {
  const [checkpoints, setCheckpoints] = useState<TrainingCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<TrainingCheckpoint | null>(null);

  console.log('[CheckpointSelector] Rendering for jobId:', jobId);

  // Fetch checkpoints on mount
  useEffect(() => {
    const fetchCheckpoints = async () => {
      console.log('[CheckpointSelector] Fetching checkpoints...');
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/training/checkpoints/list?jobId=${jobId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch checkpoints: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[CheckpointSelector] Received checkpoints:', data);

        if (!data.success) {
          throw new Error(data.error || 'Failed to load checkpoints');
        }

        const fetchedCheckpoints = data.checkpoints || [];
        setCheckpoints(fetchedCheckpoints);

        // Auto-select based on strategy
        if (fetchedCheckpoints.length > 0 && defaultSelection) {
          let defaultCheckpoint: TrainingCheckpoint | undefined;

          if (defaultSelection === 'best') {
            defaultCheckpoint = fetchedCheckpoints.find((cp: any) => cp.is_best);
          } else if (defaultSelection === 'latest') {
            defaultCheckpoint = fetchedCheckpoints.find((cp: any) => cp.is_latest);
          }

          // Fallback to first checkpoint if strategy didn't find one
          if (!defaultCheckpoint) {
            defaultCheckpoint = fetchedCheckpoints[0];
          }

          console.log('[CheckpointSelector] Auto-selected:', defaultCheckpoint?.path);
          setSelectedCheckpoint(defaultCheckpoint || null);
          onSelect(defaultCheckpoint || null);
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load checkpoints';
        console.error('[CheckpointSelector] Error:', errorMsg);
        setError(errorMsg);
        onSelect(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCheckpoints();
  }, [jobId, defaultSelection]); // Removed onSelect from deps to prevent infinite loop

  const handleSelect = (checkpoint: TrainingCheckpoint) => {
    console.log('[CheckpointSelector] User selected:', checkpoint.path);
    setSelectedCheckpoint(checkpoint);
    onSelect(checkpoint);
  };

  const formatBytes = (bytes: number | undefined): string => {
    if (!bytes) return 'N/A';
    const gb = bytes / (1024 ** 3);
    return `${gb.toFixed(1)} GB`;
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Select Checkpoint to Deploy</Label>

      {loading && (
        <div className="flex items-center justify-center py-8 border rounded-lg bg-muted/20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Loading checkpoints...</span>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && checkpoints.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No checkpoints available. Training may not have completed any evaluation steps yet.
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && checkpoints.length > 0 && (
        <div className="border rounded-lg divide-y bg-white">
          {checkpoints.slice(0, 3).map((checkpoint) => (
            <label
              key={checkpoint.path}
              className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <input
                type="radio"
                name="checkpoint"
                checked={selectedCheckpoint?.path === checkpoint.path}
                onChange={() => handleSelect(checkpoint)}
                className="mt-1 h-4 w-4"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium text-sm">{checkpoint.path}</span>

                  {checkpoint.is_best && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                      ⭐ Best (Recommended)
                    </span>
                  )}

                  {checkpoint.is_latest && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                      Latest
                    </span>
                  )}
                </div>

                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div className="flex gap-4 flex-wrap">
                    <span>
                      Eval Loss: <strong>{checkpoint.eval_loss?.toFixed(4) || 'N/A'}</strong>
                    </span>
                    <span>
                      Train Loss: <strong>{checkpoint.train_loss?.toFixed(4) || 'N/A'}</strong>
                    </span>
                    {checkpoint.size_bytes && (
                      <span>
                        Size: <strong>{formatBytes(checkpoint.size_bytes)}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </label>
          ))}

          {checkpoints.length > 3 && (
            <div className="p-3 text-center bg-muted/20">
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                onClick={() => {
                  // Future: Open modal with full checkpoint list
                  console.log('[CheckpointSelector] View all clicked - not yet implemented');
                }}
              >
                View All {checkpoints.length} Checkpoints →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
