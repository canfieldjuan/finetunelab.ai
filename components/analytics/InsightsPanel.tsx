"use client";

// Insights Panel Component - Displays AI-generated insights
// Phase 12: Analytics Tools Integration
// Date: October 13, 2025

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { useAnalyticsInsights } from '@/hooks/useAnalyticsInsights';
import { InsightCard } from './InsightCard';

interface InsightsPanelProps {
  userId: string;
  timeRange: string;
}

export function InsightsPanel({ userId, timeRange }: InsightsPanelProps) {
  const { insights, loading, error, isCached, generateInsights, clearInsights } =
    useAnalyticsInsights(userId, timeRange);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <CardTitle>AI Insights</CardTitle>
            {isCached && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Cached
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {insights && (
              <Button
                onClick={generateInsights}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            )}
            {!insights && (
              <Button
                onClick={generateInsights}
                variant="default"
                size="sm"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate AI Insights
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-900">
            <p className="text-sm">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {loading && !insights && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {insights && insights.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}

        {!loading && !error && !insights && (
          <div className="text-center py-12 text-gray-500">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">
              Click &quot;Generate AI Insights&quot; to get personalized recommendations
              based on your analytics data.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
