'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ModelCostData {
  model: string;
  cost: number;
  tokens: number;
  traceCount: number;
  avgCostPerTrace: number;
}

export function ModelCostBreakdown() {
  const { session } = useAuth();
  const [data, setData] = useState<ModelCostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModelCosts();
  }, []);

  async function fetchModelCosts() {
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
      if (json.success && json.data?.modelBreakdown) {
        setData(json.data.modelBreakdown);
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

  const totalCost = data.reduce((sum, m) => sum + m.cost, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost by Model</CardTitle>
        <CardDescription>
          Last 30 days - Total: ${totalCost.toFixed(4)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((model) => (
            <div key={model.model} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{model.model}</span>
                <span className="text-sm font-bold">${model.cost.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{model.traceCount} traces</span>
                <span>${model.avgCostPerTrace.toFixed(6)}/trace</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${(model.cost / totalCost) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
