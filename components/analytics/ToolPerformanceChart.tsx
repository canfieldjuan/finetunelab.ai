"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';

interface ToolPerformanceChartProps {
  data: Array<{ tool: string; success: number; failure: number }>;
}

export function ToolPerformanceChart({ data }: ToolPerformanceChartProps) {
  // Transform data for stacked bar chart
  const chartData = data.map(item => ({
    tool: item.tool,
    success: item.success,
    failure: item.failure,
    total: item.success + item.failure
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tool Performance</CardTitle>
        <CardDescription>
          Success/failure rate for AI tool calls (web search, code execution, API calls, etc). High failure rates need investigation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tool" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="success" stackId="a" fill="#10b981" name="Success" />
            <Bar dataKey="failure" stackId="a" fill="#ef4444" name="Failure" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
