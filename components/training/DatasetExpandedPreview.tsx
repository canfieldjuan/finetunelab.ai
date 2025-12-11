// Dataset Expanded Preview Component
// Purpose: Full-width preview display above grid
// Date: 2025-10-26

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2, X, FileText, Database, Calendar } from 'lucide-react';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';
import { supabase } from '@/lib/supabaseClient';

import { JsonValue } from '@/lib/types';

interface DatasetExample {
  index: number;
  data: JsonValue;
  error?: string;
}

interface DatasetExpandedPreviewProps {
  dataset: TrainingDatasetRecord;
  onClose: () => void;
}

export function DatasetExpandedPreview({ dataset, onClose }: DatasetExpandedPreviewProps) {
  const [examples, setExamples] = useState<DatasetExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;

  console.log('[DatasetExpandedPreview] Rendering for dataset:', dataset.id);

  const fetchPreview = useCallback(async () => {
    console.log('[DatasetExpandedPreview] Fetching preview for:', dataset.id, 'offset:', offset);
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      const response = await fetch(
        `/api/training/dataset/${dataset.id}?offset=${offset}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch preview');
      }

      const data = await response.json();
      console.log('[DatasetExpandedPreview] Loaded', data.examples.length, 'examples');
      setExamples(data.examples);
      setTotal(data.total);
      setHasMore(data.has_more);
    } catch (err) {
      console.error('[DatasetExpandedPreview] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, [dataset.id, offset, limit]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const handlePrevious = () => {
    if (offset > 0) {
      console.log('[DatasetExpandedPreview] Previous page');
      setOffset(Math.max(0, offset - limit));
    }
  };

  const handleNext = () => {
    if (hasMore) {
      console.log('[DatasetExpandedPreview] Next page');
      setOffset(offset + limit);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Dataset Preview</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Dataset Preview</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="py-12">
          <p className="text-center text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return (
    <Card className="w-full border-2 border-primary">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary flex-shrink-0" />
            <div>
              <CardTitle className="text-lg">{dataset.name.replace(/_/g, ' ')}</CardTitle>
              <CardDescription>
                {dataset.description || 'No description'}
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Format</p>
            <p className="text-sm font-medium flex items-center gap-1">
              <Database className="h-3 w-3" />
              {dataset.format.toUpperCase()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Examples</p>
            <p className="text-sm font-medium">{dataset.total_examples.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">File Size</p>
            <p className="text-sm font-medium">{formatFileSize(dataset.file_size_bytes)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(dataset.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <p className="text-sm font-medium">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} examples
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrevious}
              disabled={offset === 0}
              variant="outline"
              size="sm"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              onClick={handleNext}
              disabled={!hasMore}
              variant="outline"
              size="sm"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {examples.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No examples found</p>
        ) : (
          <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-2">
            {examples.map((example) => (
              <div key={example.index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Example #{example.index + 1}
                  </span>
                  {example.error && (
                    <span className="text-xs text-red-600">{example.error}</span>
                  )}
                </div>
                <div className="bg-muted p-4 rounded-md">
                  <pre className="text-sm whitespace-pre-wrap break-words overflow-x-auto">
                    <code>{JSON.stringify(example.data, null, 2)}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

console.log('[DatasetExpandedPreview] Component loaded');
