'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

interface ProviderStats {
  provider: string;
  totalCalls: number;
  successRate: number;
  errorRate: number;
  avgLatencyMs: number;
  avgCostPerCall: number;
  totalCost: number;
  totalTokens: number;
  avgTTFTMs: number | null;
  avgThroughput: number | null;
  cacheHitRate: number | null;
  topErrors: Array<{ category: string; count: number }>;
}

interface ComparisonResponse {
  success: boolean;
  data: {
    timeRange: string;
    startDate: string;
    endDate: string;
    comparison: ProviderStats[];
  };
}

export function ProviderComparisonView() {
  const { session } = useAuth();
  const [comparison, setComparison] = useState<ProviderStats[]>([]);
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchComparison();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  async function fetchComparison() {
    if (!session?.access_token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/provider-comparison?timeRange=${timeRange}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
      }
      const data: ComparisonResponse = await res.json();
      setComparison(data.data.comparison || []);
    } catch (err) {
      console.error('Failed to fetch provider comparison:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Provider Comparison</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="border rounded px-3 py-2 bg-background"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      {loading && (
        <div className="flex justify-center p-8">
          <p className="text-muted-foreground">Loading provider comparison...</p>
        </div>
      )}

      {error && (
        <div className="p-4 border border-destructive rounded bg-destructive/10">
          <p className="text-destructive">Error: {error}</p>
        </div>
      )}

      {!loading && !error && comparison.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">No provider data available for this time range</p>
        </div>
      )}

      {!loading && !error && comparison.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {comparison.map((stats) => (
            <Card key={stats.provider}>
              <CardHeader>
                <CardTitle className="capitalize">{stats.provider}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Calls:</span>
                  <span className="font-semibold">{stats.totalCalls.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Success Rate:</span>
                  <Badge variant={stats.successRate >= 95 ? 'default' : 'destructive'}>
                    {stats.successRate.toFixed(1)}%
                  </Badge>
                </div>

                {stats.errorRate > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Error Rate:</span>
                    <Badge variant="outline">
                      {stats.errorRate.toFixed(1)}%
                    </Badge>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Latency:</span>
                  <span className="font-semibold">{stats.avgLatencyMs.toFixed(0)}ms</span>
                </div>

                {stats.avgTTFTMs !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Avg TTFT:</span>
                    <span className="font-semibold">{stats.avgTTFTMs.toFixed(0)}ms</span>
                  </div>
                )}

                {stats.avgThroughput !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Throughput:</span>
                    <span className="font-semibold">{stats.avgThroughput.toFixed(1)} tok/s</span>
                  </div>
                )}

                {stats.cacheHitRate !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Cache Hits:</span>
                    <Badge variant="outline">
                      {stats.cacheHitRate.toFixed(1)}%
                    </Badge>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Cost/Call:</span>
                  <span className="font-semibold">${stats.avgCostPerCall.toFixed(4)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Cost:</span>
                  <span className="font-semibold text-lg">${stats.totalCost.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Tokens:</span>
                  <span className="font-semibold">{stats.totalTokens.toLocaleString()}</span>
                </div>

                {stats.topErrors.length > 0 && (
                  <div className="pt-2 border-t">
                    <span className="text-sm font-medium text-muted-foreground">Top Errors:</span>
                    <ul className="mt-1 space-y-1">
                      {stats.topErrors.map((err) => (
                        <li key={err.category} className="text-sm flex justify-between">
                          <span className="text-muted-foreground capitalize">{err.category.replace(/_/g, ' ')}:</span>
                          <span className="font-medium">{err.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
