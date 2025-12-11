/**
 * Sentiment Trend Chart Component
 *
 * Displays sentiment trends over time with line charts.
 * Shows positive, neutral, and negative sentiment distribution.
 *
 * Phase 3.3: Advanced Sentiment Analysis
 * Date: 2025-10-25
 */

"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { RefreshCw } from 'lucide-react';
import type { SentimentTrend } from '@/lib/services/sentiment.service';
import { supabase } from '@/lib/supabaseClient';

interface SentimentTrendChartProps {
  startDate?: string;
  endDate?: string;
  onRefresh?: () => void;
}

export default function SentimentTrendChart({
  startDate,
  endDate,
  onRefresh
}: SentimentTrendChartProps) {
  console.log('[SentimentTrendChart] Rendering with dates:', { startDate, endDate });

  const [trends, setTrends] = useState<SentimentTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'counts' | 'satisfaction'>('counts');

  const fetchTrends = useCallback(async () => {
    console.log('[SentimentTrendChart] Starting fetch');
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(
        `/api/analytics/sentiment/trends?${params}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch sentiment trends');
      }

      const data = await response.json();
      console.log('[SentimentTrendChart] Received', data.trends.length, 'trends');
      setTrends(data.trends);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load trends';
      console.error('[SentimentTrendChart] Error:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    console.log('[SentimentTrendChart] Fetching trends');
    fetchTrends();
  }, [fetchTrends]);

  const handleRefresh = () => {
    console.log('[SentimentTrendChart] Manual refresh triggered');
    fetchTrends();
    if (onRefresh) onRefresh();
  };

  const getMaxCount = (): number => {
    if (trends.length === 0) return 1;
    return Math.max(
      ...trends.map(t => Math.max(t.positive_count, t.neutral_count, t.negative_count))
    );
  };

  const getYPosition = (value: number): number => {
    const max = getMaxCount();
    return 100 - ((value / max) * 90);
  };

  const generateLinePoints = (getCount: (t: SentimentTrend) => number): string => {
    if (trends.length === 0) return '';
    return trends.map((trend, index) => {
      const x = (index / (trends.length - 1)) * 100;
      const y = getYPosition(getCount(trend));
      return `${x},${y}`;
    }).join(' ');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-gray-600">
            Loading sentiment trends...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={handleRefresh}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trends.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-gray-600">
            No sentiment data available for this time period.
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxCount = getMaxCount();
  const positivePoints = generateLinePoints(t => t.positive_count);
  const neutralPoints = generateLinePoints(t => t.neutral_count);
  const negativePoints = generateLinePoints(t => t.negative_count);

  console.log('[SentimentTrendChart] Chart data:', {
    maxCount,
    trends: trends.map(t => ({
      date: t.date,
      positive: t.positive_count,
      neutral: t.neutral_count,
      negative: t.negative_count
    })),
    positivePoints,
    neutralPoints,
    negativePoints
  });

  const totalConversations = trends.reduce((sum, t) => sum + t.total_conversations, 0);
  const avgSatisfaction = trends.reduce((sum, t) => sum + t.average_satisfaction, 0) / trends.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sentiment Trends</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Sentiment distribution over time (auto-analyzed from message text)
            </p>
          </div>
          <div className="flex gap-2">
            <select
              className="border rounded px-3 py-1 text-sm"
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as 'counts' | 'satisfaction')}
            >
              <option value="counts">Sentiment Counts</option>
              <option value="satisfaction">Satisfaction Score</option>
            </select>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {selectedMetric === 'counts' ? (
          <div className="space-y-4">
            <div className="relative h-64 border rounded bg-gray-50 p-4">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                  points={positivePoints}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="0.5"
                  vectorEffect="non-scaling-stroke"
                />
                <polyline
                  points={neutralPoints}
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="0.5"
                  vectorEffect="non-scaling-stroke"
                />
                <polyline
                  points={negativePoints}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="0.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            <div className="flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Positive</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-500 rounded"></div>
                <span>Neutral</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Negative</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-900">{avgSatisfaction.toFixed(2)}</div>
                <div className="text-sm text-blue-700">Average Satisfaction</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded">
                <div className="text-2xl font-bold text-gray-900">{totalConversations}</div>
                <div className="text-sm text-gray-700">Total Conversations</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500 text-center">
          Showing {trends.length} data points from {trends[0].date} to {trends[trends.length - 1].date}
        </div>
      </CardContent>
    </Card>
  );
}
