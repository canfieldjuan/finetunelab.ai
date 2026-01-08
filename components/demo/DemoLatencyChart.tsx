/**
 * DemoLatencyChart Component
 * Shows latency distribution from batch test results
 */

'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingDown } from 'lucide-react';

interface DemoLatencyChartProps {
  latencies: number[];
}

interface LatencyBucket {
  range: string;
  count: number;
  percentage: number;
}

export function DemoLatencyChart({ latencies }: DemoLatencyChartProps) {
  // Calculate latency distribution buckets
  const calculateBuckets = (): LatencyBucket[] => {
    if (!latencies || latencies.length === 0) return [];

    const validLatencies = latencies.filter(l => l !== undefined && l !== null && l > 0);
    if (validLatencies.length === 0) return [];

    const max = Math.max(...validLatencies);
    const bucketSize = Math.ceil(max / 5); // 5 buckets

    const buckets: { [key: string]: number } = {};

    // Initialize buckets
    for (let i = 0; i < 5; i++) {
      const start = i * bucketSize;
      const end = (i + 1) * bucketSize;
      const key = `${start}-${end}ms`;
      buckets[key] = 0;
    }

    // Count latencies in each bucket
    validLatencies.forEach(latency => {
      const bucketIndex = Math.min(Math.floor(latency / bucketSize), 4);
      const start = bucketIndex * bucketSize;
      const end = (bucketIndex + 1) * bucketSize;
      const key = `${start}-${end}ms`;
      buckets[key] = (buckets[key] || 0) + 1;
    });

    // Convert to array format
    return Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
      percentage: (count / validLatencies.length) * 100
    }));
  };

  const bucketData = calculateBuckets();
  const validLatencies = latencies.filter(l => l !== undefined && l !== null && l > 0);

  // Calculate stats
  const avgLatency = validLatencies.length > 0
    ? Math.round(validLatencies.reduce((sum, l) => sum + l, 0) / validLatencies.length)
    : 0;
  const minLatency = validLatencies.length > 0 ? Math.min(...validLatencies) : 0;
  const maxLatency = validLatencies.length > 0 ? Math.max(...validLatencies) : 0;

  // Calculate percentiles
  const sortedLatencies = [...validLatencies].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedLatencies.length * 0.95);
  const p95Latency = sortedLatencies[p95Index] || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-muted-foreground" />
          Latency Distribution
        </CardTitle>
        <CardDescription>
          Response time breakdown across your batch test runs
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="mb-4 p-3 bg-muted/30 rounded-lg">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Average</div>
              <div className="text-lg font-semibold">{avgLatency}ms</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">P95</div>
              <div className="text-lg font-semibold">{p95Latency}ms</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Min</div>
              <div className="text-lg font-semibold text-green-600">{minLatency}ms</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Max</div>
              <div className="text-lg font-semibold text-orange-600">{maxLatency}ms</div>
            </div>
          </div>
        </div>

        {/* Chart */}
        {bucketData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bucketData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 11 }}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis
                label={{ value: 'Request Count', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const data = payload[0].payload as LatencyBucket;
                  return (
                    <div className="bg-white border rounded-md p-2 shadow-sm">
                      <div className="font-medium text-xs mb-1">{data.range}</div>
                      <div className="text-xs">Count: {data.count}</div>
                      <div className="text-xs">Percentage: {data.percentage.toFixed(1)}%</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No latency data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
