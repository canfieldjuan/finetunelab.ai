"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';

interface CostTrackingChartProps {
  data: Array<{ date: string; cost: number; tokens: number }>;
}

export function CostTrackingChart({ data }: CostTrackingChartProps) {
  // Format dates and calculate cumulative cost
  const chartData = data.map((item, index, arr) => {
    const cumulativeCost = arr.slice(0, index + 1).reduce((sum, d) => sum + d.cost, 0);
    return {
      ...item,
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cumulativeCost: parseFloat(cumulativeCost.toFixed(4))
    };
  });

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Cost Tracking</CardTitle>
        <CardDescription>
          Daily spending and cumulative total in USD. Calculated from token usage × model pricing. Track budget burn rate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="cost"
              stroke="#8b5cf6"
              name="Daily Cost ($)"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulativeCost"
              stroke="#ec4899"
              name="Cumulative Cost ($)"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
