'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface OperationCostData {
  operation: string;
  cost: number;
  tokens: number;
  traceCount: number;
  avgCostPerTrace: number;
}

export function OperationCostChart() {
  const { session } = useAuth();
  const [data, setData] = useState<OperationCostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOperationCosts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchOperationCosts() {
    if (!session?.access_token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/analytics/cost-analysis?timeRange=30d', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch cost data');
      }

      const json = await res.json();
      if (json.success && json.data?.operationBreakdown) {
        setData(json.data.operationBreakdown);
      }
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const totalCost = data.reduce((sum, op) => sum + op.cost, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost by Operation</CardTitle>
        <CardDescription>
          Last 30 days - Total: ${totalCost.toFixed(4)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((operation) => (
            <div key={operation.operation} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{operation.operation}</span>
                <span className="text-sm font-bold">${operation.cost.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{operation.traceCount} operations</span>
                <span>${operation.avgCostPerTrace.toFixed(6)}/operation</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${(operation.cost / totalCost) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
