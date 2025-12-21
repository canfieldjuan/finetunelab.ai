'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, TrendingDown } from 'lucide-react';

interface CacheSavingsData {
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  tracesWithCacheHits: number;
  tracesWithCacheCreation: number;
  estimatedSavingsUsd: number;
  cacheHitRate: number;
}

export function CacheSavingsCard() {
  const { session } = useAuth();
  const [data, setData] = useState<CacheSavingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCacheSavings();
  }, []);

  async function fetchCacheSavings() {
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
        throw new Error('Failed to fetch cache data');
      }

      const json = await res.json();
      if (json.success && json.data?.cacheSavings) {
        setData(json.data.cacheSavings);
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

  if (error || !data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{error || 'No data'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Cache Savings</CardTitle>
          <TrendingDown className="h-5 w-5 text-green-500" />
        </div>
        <CardDescription>
          Anthropic prompt caching - Last 30 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-green-600">
                ${data.estimatedSavingsUsd.toFixed(4)}
              </span>
              <span className="text-sm text-muted-foreground">saved</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              90% discount on cache reads
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-2xl font-semibold">{data.cacheHitRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Cache hit rate</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{data.tracesWithCacheHits}</p>
              <p className="text-xs text-muted-foreground">Cache hits</p>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Cache read tokens:</span>
              <span className="font-medium">{data.totalCacheReadTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-muted-foreground">Cache creation tokens:</span>
              <span className="font-medium">{data.totalCacheCreationTokens.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
