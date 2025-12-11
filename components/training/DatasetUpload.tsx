// Dataset Upload Component
// Purpose: Upload training datasets with format validation
// Date: 2025-10-16

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { DatasetFormatExamples } from './DatasetFormatExamples';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';

interface DatasetUploadProps {
  configId?: string;
  onUploadSuccess?: (dataset: TrainingDatasetRecord) => void;
}

export type DatasetFormat = 'chatml' | 'sharegpt' | 'jsonl' | 'dpo' | 'rlhf' | 'alpaca' | 'openorca' | 'unnatural';

export function DatasetUpload({ configId, onUploadSuccess }: DatasetUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<DatasetFormat>('chatml');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!name) {
        setName(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
      setError(null);
      setSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !name) {
      setError('Please select a file and provide a name');
      return;
    }

    console.log('[DatasetUpload] Starting upload:', name);
    setUploading(true);
    setError(null);

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
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      console.log('[DatasetUpload] Upload successful:', data.dataset.id);

      setSuccess(true);
      setFile(null);
      setName('');
      setDescription('');

      if (onUploadSuccess) {
        onUploadSuccess(data.dataset);
      }
    } catch (err) {
      console.error('[DatasetUpload] Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Training Dataset</CardTitle>
        <CardDescription>
          Upload your training data in ChatML, ShareGPT, JSONL, DPO/ORPO, RLHF, Alpaca, OpenOrca, or Unnatural Instructions format
        </CardDescription>
      </CardHeader>
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
              <SelectItem value="dpo">DPO/ORPO (Preference Pairs)</SelectItem>
              <SelectItem value="rlhf">RLHF (Reward Labeled)</SelectItem>
              <SelectItem value="alpaca">Alpaca (Instruction-Input-Output)</SelectItem>
              <SelectItem value="openorca">OpenOrca (System-Question-Response)</SelectItem>
              <SelectItem value="unnatural">Unnatural Instructions (Task-Based)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">
            Select the format that matches your dataset structure. Examples below.
          </p>
        </div>

        {/* Format Examples */}
        <div className="mt-4">
          <DatasetFormatExamples selectedFormat={format} />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {success && (
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
    </Card>
  );
}

console.log('[DatasetUpload] Component loaded');
