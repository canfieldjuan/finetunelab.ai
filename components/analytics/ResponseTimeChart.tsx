"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';

interface ChartDatum {
  date: string;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50?: number;
  p90?: number;
  p95?: number;
  p99?: number;
  slaBreachRate?: number;
  sampleSize?: number;
}

type RTTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ payload?: ChartDatum }>;
};

interface ResponseTimeChartProps {
  data: ChartDatum[];
}

export function ResponseTimeChart({ data }: ResponseTimeChartProps) {
  // Handle empty state
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Response Time Trends</CardTitle>
          <CardDescription>
            AI response latency in milliseconds. P50 = median (50% faster). P95 = 95% of responses faster than this. P99 shows outliers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-base mb-2">No response time data available yet</p>
            <p className="text-sm">
              Response times are tracked automatically as you use the chat.
            </p>
            <p className="text-xs mt-3 text-gray-500">
              Data will appear here once assistant messages with latency measurements are recorded.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format dates
  const chartData: ChartDatum[] = data.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  const renderTooltip = (props: RTTooltipProps) => {
    const { active, payload, label } = props || {};
    if (!active || !payload || payload.length === 0) return null;
    const d = (payload[0]?.payload as ChartDatum) || undefined;
    if (!d) return null;
    return (
      <div className="bg-white border rounded-md p-2 text-xs shadow-sm">
        <div className="font-medium mb-1">{label}</div>
        <div>Avg: {d.avgLatency} ms</div>
        <div>Min: {d.minLatency} ms</div>
        <div>Max: {d.maxLatency} ms</div>
        {d.p50 !== undefined && <div>P50: {d.p50} ms</div>}
        {d.p90 !== undefined && <div>P90: {d.p90} ms</div>}
        {d.p95 !== undefined && <div>P95: {d.p95} ms</div>}
        {d.p99 !== undefined && <div>P99: {d.p99} ms</div>}
        {d.sampleSize !== undefined && <div>Samples: {d.sampleSize}</div>}
        {d.slaBreachRate !== undefined && <div>SLA Breach: {d.slaBreachRate}%</div>}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Response Time Trends</CardTitle>
        <CardDescription>
          AI response latency in milliseconds. P50 = median (50% faster). P95 = 95% of responses faster than this. P99 shows outliers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={renderTooltip} />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            {/* Central tendency */}
            <Line type="monotone" dataKey="avgLatency" stroke="#8b5cf6" strokeWidth={2} name="Avg" />
            {/* Bounds */}
            <Line type="monotone" dataKey="minLatency" stroke="#10b981" strokeDasharray="3 3" name="Min" />
            <Line type="monotone" dataKey="maxLatency" stroke="#ef4444" strokeDasharray="3 3" name="Max" />
            {/* Percentiles */}
            {chartData.some(d => d.p50 !== undefined) && (
              <Line type="monotone" dataKey="p50" stroke="#3b82f6" name="P50" />
            )}
            {chartData.some(d => d.p90 !== undefined) && (
              <Line type="monotone" dataKey="p90" stroke="#f59e0b" name="P90" />
            )}
            {chartData.some(d => d.p95 !== undefined) && (
              <Line type="monotone" dataKey="p95" stroke="#ef4444" strokeDasharray="4 2" name="P95" />
            )}
            {chartData.some(d => d.p99 !== undefined) && (
              <Line type="monotone" dataKey="p99" stroke="#7c3aed" strokeDasharray="2 2" name="P99" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
