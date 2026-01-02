/**
 * DemoCostChart Component
 * Shows cost breakdown from batch test results
 */

'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

interface DemoCostChartProps {
  inputTokens: number;
  outputTokens: number;
  // Typical pricing (can be made configurable)
  inputCostPer1M?: number;
  outputCostPer1M?: number;
}

export function DemoCostChart({
  inputTokens,
  outputTokens,
  inputCostPer1M = 0.15,  // Default: $0.15 per 1M input tokens (typical for small models)
  outputCostPer1M = 0.60   // Default: $0.60 per 1M output tokens
}: DemoCostChartProps) {
  const totalTokens = inputTokens + outputTokens;

  // Calculate costs
  const inputCost = (inputTokens / 1_000_000) * inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * outputCostPer1M;
  const totalCost = inputCost + outputCost;

  const chartData = [
    {
      name: 'Input',
      tokens: inputTokens,
      cost: inputCost,
      costFormatted: `$${inputCost.toFixed(4)}`
    },
    {
      name: 'Output',
      tokens: outputTokens,
      cost: outputCost,
      costFormatted: `$${outputCost.toFixed(4)}`
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          Cost Analysis
        </CardTitle>
        <CardDescription>
          Token usage and estimated cost breakdown
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="mb-4 p-3 bg-muted/30 rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Total Tokens</div>
              <div className="text-lg font-semibold">{totalTokens.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Cost</div>
              <div className="text-lg font-semibold text-green-600">
                ${totalCost.toFixed(4)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Avg per Request</div>
              <div className="text-lg font-semibold">
                {totalTokens > 0 ? Math.round(totalTokens / 10) : 0} tokens
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        {totalTokens > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                label={{ value: 'Tokens', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: 'Cost ($)', angle: 90, position: 'insideRight' }}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white border rounded-md p-2 shadow-sm">
                      <div className="font-medium text-xs mb-1">{data.name} Tokens</div>
                      <div className="text-xs">Tokens: {data.tokens.toLocaleString()}</div>
                      <div className="text-xs">Cost: {data.costFormatted}</div>
                    </div>
                  );
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="tokens" fill="#8b5cf6" name="Tokens" />
              <Bar yAxisId="right" dataKey="cost" fill="#10b981" name="Cost ($)" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No token usage data available</p>
          </div>
        )}

        {/* Pricing Note */}
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Estimated cost based on ${inputCostPer1M}/1M input tokens, ${outputCostPer1M}/1M output tokens
        </p>
      </CardContent>
    </Card>
  );
}
