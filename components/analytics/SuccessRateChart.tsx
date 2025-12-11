"use client";

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface SuccessRateChartProps {
  data: Array<{ name: string; value: number }>;
}

const COLORS = ['#10b981', '#ef4444'];

export function SuccessRateChart({ data }: SuccessRateChartProps) {
  // Calculate summary stats
  const totalEvaluations = data.reduce((sum, item) => sum + item.value, 0);
  const successCount = data.find(item => item.name === 'Successful')?.value || 0;
  const failureCount = data.find(item => item.name === 'Failed')?.value || 0;
  const successRate = totalEvaluations > 0 ? (successCount / totalEvaluations) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Success vs Failure</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Binary thumbs up/down evaluations. Independent from star ratings.
        </p>
      </CardHeader>
      <CardContent>
        {totalEvaluations === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-2">No success/failure evaluations yet</p>
            <p className="text-xs">
              Use thumbs up/down buttons in chat to mark responses as successful or failed.
            </p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Total Evaluations</div>
                  <div className="text-lg font-semibold">{totalEvaluations}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Success Rate</div>
                  <div className="text-lg font-semibold text-green-600">{successRate.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                  <div className="text-lg font-semibold text-red-600">{failureCount}</div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>

            {/* Source Note */}
            <p className="text-xs text-muted-foreground mt-3">
              Source: Success field (boolean) from message evaluations - stored independently from star ratings
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
