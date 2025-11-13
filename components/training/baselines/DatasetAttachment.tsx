// Dataset Attachment Component
// Purpose: Shared component for attaching/detaching datasets to training configs
// Date: 2025-11-02
// Extracted from: PackageGenerator.tsx

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Database, AlertTriangle, X } from 'lucide-react';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';

console.log('[DatasetAttachment] Component loaded');

interface DatasetAttachmentProps {
  configId: string;
  sessionToken?: string;
  onDatasetsChange?: (datasets: TrainingDatasetRecord[]) => void;
  readOnly?: boolean;
}

export function DatasetAttachment({
  configId,
  sessionToken,
  onDatasetsChange,
  readOnly = false,
}: DatasetAttachmentProps) {
  console.log('[DatasetAttachment] Rendered for config:', configId, 'readOnly:', readOnly);

  // State management
  const [linkedDatasets, setLinkedDatasets] = useState<TrainingDatasetRecord[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [allDatasets, setAllDatasets] = useState<TrainingDatasetRecord[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [attaching, setAttaching] = useState(false);
  const [detachingId, setDetachingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch datasets on mount
  useEffect(() => {
    console.log('[DatasetAttachment] useEffect triggered for configId:', configId);
    fetchLinkedDatasets();
    if (!readOnly) {
      fetchAllDatasets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId]);

  // Fetch linked datasets from junction table
  const fetchLinkedDatasets = async () => {
    console.log('[DatasetAttachment] Fetching linked datasets for config:', configId);
    console.log('[DatasetAttachment] Using sessionToken:', sessionToken ? 'present' : 'missing');
    
    if (!sessionToken) {
      console.warn('[DatasetAttachment] No session token available - cannot fetch datasets');
      setError('Authentication required. Please refresh the page.');
      setLoadingDatasets(false);
      return;
    }
    
    setLoadingDatasets(true);
    setError(null);

    try {
      const response = await fetch(`/api/training/${configId}/datasets`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Failed to fetch linked datasets (${response.status})`);
      }

      const data = await response.json();
      console.log('[DatasetAttachment] Found', data.datasets?.length || 0, 'linked dataset(s)');
      const datasets = data.datasets || [];
      setLinkedDatasets(datasets);

      // Notify parent of change
      if (onDatasetsChange) {
        onDatasetsChange(datasets);
      }
    } catch (err) {
      console.error('[DatasetAttachment] Error fetching linked datasets:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch datasets');
    } finally {
      setLoadingDatasets(false);
    }
  };

  // Fetch all available datasets for dropdown
  const fetchAllDatasets = async () => {
    console.log('[DatasetAttachment] Fetching all available datasets');
    
    if (!sessionToken) {
      console.warn('[DatasetAttachment] No session token available - cannot fetch all datasets');
      return;
    }

    try {
      const response = await fetch('/api/training/dataset', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Failed to fetch available datasets (${response.status})`);
      }

      const data = await response.json();
      setAllDatasets(data.datasets || []);
      console.log('[DatasetAttachment] Loaded', data.datasets?.length || 0, 'total datasets');
    } catch (err) {
      console.error('[DatasetAttachment] Error fetching all datasets:', err);
    }
  };

  // Attach dataset to config
  const handleAttachDataset = async () => {
    if (!selectedDatasetId) {
      console.warn('[DatasetAttachment] No dataset selected for attachment');
      return;
    }

    console.log('[DatasetAttachment] Attaching dataset:', selectedDatasetId, 'to config:', configId);
    setAttaching(true);
    setError(null);

    try {
      const response = await fetch(`/api/training/${configId}/attach-dataset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ datasetId: selectedDatasetId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to attach dataset');
      }

      console.log('[DatasetAttachment] Dataset attached successfully');
      setSelectedDatasetId('');
      await fetchLinkedDatasets();
    } catch (err) {
      console.error('[DatasetAttachment] Attach error:', err);
      setError(err instanceof Error ? err.message : 'Failed to attach dataset');
    } finally {
      setAttaching(false);
    }
  };

  // Detach dataset from config
  const handleDetachDataset = async (datasetId: string) => {
    console.log('[DatasetAttachment] Detaching dataset:', datasetId, 'from config:', configId);
    setDetachingId(datasetId);
    setError(null);

    try {
      const response = await fetch(`/api/training/${configId}/attach-dataset`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ datasetId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to detach dataset');
      }

      console.log('[DatasetAttachment] Dataset detached successfully');
      await fetchLinkedDatasets();
    } catch (err) {
      console.error('[DatasetAttachment] Detach error:', err);
      setError(err instanceof Error ? err.message : 'Failed to detach dataset');
    } finally {
      setDetachingId(null);
    }
  };

  // Render component
  return (
    <div className="space-y-3">
      {/* Loading State */}
      {loadingDatasets ? (
        <Alert>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <AlertDescription>Loading datasets...</AlertDescription>
        </Alert>
      ) : linkedDatasets.length > 0 ? (
        // Linked datasets display
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Database className="h-4 w-4" />
            <span>Attached Datasets ({linkedDatasets.length})</span>
          </div>
          {linkedDatasets.map((dataset) => (
            <div
              key={dataset.id}
              className="p-3 border rounded-md bg-muted/50 space-y-1 flex items-start justify-between gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{dataset.name}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="whitespace-nowrap">Format: {dataset.format.toUpperCase()}</span>
                  <span className="whitespace-nowrap">Examples: {dataset.total_examples}</span>
                  <span className="whitespace-nowrap">Size: {(dataset.file_size_bytes / 1024).toFixed(1)} KB</span>
                </div>
              </div>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDetachDataset(dataset.id)}
                  disabled={detachingId === dataset.id}
                  className="h-6 w-6 p-0"
                  title="Detach dataset"
                >
                  {detachingId === dataset.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          ))}
          {linkedDatasets.length > 1 && (
            <p className="text-xs text-muted-foreground">
              All datasets will be combined for training
            </p>
          )}
        </div>
      ) : (
        // No datasets attached - show attach UI or message
        <div className="space-y-3">{!readOnly ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No datasets attached to this config. Attach a dataset below.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertDescription className="text-sm">
                No datasets attached to this configuration.
              </AlertDescription>
            </Alert>
          )}

          {/* Dataset attachment dropdown (only if not read-only) */}
          {!readOnly && (
            allDatasets.length > 0 ? (
              <div className="flex gap-2">
                <select
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-md text-sm min-w-0"
                  disabled={attaching}
                >
                  <option value="">Select a dataset...</option>
                  {allDatasets.map(dataset => {
                    const alreadyLinked = linkedDatasets.some(ld => ld.id === dataset.id);
                    const name = dataset.name.length > 40 ? dataset.name.substring(0, 40) + '...' : dataset.name;
                    const info = `${dataset.format.toUpperCase()}, ${dataset.total_examples} ex`;
                    const suffix = alreadyLinked ? ' - Already Attached' : '';
                    return (
                      <option
                        key={dataset.id}
                        value={dataset.id}
                        disabled={alreadyLinked}
                      >
                        {name} ({info}){suffix}
                      </option>
                    );
                  })}
                </select>
                <Button
                  onClick={handleAttachDataset}
                  disabled={!selectedDatasetId || attaching}
                  variant="outline"
                >
                  {attaching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Attach'
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                No available datasets. Upload a dataset from the Datasets tab first.
              </p>
            )
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

console.log('[DatasetAttachment] Component defined');
