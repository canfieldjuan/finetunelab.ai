"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface JudgmentsBreakdownProps {
  data: Array<{ tag: string; count: number }>;
}

export function JudgmentsBreakdown({ data }: JudgmentsBreakdownProps) {
  const chartData = data.map(d => ({ tag: d.tag, count: d.count }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Judgments Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-sm text-muted-foreground">No judgments available</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tag" interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
