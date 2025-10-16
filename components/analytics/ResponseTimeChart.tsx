"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface ResponseTimeChartProps {
  data: Array<{ date: string; avgLatency: number; minLatency: number; maxLatency: number }>;
}

export function ResponseTimeChart({ data }: ResponseTimeChartProps) {
  // Format dates
  const chartData = data.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Response Time Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="avgLatency"
              stroke="#8b5cf6"
              strokeWidth={2}
              name="Avg Latency (ms)"
            />
            <Line
              type="monotone"
              dataKey="minLatency"
              stroke="#10b981"
              strokeDasharray="3 3"
              name="Min"
            />
            <Line
              type="monotone"
              dataKey="maxLatency"
              stroke="#ef4444"
              strokeDasharray="3 3"
              name="Max"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
