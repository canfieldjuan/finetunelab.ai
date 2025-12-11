// Dataset Card Component
// Purpose: Display individual dataset with stats and actions
// Date: 2025-10-16

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Trash2, FileText, Calendar, Database, Eye } from 'lucide-react';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';
import { supabase } from '@/lib/supabaseClient';

interface DatasetCardProps {
  dataset: TrainingDatasetRecord;
  onDelete?: (datasetId: string) => void;
  isExpanded?: boolean;
  onPreviewClick?: () => void;
}

export function DatasetCard({ dataset, onDelete, isExpanded, onPreviewClick }: DatasetCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  console.log('[DatasetCard] Rendering card for:', dataset.id, 'isExpanded:', isExpanded);

  const handleDelete = async () => {
    if (!confirm(`Delete dataset "${dataset.name.replace(/_/g, ' ')}"? This cannot be undone.`)) {
      return;
    }

    console.log('[DatasetCard] Deleting dataset:', dataset.id);
    setDeleting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      const response = await fetch(`/api/training/dataset/${dataset.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete dataset');
      }

      console.log('[DatasetCard] Dataset deleted:', dataset.id);
      onDelete?.(dataset.id);
    } catch (err) {
      console.error('[DatasetCard] Delete error:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete dataset');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    console.log('[DatasetCard] Downloading dataset:', dataset.id);
    setDownloading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      console.log('[DatasetCard] Generating signed URL for:', dataset.storage_path);

      const { data: urlData, error } = await supabase.storage
        .from('training-datasets')
        .createSignedUrl(dataset.storage_path, 3600);

      if (error || !urlData) {
        throw new Error('Failed to generate download URL');
      }

      console.log('[DatasetCard] Triggering download');

      const link = document.createElement('a');
      link.href = urlData.signedUrl;
      link.download = `${dataset.name}.jsonl`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('[DatasetCard] Download started');
    } catch (err) {
      console.error('[DatasetCard] Download error:', err);
      alert(err instanceof Error ? err.message : 'Failed to download dataset');
    } finally {
      setDownloading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // If expanded, show placeholder card
  if (isExpanded) {
    return (
      <Card className="flex flex-col h-full border-2 border-primary">
        <CardContent className="flex-1 flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Eye className="h-8 w-8 mx-auto text-primary" />
            <p className="text-sm font-medium">Viewing Above</p>
            <p className="text-xs text-muted-foreground truncate px-2">
              {dataset.name.replace(/_/g, ' ')}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviewClick}
              className="mt-2"
            >
              Close Preview
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Normal card
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 flex-shrink-0" />
          <span className="truncate">{dataset.name.replace(/_/g, ' ')}</span>
        </CardTitle>
        <CardDescription className="line-clamp-2 break-words">
          {dataset.description || 'No description'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 flex-1 flex flex-col">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground min-w-0">
            <Database className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">Format: {dataset.format.toUpperCase()}</span>
          </div>
          <div className="text-muted-foreground truncate">
            Examples: {dataset.total_examples.toLocaleString()}
          </div>
          <div className="text-muted-foreground truncate">
            Size: {formatFileSize(dataset.file_size_bytes)}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground min-w-0">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{formatDate(dataset.created_at)}</span>
          </div>
        </div>

        {(dataset.avg_input_length || dataset.avg_output_length) && (
          <div className="pt-2 border-t text-xs text-muted-foreground">
            Avg lengths: Input {dataset.avg_input_length?.toFixed(0) || 'N/A'} /
            Output {dataset.avg_output_length?.toFixed(0) || 'N/A'} chars
          </div>
        )}

        <div className="space-y-2 pt-2 mt-auto">
          <div className="flex flex-wrap gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 min-w-[80px]"
              onClick={onPreviewClick}
            >
              <Eye className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">Preview</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 min-w-[80px]"
              onClick={handleDownload}
              disabled={downloading}
            >
              <Download className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">{downloading ? 'Loading...' : 'Download'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 min-w-[80px]"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">{deleting ? 'Loading...' : 'Delete'}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

console.log('[DatasetCard] Component loaded');
