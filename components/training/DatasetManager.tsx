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
import { RefreshCw, Upload, Search, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import type { TrainingDatasetRecord, StorageProvider } from '@/lib/training/dataset.types';
import { supabase } from '@/lib/supabaseClient';

type DatasetFormat = 'chatml' | 'sharegpt' | 'jsonl' | 'dpo' | 'rlhf' | 'alpaca' | 'openorca' | 'unnatural' | 'raw_text';

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

  // Filter state
  const [filterFormat, setFilterFormat] = useState<string>('all');
  const [filterSize, setFilterSize] = useState<string>('all');
  const [filterStorage, setFilterStorage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<DatasetFormat>('chatml');
  const [storageProvider, setStorageProvider] = useState<StorageProvider>('supabase');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

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
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    const validExtensions = ['.jsonl', '.json', '.csv', '.txt', '.parquet'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      setUploadError('Invalid file type. Supported: .jsonl, .json, .csv, .txt, .parquet');
      return;
    }

    setFile(selectedFile);
    if (!name) {
      setName(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
    setUploadError(null);
    setUploadSuccess(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (uploading) return;

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
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
      formData.append('storage_provider', storageProvider);
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
      // Text search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = (
          dataset.name.toLowerCase().includes(query) ||
          (dataset.description?.toLowerCase().includes(query) || false) ||
          dataset.format.toLowerCase().includes(query)
        );
        if (!matchesSearch) return false;
      }

      // Format filter
      if (filterFormat !== 'all' && dataset.format !== filterFormat) {
        return false;
      }

      // Storage provider filter
      if (filterStorage !== 'all' && dataset.storage_provider !== filterStorage) {
        return false;
      }

      // Size filter
      if (filterSize !== 'all') {
        const sizeBytes = dataset.file_size_bytes;
        const KB = 1024;
        const MB = KB * 1024;
        switch (filterSize) {
          case 'small': // < 1MB
            if (sizeBytes >= MB) return false;
            break;
          case 'medium': // 1MB - 10MB
            if (sizeBytes < MB || sizeBytes >= 10 * MB) return false;
            break;
          case 'large': // > 10MB
            if (sizeBytes < 10 * MB) return false;
            break;
        }
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.file_size_bytes - a.file_size_bytes;
        case 'examples':
          return b.total_examples - a.total_examples;
        default:
          return 0;
      }
    });

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
              <div
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : file
                    ? 'border-green-500 bg-green-50 dark:bg-green-950'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                } ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  id="dataset-file"
                  type="file"
                  accept=".jsonl,.json,.csv,.txt,.parquet"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <Upload className={`h-8 w-8 mx-auto mb-2 ${
                  isDragging ? 'text-blue-500' : file ? 'text-green-500' : 'text-muted-foreground'
                }`} />
                {file ? (
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      {isDragging ? 'Drop file here' : 'Drag and drop or click to select'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      .jsonl, .json, .csv, .txt, .parquet
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storage-provider">Storage Provider</Label>
              <Select
                value={storageProvider}
                onValueChange={(v: StorageProvider) => setStorageProvider(v)}
                disabled={uploading}
              >
                <SelectTrigger id="storage-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supabase">Supabase Storage</SelectItem>
                  <SelectItem value="s3">AWS S3</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose where to store your dataset. RunPod uses Supabase, AWS SageMaker uses S3.
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
              <Label htmlFor="dataset-description">Description</Label>
              <Input
                id="dataset-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your dataset (optional)..."
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
                  <SelectItem value="raw_text">Raw Text (Continued Pre-Training)</SelectItem>
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

          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />

              <Select value={filterFormat} onValueChange={setFilterFormat}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Formats</SelectItem>
                  <SelectItem value="chatml">ChatML</SelectItem>
                  <SelectItem value="sharegpt">ShareGPT</SelectItem>
                  <SelectItem value="jsonl">JSONL</SelectItem>
                  <SelectItem value="dpo">DPO</SelectItem>
                  <SelectItem value="rlhf">RLHF</SelectItem>
                  <SelectItem value="alpaca">Alpaca</SelectItem>
                  <SelectItem value="openorca">OpenOrca</SelectItem>
                  <SelectItem value="unnatural">Unnatural</SelectItem>
                  <SelectItem value="raw_text">Raw Text</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSize} onValueChange={setFilterSize}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  <SelectItem value="small">&lt; 1 MB</SelectItem>
                  <SelectItem value="medium">1-10 MB</SelectItem>
                  <SelectItem value="large">&gt; 10 MB</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStorage} onValueChange={setFilterStorage}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Storage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Storage</SelectItem>
                  <SelectItem value="supabase">Supabase</SelectItem>
                  <SelectItem value="s3">AWS S3</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="size">Largest First</SelectItem>
                  <SelectItem value="examples">Most Examples</SelectItem>
                </SelectContent>
              </Select>

              {(filterFormat !== 'all' || filterSize !== 'all' || filterStorage !== 'all' || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => {
                    setFilterFormat('all');
                    setFilterSize('all');
                    setFilterStorage('all');
                    setSearchQuery('');
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
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
                Try adjusting your search or filters
              </p>
              <Button
                onClick={() => {
                  setSearchQuery('');
                  setFilterFormat('all');
                  setFilterSize('all');
                  setFilterStorage('all');
                }}
                variant="outline"
              >
                Clear All Filters
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
