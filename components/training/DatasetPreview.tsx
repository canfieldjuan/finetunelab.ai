// Dataset Preview Component
// Purpose: Display dataset examples with pagination
// Date: 2025-10-16

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

import { JsonValue } from '@/lib/types';

interface DatasetExample {
  index: number;
  data: JsonValue;
  error?: string;
}

interface DatasetPreviewProps {
  datasetId: string;
  datasetName: string;
}

export function DatasetPreview({ datasetId, datasetName }: DatasetPreviewProps) {
  const [examples, setExamples] = useState<DatasetExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 10;

  const fetchPreview = useCallback(async () => {
    console.log('[DatasetPreview] Fetching preview for:', datasetId, 'offset:', offset);
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      const response = await fetch(
        `/api/training/dataset/${datasetId}?offset=${offset}&limit=${limit}`,
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
      console.log('[DatasetPreview] Loaded', data.examples.length, 'examples');
      setExamples(data.examples);
      setTotal(data.total);
      setHasMore(data.has_more);
    } catch (err) {
      console.error('[DatasetPreview] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, [datasetId, offset, limit]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const handlePrevious = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const handleNext = () => {
    if (hasMore) {
      setOffset(offset + limit);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base truncate">Preview: {datasetName}</CardTitle>
        <CardDescription className="truncate">
          Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} examples
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {examples.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No examples found</p>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {examples.map((example) => (
              <div key={example.index} className="border rounded-lg p-3 space-y-2 min-w-0">
                <div className="flex items-center justify-between min-w-0">
                  <span className="text-sm font-medium text-muted-foreground truncate">
                    Example #{example.index + 1}
                  </span>
                  {example.error && (
                    <span className="text-xs text-red-600 truncate ml-2">{example.error}</span>
                  )}
                </div>
                <div className="bg-muted p-3 rounded-md overflow-x-auto max-w-full">
                  <pre className="text-xs whitespace-pre-wrap break-words min-w-0">
                    <code className="block">{JSON.stringify(example.data, null, 2)}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
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
      </CardContent>
    </Card>
  );
}

console.log('[DatasetPreview] Component loaded');
