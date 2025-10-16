"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, MessageSquare, Star, CheckCircle } from 'lucide-react';

interface MetricsOverviewProps {
  totalMessages: number;
  totalConversations: number;
  totalEvaluations: number;
  avgRating: number;
  successRate: number;
}

export function MetricsOverview({
  totalMessages,
  totalConversations,
  totalEvaluations,
  avgRating,
  successRate
}: MetricsOverviewProps) {
  const metrics = [
    {
      title: 'Total Messages',
      value: totalMessages,
      icon: MessageSquare,
      color: 'text-blue-500'
    },
    {
      title: 'Conversations',
      value: totalConversations,
      icon: TrendingUp,
      color: 'text-green-500'
    },
    {
      title: 'Average Rating',
      value: avgRating.toFixed(1),
      suffix: ' / 5',
      icon: Star,
      color: 'text-yellow-500'
    },
    {
      title: 'Success Rate',
      value: `${successRate.toFixed(1)}%`,
      icon: CheckCircle,
      color: 'text-emerald-500'
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, idx) => {
        const Icon = metric.icon;
        return (
          <Card key={idx}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metric.value}
                {metric.suffix && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {metric.suffix}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
