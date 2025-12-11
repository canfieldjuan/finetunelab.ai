/**
 * Predictions Comparison Component
 *
 * Side-by-side comparison of predictions across epochs for a specific sample.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { TrainingPrediction } from '@/lib/training/types/predictions-types';

interface PredictionsComparisonProps {
  jobId: string;
  authToken: string;
}

export function PredictionsComparison({
  jobId,
  authToken,
}: PredictionsComparisonProps) {
  const [predictions, setPredictions] = useState<TrainingPrediction[]>([]);
  const [selectedSample, setSelectedSample] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPredictions, setHasPredictions] = useState<boolean | null>(null);

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

  const fetchAllPredictions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = `/api/training/predictions/${jobId}?limit=1000`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch predictions');
      }

      const data = await response.json();
      setPredictions(data.predictions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [jobId, authToken]);

  // Initial check on mount
  useEffect(() => {
    checkPredictions();
  }, [checkPredictions]);

  // Only fetch predictions if they exist
  useEffect(() => {
    if (hasPredictions === true) {
      fetchAllPredictions();
    } else if (hasPredictions === false) {
      setLoading(false);
    }
  }, [hasPredictions, fetchAllPredictions]);

  const sampleIndices = [
    ...new Set(predictions.map((p) => p.sample_index)),
  ].sort((a, b) => a - b);

  const selectedPredictions = predictions
    .filter((p) => p.sample_index === selectedSample)
    .sort((a, b) => a.epoch - b.epoch);

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

  if (loading && hasPredictions === true) {
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
              No predictions available for comparison.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const prompt =
    selectedPredictions.length > 0 ? selectedPredictions[0].prompt : '';
  const groundTruth =
    selectedPredictions.length > 0 ? selectedPredictions[0].ground_truth : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Prediction Evolution</CardTitle>
            <CardDescription>
              Track how predictions improve across epochs
            </CardDescription>
          </div>
          {sampleIndices.length > 0 && (
            <Select
              value={selectedSample.toString()}
              onValueChange={(value) => setSelectedSample(parseInt(value, 10))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sampleIndices.map((idx) => (
                  <SelectItem key={idx} value={idx.toString()}>
                    Sample #{idx}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Prompt</h4>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">{prompt}</p>
          </div>
        </div>

        {groundTruth && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Ground Truth</h4>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-900">{groundTruth}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h4 className="text-sm font-medium">Predictions Over Time</h4>
          {selectedPredictions.map((pred, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === selectedPredictions.length - 1;

            let trendIcon = <Minus className="w-3 h-3" />;
            if (!isFirst) {
              const prevLength = selectedPredictions[idx - 1].prediction.length;
              const currLength = pred.prediction.length;
              if (currLength > prevLength) {
                trendIcon = <TrendingUp className="w-3 h-3 text-green-600" />;
              } else if (currLength < prevLength) {
                trendIcon = <TrendingDown className="w-3 h-3 text-red-600" />;
              }
            }

            return (
              <div
                key={pred.id}
                className={`p-4 rounded-lg border ${
                  isLast
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-background border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={isLast ? 'default' : 'secondary'}>
                      Epoch {pred.epoch}
                    </Badge>
                    {!isFirst && trendIcon}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Step {pred.step}
                  </span>
                </div>
                <p className="text-sm">{pred.prediction}</p>
                {isLast && (
                  <p className="text-xs text-blue-600 mt-2 font-medium">
                    Latest prediction
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {selectedPredictions.length > 1 && (
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              <p className="text-sm">
                Showing {selectedPredictions.length} predictions across{' '}
                {selectedPredictions.length} epochs
              </p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
