/**
 * UsageHistoryChart Component
 * Displays usage trends over the past 6 months
 */

"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface MonthlyUsage {
  month: string;
  year: number;
  rootTraces: number;
  payloadGb: number;
  cost: number;
}

interface UsageHistoryChartProps {
  data: MonthlyUsage[];
  loading?: boolean;
}

export function UsageHistoryChart({ data, loading }: UsageHistoryChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage History</CardTitle>
          <CardDescription>Past 6 months trend</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage History</CardTitle>
          <CardDescription>Past 6 months trend</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No historical data available yet
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxTraces = Math.max(...data.map((d) => d.rootTraces));
  const maxCost = Math.max(...data.map((d) => d.cost));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage History</CardTitle>
        <CardDescription>Past 6 months trend</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex items-end justify-between gap-2 h-48">
            {data.map((month, index) => {
              const traceHeight = (month.rootTraces / maxTraces) * 100;
              const costHeight = (month.cost / maxCost) * 100;

              return (
                <div
                  key={index}
                  className="flex-1 flex flex-col items-center gap-2"
                >
                  <div className="relative w-full h-full flex items-end justify-center gap-1">
                    <div
                      className="w-1/2 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors relative group"
                      style={{ height: `${traceHeight}%` }}
                    >
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap pointer-events-none z-10">
                        {formatNumber(month.rootTraces)} traces
                      </div>
                    </div>
                    <div
                      className="w-1/2 bg-green-500 rounded-t hover:bg-green-600 transition-colors relative group"
                      style={{ height: `${costHeight}%` }}
                    >
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap pointer-events-none z-10">
                        {formatCurrency(month.cost)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    {month.month.substring(0, 3)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span className="text-muted-foreground">Traces</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span className="text-muted-foreground">Cost</span>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">
                  {formatNumber(data.reduce((sum, d) => sum + d.rootTraces, 0))}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Total Traces
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {data.reduce((sum, d) => sum + d.payloadGb, 0).toFixed(1)} GB
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Total Payload
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {formatCurrency(data.reduce((sum, d) => sum + d.cost, 0))}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Total Cost
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
