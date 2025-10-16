"use client";

// Insight Card Component - Displays individual AI insight
// Phase 12: Analytics Tools Integration
// Date: October 13, 2025

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, DollarSign, TrendingUp, FileText } from 'lucide-react';
import type { InsightData } from '@/lib/analytics/insightsService';

interface InsightCardProps {
  insight: InsightData;
}

export function InsightCard({ insight }: InsightCardProps) {
  // Icon based on category
  const getIcon = () => {
    switch (insight.category) {
      case 'Cost':
        return <DollarSign className="h-5 w-5" />;
      case 'Quality':
        return <TrendingUp className="h-5 w-5" />;
      case 'Patterns':
        return <FileText className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  // Color based on severity
  const getColors = () => {
    switch (insight.severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  return (
    <Card className={`${getColors()} border`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{getIcon()}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm">{insight.title}</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-white/50">
                {insight.category}
              </span>
            </div>
            <p className="text-sm">{insight.message}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
