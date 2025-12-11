"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface JudgmentsBreakdownProps {
  data: Array<{ tag: string; count: number }>;
}

/**
 * Format tag names to be user-friendly
 * Examples: incorrect_info → Incorrect Info, wrong_tool → Wrong Tool
 */
function formatTagName(tag: string): string {
  return tag
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function JudgmentsBreakdown({ data }: JudgmentsBreakdownProps) {
  const chartData = data.map(d => ({
    tag: formatTagName(d.tag),
    originalTag: d.tag,
    count: d.count
  }));

  // Calculate summary stats
  const totalIssues = data.reduce((sum, item) => sum + item.count, 0);
  const uniqueTags = data.length;
  const mostCommon = data.length > 0 ? data[0] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quality Issues Breakdown</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Failure modes detected in evaluations. Use the table below to view examples and traces.
        </p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-2">No quality issues detected</p>
            <p className="text-xs">
              When you mark responses as failed, you can add failure tags (hallucination, formatting, etc.)
              to categorize issues for analysis.
            </p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Total Issues</div>
                  <div className="text-lg font-semibold">{totalIssues}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Unique Tags</div>
                  <div className="text-lg font-semibold">{uniqueTags}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Most Common</div>
                  <div className="text-lg font-semibold">
                    {mostCommon ? `${formatTagName(mostCommon.tag)} (${mostCommon.count})` : '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tag" interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>

            {/* Source Note */}
            <p className="text-xs text-muted-foreground mt-3">
              Source: Failure tags from message evaluations - click tags in table below to view examples
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
