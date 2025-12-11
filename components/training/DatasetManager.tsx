// Dataset Manager Component
// Purpose: Consolidated view for uploading and managing datasets
// Date: 2025-10-29

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DatasetCard } from './DatasetCard';
import { DatasetExpandedPreview } from './DatasetExpandedPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Upload, Search, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';
import { supabase } from '@/lib/supabaseClient';

type DatasetFormat = 'chatml' | 'sharegpt' | 'jsonl' | 'dpo' | 'rlhf' | 'alpaca' | 'openorca' | 'unnatural';

interface DatasetManagerProps {
  sessionToken?: string;
  configId?: string;
}

export function DatasetManager({ sessionToken, configId }: DatasetManagerProps) {
  // Dataset list state
  const [datasets, setDatasets] = useState<TrainingDatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDatasetId, setExpandedDatasetId] = useState<string | null>(null);

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<DatasetFormat>('chatml');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(true);

  console.log('[DatasetManager] expandedDatasetId:', expandedDatasetId);

  const fetchDatasets = useCallback(async () => {
    console.log('[DatasetManager] Fetching datasets');
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
      console.log('[DatasetManager] Loaded', data.datasets?.length || 0, 'datasets');
      setDatasets(data.datasets || []);
    } catch (err) {
      console.error('[DatasetManager] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load datasets');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (sessionToken) {
      fetchDatasets();
    }
  }, [sessionToken, fetchDatasets]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!name) {
        setName(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
      setUploadError(null);
      setUploadSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !name) {
      setUploadError('Please select a file and provide a name');
      return;
    }

    console.log('[DatasetManager] Starting upload:', name);
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      formData.append('format', format);
      if (description) formData.append('description', description);
      if (configId) formData.append('config_id', configId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      const response = await fetch('/api/training/dataset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('[DatasetManager] Upload failed:', data);
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      console.log('[DatasetManager] Upload successful:', data.dataset.id);

      setUploadSuccess(true);
      setFile(null);
      setName('');
      setDescription('');

      // Refresh dataset list
      fetchDatasets();

      // Auto-hide success message after 3 seconds
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err) {
      console.error('[DatasetManager] Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (datasetId: string) => {
    console.log('[DatasetManager] Removing dataset from list:', datasetId);
    setDatasets((prev) => prev.filter((d) => d.id !== datasetId));
    if (expandedDatasetId === datasetId) {
      console.log('[DatasetManager] Closing expanded view for deleted dataset');
      setExpandedDatasetId(null);
    }
  };

  const handleExpand = (datasetId: string) => {
    console.log('[DatasetManager] Expanding dataset:', datasetId);
    setExpandedDatasetId(datasetId);
  };

  const handleCollapse = () => {
    console.log('[DatasetManager] Collapsing expanded view');
    setExpandedDatasetId(null);
  };

  const filteredDatasets = datasets
    .filter((dataset) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        dataset.name.toLowerCase().includes(query) ||
        (dataset.description?.toLowerCase().includes(query) || false) ||
        dataset.format.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Upload Form Section */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setShowUploadForm(!showUploadForm)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Upload Training Dataset</CardTitle>
              <CardDescription>
                Upload your training data in ChatML, ShareGPT, JSONL, DPO, RLHF, Alpaca, OpenOrca, or Unnatural Instructions format
              </CardDescription>
            </div>
            {showUploadForm ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        </CardHeader>

        {showUploadForm && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dataset-file">Dataset File</Label>
              <Input
                id="dataset-file"
                type="file"
                accept=".jsonl,.json,.csv,.txt,.parquet"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                Supported: .jsonl, .json, .csv, .txt, .parquet
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataset-name">Name</Label>
              <Input
                id="dataset-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Training Dataset"
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataset-description">Description (optional)</Label>
              <Input
                id="dataset-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your dataset..."
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataset-format">Format</Label>
              <Select value={format} onValueChange={(v: DatasetFormat) => setFormat(v)} disabled={uploading}>
                <SelectTrigger id="dataset-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chatml">ChatML</SelectItem>
                  <SelectItem value="sharegpt">ShareGPT</SelectItem>
                  <SelectItem value="jsonl">Generic JSONL</SelectItem>
                  <SelectItem value="dpo">DPO (Preference Pairs)</SelectItem>
                  <SelectItem value="rlhf">RLHF (Reward Labeled)</SelectItem>
                  <SelectItem value="alpaca">Alpaca (Instruction-Input-Output)</SelectItem>
                  <SelectItem value="openorca">OpenOrca (System-Question-Response)</SelectItem>
                  <SelectItem value="unnatural">Unnatural Instructions (Task-Based)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Dataset uploaded successfully!</span>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!file || !name || uploading}
              variant="secondary"
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Dataset
                </>
              )}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Dataset List Section */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchDatasets} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : datasets.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No datasets yet</h3>
          <p className="text-muted-foreground mb-4">
            Upload your first training dataset using the form above
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}

console.log('[DatasetManager] Component loaded');
