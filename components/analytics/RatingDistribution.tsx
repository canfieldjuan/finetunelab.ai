"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface RatingDistributionProps {
  data: Array<{ rating: number; count: number }>;
}

export function RatingDistribution({ data }: RatingDistributionProps) {
  // Transform data for chart
  const chartData = data.map(item => ({
    rating: `${item.rating}`,
    count: item.count
  }));

  // Calculate summary stats
  const totalRatings = data.reduce((sum, item) => sum + item.count, 0);
  const avgRating = totalRatings > 0
    ? data.reduce((sum, item) => sum + (item.rating * item.count), 0) / totalRatings
    : 0;
  const mostCommon = data.reduce((max, item) =>
    item.count > max.count ? item : max,
    { rating: 0, count: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating Distribution</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Star ratings (1-5) from manual evaluations. Higher ratings indicate better response quality.
        </p>
      </CardHeader>
      <CardContent>
        {totalRatings === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-2">No ratings yet</p>
            <p className="text-xs">
              Rate responses in chat using the star rating feature, or use the LLM judge to auto-evaluate.
            </p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Total Ratings</div>
                  <div className="text-lg font-semibold">{totalRatings}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Average Rating</div>
                  <div className="text-lg font-semibold">{avgRating.toFixed(1)} ⭐</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Most Common</div>
                  <div className="text-lg font-semibold">{mostCommon.rating > 0 ? `${mostCommon.rating} ⭐` : '-'}</div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rating" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#facc15" />
              </BarChart>
            </ResponsiveContainer>

            {/* Source Note */}
            <p className="text-xs text-muted-foreground mt-3">
              Source: Manual star ratings from message evaluations
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
