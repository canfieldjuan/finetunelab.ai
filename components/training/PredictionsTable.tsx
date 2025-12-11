/**
 * Predictions Table Component
 *
 * Displays training predictions in tabular format with filtering and pagination.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  Info,
} from 'lucide-react';
import type {
  TrainingPrediction,
  PredictionsEpochSummary,
} from '@/lib/training/types/predictions-types';

interface PredictionsTableProps {
  jobId: string;
  authToken: string;
}

export function PredictionsTable({
  jobId,
  authToken,
}: PredictionsTableProps) {
  const [predictions, setPredictions] = useState<TrainingPrediction[]>([]);
  const [epochs, setEpochs] = useState<PredictionsEpochSummary[]>([]);
  const [selectedEpoch, setSelectedEpoch] = useState<number | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasPredictions, setHasPredictions] = useState<boolean | null>(null);

  const pageSize = 10;

  // Check if predictions exist before polling
  const checkPredictions = useCallback(async () => {
    try {
      const url = `/api/training/predictions/${jobId}?limit=1`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        setHasPredictions(false);
        return;
      }

      const data = await response.json();
      const exists = (data.total_count || 0) > 0;
      setHasPredictions(exists);
    } catch (err) {
      console.error('Error checking predictions:', err);
      setHasPredictions(false);
    }
  }, [jobId, authToken]);

  const fetchEpochs = useCallback(async () => {
    try {
      const url = `/api/training/predictions/${jobId}/epochs`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch epochs');
      }

      const data = await response.json();
      setEpochs(data.epochs || []);
    } catch (err) {
      console.error('Error fetching epochs:', err);
    }
  }, [jobId, authToken]);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (page * pageSize).toString(),
      });

      if (selectedEpoch !== null) {
        params.set('epoch', selectedEpoch.toString());
      }

      const url = `/api/training/predictions/${jobId}?${params}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch predictions');
      }

      const data = await response.json();
      setPredictions(data.predictions || []);
      setTotalCount(data.total_count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [jobId, authToken, page, selectedEpoch]);

  // Initial check on mount
  useEffect(() => {
    checkPredictions();
  }, [checkPredictions]);

  // Only fetch epochs if predictions exist
  useEffect(() => {
    if (hasPredictions === true) {
      fetchEpochs();
    }
  }, [hasPredictions, fetchEpochs]);

  // Only fetch predictions if they exist
  useEffect(() => {
    if (hasPredictions === true) {
      fetchPredictions();
    } else if (hasPredictions === false) {
      setLoading(false);
    }
  }, [hasPredictions, fetchPredictions]);

  const toggleRow = (predId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(predId)) {
        next.delete(predId);
      } else {
        next.add(predId);
      }
      return next;
    });
  };

  const truncate = (text: string, maxLen: number = 100) => {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + '...';
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Still checking if predictions exist
  if (hasPredictions === null) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Checking for predictions...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading && predictions.length === 0 && hasPredictions === true) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Loading predictions...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Error: {error}</AlertDescription>
      </Alert>
    );
  }

  if (predictions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              No predictions available. Predictions are generated during
              training when enabled.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Training Predictions</CardTitle>
            <CardDescription>
              Model predictions on sample prompts across epochs
            </CardDescription>
          </div>
          {epochs.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select
                value={selectedEpoch?.toString() || 'all'}
                onValueChange={(value) =>
                  setSelectedEpoch(value === 'all' ? null : parseInt(value, 10))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All epochs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All epochs</SelectItem>
                  {epochs.map((epoch) => (
                    <SelectItem key={epoch.epoch} value={epoch.epoch.toString()}>
                      Epoch {epoch.epoch} ({epoch.prediction_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Epoch
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Sample
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Prompt
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Prediction
                  </th>
                  <th className="px-4 py-2 text-center text-sm font-medium w-16">
                    View
                  </th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((pred) => {
                  const isExpanded = expandedRows.has(pred.id);
                  return (
                    <tr key={pred.id} className="border-t hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm">{pred.epoch}</td>
                      <td className="px-4 py-3 text-sm">
                        #{pred.sample_index}
                      </td>
                      <td className="px-4 py-3 text-sm max-w-xs">
                        {isExpanded ? pred.prompt : truncate(pred.prompt)}
                      </td>
                      <td className="px-4 py-3 text-sm max-w-xs">
                        {isExpanded
                          ? pred.prediction
                          : truncate(pred.prediction)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRow(pred.id)}
                        >
                          {isExpanded ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1}-
                {Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
