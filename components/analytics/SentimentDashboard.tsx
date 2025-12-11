/**
 * Sentiment Dashboard Component
 *
 * Comprehensive sentiment analysis dashboard with filters, charts, and insights.
 * Provides detailed view of conversation sentiment patterns and trends.
 *
 * Phase 3.4: Sentiment Dashboard
 * Date: 2025-10-25
 */

"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '../ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
  SentimentAnalyzer,
  SentimentTrendChart
} from './index';

export function SentimentDashboard() {
  console.log('[SentimentDashboard] Rendering');

  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const getLookbackDays = useCallback((): number => {
    switch (timeRange) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      default: return 30;
    }
  }, [timeRange]);

  // Memoize date range to prevent infinite reload loops
  const { startDate, endDate } = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - getLookbackDays());

    const dateRange = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };

    console.log('[SentimentDashboard] Date range calculated:', dateRange);
    return dateRange;
  }, [getLookbackDays]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          {/* Top Row: Back Button + Time Range Filter */}
          <div className="flex items-center justify-between">
            <Link href="/analytics">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Analytics
              </Button>
            </Link>

            {/* Time Range Filter */}
            <select
              className="border rounded px-4 py-2 cursor-pointer"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>

          {/* Page Title - Now on its own row below */}
          <div>
            <h1 className="text-3xl font-bold">Sentiment Analysis</h1>
            <p className="text-muted-foreground mt-1">
              Track emotional trends and user satisfaction over time
            </p>
          </div>
        </div>

        {/* Trend Chart - Full Width */}
        <SentimentTrendChart startDate={startDate} endDate={endDate} />

        {/* Insights */}
        <SentimentAnalyzer lookbackDays={getLookbackDays()} />

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            <strong>About Sentiment Analysis:</strong> This dashboard analyzes the emotional tone of your conversations
            using natural language processing. Sentiment is automatically extracted from conversation metadata
            and user ratings to provide insights into user satisfaction and engagement patterns.
          </p>
        </div>
      </div>
    </div>
  );
}
