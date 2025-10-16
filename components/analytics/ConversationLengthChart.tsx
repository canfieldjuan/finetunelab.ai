"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface ConversationLengthChartProps {
  data: Array<{ range: string; count: number }>;
}

export function ConversationLengthChart({ data }: ConversationLengthChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversation Length Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" name="Conversations" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
