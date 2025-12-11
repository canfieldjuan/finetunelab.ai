"use client";

// Insights Panel Component - Displays AI-generated insights
// Phase 3 Task 3.5: Enhanced AI Insights
// Enhanced with root cause analysis and recommendations
// Date: October 25, 2025

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, Loader2, Brain } from 'lucide-react';
import { useAnalyticsInsights } from '@/hooks/useAnalyticsInsights';
import { InsightCard } from './InsightCard';
import RootCauseTimeline from './RootCauseTimeline';
import RecommendationCard from './RecommendationCard';
import ContributingFactorsList from './ContributingFactorsList';
import type {
  RootCauseAnalysis,
  Recommendation
} from '@/lib/services/ai-insights.service';

interface InsightsPanelProps {
  userId: string;
  timeRange: string;
}

export function InsightsPanel({ userId, timeRange }: InsightsPanelProps) {
  console.log('[InsightsPanel] Rendering with enhanced AI insights');

  const { insights, loading, error, isCached, generateInsights } =
    useAnalyticsInsights(userId, timeRange);

  const [rootCauseAnalysis] = useState<RootCauseAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const handleAcceptRecommendation = (id: string) => {
    console.log('[InsightsPanel] Accepting recommendation:', id);
  };

  const handleDismissRecommendation = (id: string) => {
    console.log('[InsightsPanel] Dismissing recommendation:', id);
    setRecommendations(prev => prev.filter(rec => rec.id !== id));
  };

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
                variant="secondary"
                size="sm"
                className="border border-gray-300"
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
          <div className="space-y-6">
            {/* Existing Insights */}
            <div className="grid gap-4 md:grid-cols-2">
              {insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>

            {/* Root Cause Analysis Section */}
            {rootCauseAnalysis && (
              <div className="border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-5 h-5 text-purple-600" />
                  <h3 className="text-lg font-semibold">Root Cause Analysis</h3>
                </div>
                <div className="space-y-6">
                  <ContributingFactorsList factors={rootCauseAnalysis.primary_causes} />
                  <RootCauseTimeline analysis={rootCauseAnalysis} />
                </div>
              </div>
            )}

            {/* Recommendations Section */}
            {recommendations.length > 0 && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Recommended Actions</h3>
                <div className="grid gap-4">
                  {recommendations.map(rec => (
                    <RecommendationCard
                      key={rec.id}
                      recommendation={rec}
                      onAccept={handleAcceptRecommendation}
                      onDismiss={handleDismissRecommendation}
                    />
                  ))}
                </div>
              </div>
            )}

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
