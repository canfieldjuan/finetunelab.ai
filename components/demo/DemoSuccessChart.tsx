/**
 * DemoSuccessChart Component
 * Shows success rate from batch test results
 */

'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Brain } from 'lucide-react';

interface DemoSuccessChartProps {
  successCount: number;
  failureCount: number;
}

const COLORS = ['#10b981', '#ef4444'];

export function DemoSuccessChart({ successCount, failureCount }: DemoSuccessChartProps) {
  const totalRequests = successCount + failureCount;
  const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;

  const chartData = [
    { name: 'Successful', value: successCount },
    { name: 'Failed', value: failureCount }
  ].filter(item => item.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-muted-foreground" />
          Success Rate
        </CardTitle>
        <CardDescription>
          Request success vs failure breakdown
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="mb-4 p-3 bg-muted/30 rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Total Requests</div>
              <div className="text-lg font-semibold">{totalRequests}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Success Rate</div>
              <div className="text-lg font-semibold text-green-600">{successRate.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Failures</div>
              <div className="text-lg font-semibold text-red-600">{failureCount}</div>
            </div>
          </div>
        </div>

        {/* Chart */}
        {totalRequests > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No request data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
