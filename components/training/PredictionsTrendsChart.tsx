/**
 * Predictions Trends Chart Component
 *
 * Visualizes prediction quality trends across training epochs.
 * Shows line charts for character error rate, exact match rate, and word overlap.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import type { PredictionsTrendsResponse } from '@/lib/training/types/predictions-types';
import { useTrainingPredictionsSSE } from '@/lib/hooks/useTrainingPredictionsSSE';

interface PredictionsTrendsChartProps {
  jobId: string;
  authToken: string;
}

export function PredictionsTrendsChart({
  jobId,
  authToken,
}: PredictionsTrendsChartProps) {
  const [trendsData, setTrendsData] = useState<PredictionsTrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPredictions, setHasPredictions] = useState<boolean | null>(null);

  // SSE for live updates
  const { latestPrediction, isConnected: sseConnected } = useTrainingPredictionsSSE({
    jobId,
    authToken,
    enabled: hasPredictions === true,
  });

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
        console.warn('[PredictionsTrendsChart] Empty response body from predictions API');
        setHasPredictions(false);
        return;
      }

      const data = JSON.parse(text);
      const exists = (data.total_count || 0) > 0;
      setHasPredictions(exists);
    } catch (err) {
      console.error('[PredictionsTrendsChart] Error checking predictions:', err);
      setHasPredictions(false);
    }
  }, [jobId, authToken]);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = `/api/training/predictions/${jobId}/trends`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trends');
      }

      // Defensive JSON parsing: handle empty or truncated responses
      const text = await response.text();
      if (!text || text.trim().length === 0) {
        console.warn('[PredictionsTrendsChart] Empty response body from trends API');
        setTrendsData(null);
        return;
      }

      const data = JSON.parse(text);
      setTrendsData(data);
    } catch (err) {
      console.error('[PredictionsTrendsChart] Error fetching trends:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [jobId, authToken]);

  useEffect(() => {
    checkPredictions();
  }, [checkPredictions]);

  useEffect(() => {
    if (hasPredictions === true) {
      fetchTrends();
    } else if (hasPredictions === false) {
      setLoading(false);
    }
  }, [hasPredictions, fetchTrends]);

  // Refetch when new prediction arrives via SSE (replaces polling)
  useEffect(() => {
    if (latestPrediction && hasPredictions === true) {
      fetchTrends();
    }
  }, [latestPrediction, hasPredictions, fetchTrends]);

  if (hasPredictions === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prediction Quality Trends</CardTitle>
          <CardDescription>Checking for predictions...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prediction Quality Trends</CardTitle>
          <CardDescription>Loading trends data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8 text-gray-500">
            <div className="animate-spin mr-3 h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prediction Quality Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>Error loading trends: {error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!trendsData || trendsData.trends.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prediction Quality Trends</CardTitle>
          <CardDescription>Track quality improvement across epochs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 text-gray-500">
            <Info className="mx-auto mb-2 h-8 w-8" />
            <p className="font-medium">No prediction data available yet</p>
            <p className="text-sm mt-1">Trends will appear as training progresses</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const trends = trendsData.trends;
  const hasQualityMetrics = trends.some(
    (t) =>
      t.avg_char_error_rate !== null ||
      t.avg_exact_match !== null ||
      t.avg_word_overlap !== null
  );
  const hasValidation = trends.some(
    (t) => t.validation_pass_rate !== null && t.validation_pass_rate !== undefined
  );

  if (!hasQualityMetrics && !hasValidation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prediction Quality Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Predictions found, but no trend metrics are available.
              Ensure your dataset includes ground truth responses and/or
              enable validators.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const improvement = trendsData.overall_improvement;
  const improvementText = improvement !== null
    ? `${improvement > 0 ? '↓' : '↑'} ${Math.abs(improvement).toFixed(1)}%`
    : 'N/A';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <CardTitle>Prediction Quality Trends</CardTitle>
              <CardDescription>
                Quality metrics across {trends.length} epochs
              </CardDescription>
            </div>
            {sseConnected && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>
          {improvement !== null && (
            <div className="text-right">
              <div className="text-sm text-gray-600">Overall Improvement</div>
              <div className={`text-lg font-semibold flex items-center gap-1 ${
                improvement > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {improvement > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {improvementText}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Character Error Rate Chart */}
          {trends.some((t) => t.avg_char_error_rate !== null) && (
            <div>
              <h4 className="text-sm font-medium mb-2">Character Error Rate (CER)</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="epoch"
                    label={{ value: 'Epoch', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    label={{ value: 'Error Rate', angle: -90, position: 'insideLeft' }}
                    domain={[0, 1]}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white border border-gray-200 p-3 rounded shadow-lg">
                            <p className="font-semibold">Epoch {data.epoch}</p>
                            <p className="text-sm text-gray-600">Step {data.step}</p>
                            <p className="text-sm">Avg CER: {data.avg_char_error_rate?.toFixed(3) || 'N/A'}</p>
                            <p className="text-xs text-gray-500">
                              Range: {data.min_char_error_rate?.toFixed(3)} - {data.max_char_error_rate?.toFixed(3)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avg_char_error_rate"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Avg Error Rate"
                    dot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 mt-1">Lower is better. 0.0 = perfect match, 1.0 = completely wrong</p>
            </div>
          )}

          {/* Exact Match Rate Chart */}
          {trends.some((t) => t.avg_exact_match !== null) && (
            <div>
              <h4 className="text-sm font-medium mb-2">Exact Match Rate</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="epoch"
                    label={{ value: 'Epoch', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    label={{ value: 'Match Rate', angle: -90, position: 'insideLeft' }}
                    domain={[0, 1]}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white border border-gray-200 p-3 rounded shadow-lg">
                            <p className="font-semibold">Epoch {data.epoch}</p>
                            <p className="text-sm">
                              Exact Match: {((data.avg_exact_match || 0) * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-gray-500">{data.sample_count} samples</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avg_exact_match"
                    stroke="#22c55e"
                    strokeWidth={2}
                    name="Exact Match %"
                    dot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 mt-1">Higher is better. 1.0 = perfect match</p>
            </div>
          )}

          {/* Word Overlap Chart */}
          {trends.some((t) => t.avg_word_overlap !== null) && (
            <div>
              <h4 className="text-sm font-medium mb-2">Word Overlap</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="epoch"
                    label={{ value: 'Epoch', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    label={{ value: 'Overlap Score', angle: -90, position: 'insideLeft' }}
                    domain={[0, 1]}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white border border-gray-200 p-3 rounded shadow-lg">
                            <p className="font-semibold">Epoch {data.epoch}</p>
                            <p className="text-sm">
                              Word Overlap: {((data.avg_word_overlap || 0) * 100).toFixed(1)}%
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avg_word_overlap"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Word Overlap"
                    dot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 mt-1">Higher is better. Measures word-level similarity</p>
            </div>
          )}

          {/* Validation Pass Rate Chart */}
          {hasValidation && (
            <div>
              <h4 className="text-sm font-medium mb-2">Validation Pass Rate</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="epoch"
                    label={{ value: 'Epoch', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    label={{ value: 'Pass Rate', angle: -90, position: 'insideLeft' }}
                    domain={[0, 1]}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const rate = data.validation_pass_rate;
                        return (
                          <div className="bg-white border border-gray-200 p-3 rounded shadow-lg">
                            <p className="font-semibold">Epoch {data.epoch}</p>
                            <p className="text-sm">
                              Pass Rate: {rate == null ? 'N/A' : `${(rate * 100).toFixed(1)}%`}
                            </p>
                            <p className="text-xs text-gray-500">{data.sample_count} samples</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="validation_pass_rate"
                    stroke="#22c55e"
                    strokeWidth={2}
                    name="Validation Pass %"
                    dot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 mt-1">Higher is better. 1.0 = all outputs passed validation</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
