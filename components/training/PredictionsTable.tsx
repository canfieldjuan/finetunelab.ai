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
import { Badge } from '@/components/ui/badge';
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

      // Defensive JSON parsing: handle empty or truncated responses
      const text = await response.text();
      if (!text || text.trim().length === 0) {
        console.warn('[PredictionsTable] Empty response body from predictions API');
        setHasPredictions(false);
        return;
      }

      const data = JSON.parse(text);
      const exists = (data.total_count || 0) > 0;
      setHasPredictions(exists);
    } catch (err) {
      console.error('[PredictionsTable] Error checking predictions:', err);
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

      // Defensive JSON parsing: handle empty or truncated responses
      const text = await response.text();
      if (!text || text.trim().length === 0) {
        console.warn('[PredictionsTable] Empty response body from epochs API');
        setEpochs([]);
        return;
      }

      const data = JSON.parse(text);
      setEpochs(data.epochs || []);
    } catch (err) {
      console.error('[PredictionsTable] Error fetching epochs:', err);
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

      // Defensive JSON parsing: handle empty or truncated responses
      const text = await response.text();
      if (!text || text.trim().length === 0) {
        console.warn('[PredictionsTable] Empty response body from predictions API');
        setPredictions([]);
        setTotalCount(0);
        return;
      }

      const data = JSON.parse(text);
      setPredictions(data.predictions || []);
      setTotalCount(data.total_count || 0);
    } catch (err) {
      console.error('[PredictionsTable] Error fetching predictions:', err);
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

  const getValidationStatus = (pred: TrainingPrediction) => {
    if (pred.validation_pass === true) {
      return { label: 'Valid', variant: 'secondary' as const };
    }
    if (pred.validation_pass === false) {
      return { label: 'Invalid', variant: 'destructive' as const };
    }
    return { label: 'Not run', variant: 'outline' as const };
  };

  const getValidationErrorCount = (errors: unknown): number | null => {
    if (errors == null) return null;
    if (Array.isArray(errors)) return errors.length;
    if (typeof errors === 'string') return errors.trim() ? 1 : 0;
    if (typeof errors === 'object') return 1;
    return 1;
  };

  const formatValidationErrors = (errors: unknown): string | null => {
    if (errors == null) return null;
    if (typeof errors === 'string') return errors;
    try {
      return JSON.stringify(errors, null, 2);
    } catch {
      return String(errors);
    }
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
                  <th className="px-4 py-2 text-left text-sm font-medium">
                    Validation
                  </th>
                  <th className="px-4 py-2 text-center text-sm font-medium w-16">
                    View
                  </th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((pred) => {
                  const isExpanded = expandedRows.has(pred.id);
                  const validationStatus = getValidationStatus(pred);
                  const validationErrorCount = getValidationErrorCount(
                    pred.validation_errors
                  );
                  const validationErrorText = formatValidationErrors(
                    pred.validation_errors
                  );
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
                        <div className="space-y-2">
                          <div>
                            {isExpanded
                              ? pred.prediction
                              : truncate(pred.prediction)}
                          </div>
                          {isExpanded &&
                            pred.validation_pass === false &&
                            validationErrorText && (
                              <pre className="text-xs p-2 bg-muted rounded border overflow-auto max-h-40 whitespace-pre-wrap">
                                {validationErrorText}
                              </pre>
                            )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={validationStatus.variant}
                            title={pred.validation_kind || undefined}
                          >
                            {validationStatus.label}
                          </Badge>
                          {pred.validation_pass === false &&
                            validationErrorCount != null &&
                            validationErrorCount > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {validationErrorCount} error
                                {validationErrorCount === 1 ? '' : 's'}
                              </span>
                            )}
                        </div>
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
