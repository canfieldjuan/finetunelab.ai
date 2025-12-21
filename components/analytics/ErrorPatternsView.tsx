'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingUp, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ErrorPattern {
  category: string;
  count: number;
  percentage: number;
  avgDurationMs?: number;
  affectedProviders: string[];
  suggestedAction?: string;
}

interface AffectedOperation {
  operation: string;
  count: number;
  percentage: number;
}

interface ErrorPatternsResponse {
  success: boolean;
  data: {
    timeRange: string;
    startDate: string;
    endDate: string;
    totalErrors: number;
    patterns: ErrorPattern[];
    mostAffectedOperations: AffectedOperation[];
  };
}

export function ErrorPatternsView() {
  const { session } = useAuth();
  const [data, setData] = useState<ErrorPatternsResponse['data'] | null>(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchErrorPatterns();
  }, [timeRange, session]);

  async function fetchErrorPatterns() {
    if (!session?.access_token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/error-patterns?timeRange=${timeRange}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
      }
      const response: ErrorPatternsResponse = await res.json();
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch error patterns:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      rate_limit: 'bg-yellow-500',
      timeout: 'bg-orange-500',
      auth: 'bg-red-500',
      validation: 'bg-purple-500',
      api_error: 'bg-pink-500',
      network_error: 'bg-blue-500',
      quota_exceeded: 'bg-amber-500',
      model_overloaded: 'bg-cyan-500',
      unknown: 'bg-gray-500',
    };
    return colors[category] || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Error Patterns</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze and understand error trends across your LLM operations
          </p>
        </div>
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
          <p className="text-muted-foreground">Loading error patterns...</p>
        </div>
      )}

      {error && (
        <div className="p-4 border border-destructive rounded bg-destructive/10">
          <p className="text-destructive">Error: {error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalErrors.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  in {timeRange === '7d' ? 'last 7 days' : timeRange === '30d' ? 'last 30 days' : 'last 90 days'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Categories</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.patterns.length}</div>
                <p className="text-xs text-muted-foreground">
                  distinct error types detected
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Top Error</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {data.patterns.length > 0 ? (
                  <>
                    <div className="text-2xl font-bold capitalize">
                      {data.patterns[0].category.replace(/_/g, ' ')}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {data.patterns[0].percentage.toFixed(1)}% of all errors
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No errors</p>
                )}
              </CardContent>
            </Card>
          </div>

          {data.patterns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Error Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.patterns.map((pattern) => (
                    <div key={pattern.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded ${getCategoryColor(pattern.category)}`} />
                          <span className="font-medium capitalize">
                            {pattern.category.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{pattern.count} errors</Badge>
                          <span className="text-sm font-semibold w-16 text-right">
                            {pattern.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`${getCategoryColor(pattern.category)} h-2 rounded-full transition-all`}
                          style={{ width: `${pattern.percentage}%` }}
                        />
                      </div>

                      {pattern.affectedProviders.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-6">
                          <span>Providers:</span>
                          {pattern.affectedProviders.map((provider) => (
                            <Badge key={provider} variant="secondary" className="text-xs">
                              {provider}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {pattern.suggestedAction && (
                        <div className="ml-6 p-2 bg-muted/50 rounded text-xs">
                          <span className="font-medium">Suggested action: </span>
                          <span className="text-muted-foreground">{pattern.suggestedAction}</span>
                        </div>
                      )}

                      {pattern.avgDurationMs !== undefined && (
                        <div className="ml-6 text-xs text-muted-foreground">
                          Avg duration: {pattern.avgDurationMs.toFixed(0)}ms
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.mostAffectedOperations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Most Affected Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.mostAffectedOperations.map((op) => (
                    <div key={op.operation} className="flex items-center justify-between">
                      <span className="font-medium">{op.operation}</span>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{op.count} errors</Badge>
                        <span className="text-sm font-semibold w-16 text-right">
                          {op.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.totalErrors === 0 && (
            <div className="p-8 text-center">
              <p className="text-lg font-medium text-muted-foreground">
                No errors found for this time range
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Your LLM operations are running smoothly!
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
