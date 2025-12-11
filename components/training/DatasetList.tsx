// Dataset List Component
// Purpose: Display and manage all user datasets
// Date: 2025-10-16

'use client';

import { useState, useCallback } from 'react';
import { DatasetCard } from './DatasetCard';
import { DatasetExpandedPreview } from './DatasetExpandedPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Upload, Search } from 'lucide-react';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';
import { supabase } from '@/lib/supabaseClient';

interface DatasetListProps {
  onUploadClick?: () => void;
  sessionToken?: string;
}

export function DatasetList({ onUploadClick, sessionToken }: DatasetListProps) {
  const [datasets, setDatasets] = useState<TrainingDatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDatasetId, setExpandedDatasetId] = useState<string | null>(null);

  console.log('[DatasetList] expandedDatasetId:', expandedDatasetId);

  const fetchDatasets = useCallback(async () => {
    console.log('[DatasetList] Fetching datasets');
    setLoading(true);
    setError(null);

    try {
      let token = sessionToken;
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated. Please log in.');
        }
        token = session.access_token;
      }

      const response = await fetch('/api/training/dataset', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch datasets');
      }

      const data = await response.json();
      console.log('[DatasetList] Loaded', data.datasets?.length || 0, 'datasets');
      setDatasets(data.datasets || []);
    } catch (err) {
      console.error('[DatasetList] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load datasets');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  const handleDelete = (datasetId: string) => {
    console.log('[DatasetList] Removing dataset from list:', datasetId);
    setDatasets((prev) => prev.filter((d) => d.id !== datasetId));
    if (expandedDatasetId === datasetId) {
      console.log('[DatasetList] Closing expanded view for deleted dataset');
      setExpandedDatasetId(null);
    }
  };

  const handleExpand = (datasetId: string) => {
    console.log('[DatasetList] Expanding dataset:', datasetId);
    setExpandedDatasetId(datasetId);
  };

  const handleCollapse = () => {
    console.log('[DatasetList] Collapsing expanded view');
    setExpandedDatasetId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={fetchDatasets} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No datasets yet</h3>
        <p className="text-muted-foreground mb-4">
          Upload your first training dataset to get started
        </p>
        <Button onClick={onUploadClick}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Dataset
        </Button>
      </div>
    );
  }

  const filteredDatasets = datasets.filter((dataset) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      dataset.name.toLowerCase().includes(query) ||
      (dataset.description?.toLowerCase().includes(query) || false) ||
      dataset.format.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          My Datasets ({filteredDatasets.length}{filteredDatasets.length !== datasets.length ? ` of ${datasets.length}` : ''})
        </h2>
        <Button onClick={fetchDatasets} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search datasets by name, description, or format..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {expandedDatasetId && (
        <div className="mb-4">
          <DatasetExpandedPreview
            dataset={filteredDatasets.find(d => d.id === expandedDatasetId)!}
            onClose={handleCollapse}
          />
        </div>
      )}

      {filteredDatasets.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No datasets found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search query
          </p>
          <Button onClick={() => setSearchQuery('')} variant="outline">
            Clear Search
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
          {filteredDatasets.map((dataset) => (
            <div key={dataset.id} className="min-w-0">
              <DatasetCard
                dataset={dataset}
                onDelete={handleDelete}
                isExpanded={dataset.id === expandedDatasetId}
                onPreviewClick={() => handleExpand(dataset.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

console.log('[DatasetList] Component loaded');
