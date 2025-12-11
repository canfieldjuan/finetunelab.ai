/**
 * Sentiment Analyzer Component
 *
 * Displays sentiment insights including trends, anomalies, and patterns.
 * Shows severity-based color coding and insight details.
 *
 * Phase 3.3: Advanced Sentiment Analysis
 * Date: 2025-10-25
 */

"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { RefreshCw, AlertCircle, TrendingUp, Activity } from 'lucide-react';
import type { SentimentInsight } from '@/lib/services/sentiment.service';
import { supabase } from '@/lib/supabaseClient';

interface SentimentAnalyzerProps {
  lookbackDays?: number;
  onRefresh?: () => void;
}

export default function SentimentAnalyzer({
  lookbackDays = 30,
  onRefresh
}: SentimentAnalyzerProps) {
  console.log('[SentimentAnalyzer] Rendering with lookback:', lookbackDays);

  const [insights, setInsights] = useState<SentimentInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    console.log('[SentimentAnalyzer] Starting fetch');
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      const response = await fetch(
        `/api/analytics/sentiment/insights?lookback_days=${lookbackDays}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch sentiment insights');
      }

      const data = await response.json();
      console.log('[SentimentAnalyzer] Received', data.insights.length, 'insights');
      setInsights(data.insights);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load insights';
      console.error('[SentimentAnalyzer] Error:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [lookbackDays]);

  useEffect(() => {
    console.log('[SentimentAnalyzer] Fetching insights');
    fetchInsights();
  }, [fetchInsights]);

  const handleRefresh = () => {
    console.log('[SentimentAnalyzer] Manual refresh triggered');
    fetchInsights();
    if (onRefresh) onRefresh();
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trend':
        return <TrendingUp className="w-5 h-5" />;
      case 'anomaly':
        return <AlertCircle className="w-5 h-5" />;
      case 'pattern':
        return <Activity className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'low':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-gray-600">
            Loading sentiment insights...
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sentiment Insights</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Auto-analyzed sentiment patterns using AI (Graphiti). Independent from manual ratings.
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            <p>No sentiment insights detected for this period.</p>
            <p className="text-sm mt-2">This is a good sign - no anomalies or significant patterns found.</p>
            <p className="text-xs text-muted-foreground mt-4">
              Source: Sentiment automatically analyzed from message text content via Graphiti service
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className={`border rounded-lg p-4 ${getSeverityColor(insight.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getInsightIcon(insight.insight_type)}</div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{insight.title}</h4>
                      <p className="text-sm opacity-90">{insight.description}</p>
                      <div className="flex gap-4 mt-2 text-xs opacity-75">
                        <span className="capitalize">Type: {insight.insight_type}</span>
                        <span className="capitalize">Severity: {insight.severity}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Source: Sentiment automatically analyzed from message text content via Graphiti service
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
