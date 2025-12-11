"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';

interface SLABreachChartProps {
  data: Array<{ date: string; slaBreachRate: number; sampleSize?: number }>; // rate in %
}

export function SLABreachChart({ data }: SLABreachChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>SLA Breach Rate Over Time</CardTitle>
        <CardDescription>
          Percentage of responses exceeding 2000ms (2 sec) target. Lower is better. Target: &lt;5% for chatbots, &lt;10% for assistants.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-sm text-muted-foreground">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(val: number) => [`${val.toFixed(2)}%`, 'SLA Breach']} />
              <Legend />
              <Line type="monotone" dataKey="slaBreachRate" stroke="#ef4444" name="Breach Rate (%)" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
