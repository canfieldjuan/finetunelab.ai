"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
  MetricsOverview,
  RatingDistribution,
  SuccessRateChart,
  TokenUsageChart,
  ToolPerformanceChart,
  ErrorBreakdownChart,
  CostTrackingChart,
  ConversationLengthChart,
  ResponseTimeChart,
  InsightsPanel
} from './index';

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const { data, loading, error } = useAnalytics({
    userId: user?.id || '',
    timeRange
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Analytics</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/chat">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Chat
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
              <p className="text-muted-foreground">
                Insights from your conversations and evaluations
              </p>
            </div>
          </div>

          {/* Time Range Filter */}
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Overview Cards */}
        <MetricsOverview
          totalMessages={data.overview.totalMessages}
          totalConversations={data.overview.totalConversations}
          totalEvaluations={data.overview.totalEvaluations}
          avgRating={data.overview.avgRating}
          successRate={data.overview.successRate}
        />

        {/* Evaluation Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <RatingDistribution data={data.ratingDistribution} />
          <SuccessRateChart data={data.successFailure} />
        </div>

        {/* Tool & Error Analytics */}
        <div className="grid gap-6 md:grid-cols-2">
          {data.toolPerformance.length > 0 && (
            <ToolPerformanceChart data={data.toolPerformance} />
          )}
          {data.errorBreakdown.length > 0 && (
            <ErrorBreakdownChart data={data.errorBreakdown} />
          )}
        </div>

        {/* Token Usage */}
        {data.tokenUsage.length > 0 && (
          <TokenUsageChart data={data.tokenUsage} />
        )}

        {/* Cost Tracking */}
        {data.costTracking.length > 0 && (
          <CostTrackingChart data={data.costTracking} />
        )}

        {/* Performance Metrics */}
        <div className="grid gap-6 md:grid-cols-2">
          {data.conversationLengths.some(c => c.count > 0) && (
            <ConversationLengthChart data={data.conversationLengths} />
          )}
          {data.responseTimeTrends.length > 0 && (
            <ResponseTimeChart data={data.responseTimeTrends} />
          )}
        </div>

        {/* AI Insights Panel */}
        {user?.id && <InsightsPanel userId={user.id} timeRange={timeRange} />}

        {/* Additional Info */}
        {data.overview.totalEvaluations === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Tip:</strong> Rate some responses using the star button to see more detailed analytics!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
