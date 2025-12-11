"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';

interface TokenUsageChartProps {
  data: Array<{ date: string; input: number; output: number }>;
}

export function TokenUsageChart({ data }: TokenUsageChartProps) {
  // Format dates for display
  const chartData = data.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Token Usage Over Time</CardTitle>
        <CardDescription>
          Input tokens = prompts sent to AI. Output tokens = AI responses generated. More tokens = higher costs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="input" stroke="#3b82f6" name="Input Tokens" />
            <Line type="monotone" dataKey="output" stroke="#10b981" name="Output Tokens" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
