'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface BatchTestResult {
  id: string;
  prompt: string;
  response?: string;
  latency_ms?: number;
  success: boolean;
  error?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at: string;
}

interface BatchTestRun {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  model_name: string;
  total_prompts: number;
  completed_prompts: number;
  failed_prompts: number;
  progress: number;
  results: BatchTestResult[];
  started_at: string;
  completed_at?: string;
  error?: string;
}

import type { DemoSessionMetrics } from '@/lib/demo/demo-analytics.service';

const POLL_INTERVAL = 2000;

interface BatchTestProgressProps {
  testRunId: string;
  onComplete?: (testRun: BatchTestRun) => void;
  onError?: (error: string) => void;
}

export function BatchTestProgress({
  testRunId,
  onComplete,
  onError,
}: BatchTestProgressProps) {
  const [testRun, setTestRun] = useState<BatchTestRun | null>(null);
  const [metrics, setMetrics] = useState<DemoSessionMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/demo/v2/batch-test?test_run_id=${testRunId}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch status');
      }

      const data: BatchTestRun = await response.json();
      setTestRun(data);

      // Fetch metrics
      const metricsResponse = await fetch(
        `/api/demo/v2/metrics?session_id=${data.id}`
      );
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData);
      }


      // Check if complete
      if (data.status === 'completed' || data.status === 'failed') {
        onComplete?.(data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      onError?.(message);
    }
  }, [testRunId, onComplete, onError]);

  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Poll for updates
    const interval = setInterval(() => {
      if (testRun?.status === 'running' || testRun?.status === 'pending') {
        fetchStatus();
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchStatus, testRun?.status]);

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-600">
            <AlertTriangle className="h-6 w-6" />
            <div>
              <p className="font-medium">Error loading test status</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setError(null);
              fetchStatus();
            }}
            className="mt-4"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!testRun) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading test status...
        </CardContent>
      </Card>
    );
  }

  const progressPercent = testRun.progress * 100;
  const completedCount = testRun.completed_prompts + testRun.failed_prompts;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {testRun.status === 'running' && (
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            )}
            {testRun.status === 'completed' && (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            {testRun.status === 'failed' && (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            Batch Test
          </CardTitle>
          <Badge
            variant={
              testRun.status === 'running'
                ? 'default'
                : testRun.status === 'completed'
                ? 'secondary'
                : 'destructive'
            }
          >
            {testRun.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Testing {testRun.model_name}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>
              {completedCount} / {testRun.total_prompts} prompts
            </span>
          </div>
          <Progress value={progressPercent} className="h-3" />
          <p className="text-xs text-muted-foreground text-center">
            {Math.round(progressPercent)}% complete
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-green-600">
              {metrics?.successRate?.toFixed(1) || 0}%
            </p>
            <p className="text-xs text-muted-foreground">Success Rate</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">
              {metrics?.avgLatencyMs?.toFixed(0) || 0}ms
            </p>
            <p className="text-xs text-muted-foreground">Avg Latency</p>
          </div>
        </div>

        {/* Error Breakdown */}
        {metrics && metrics.failedPrompts > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Error Breakdown</h4>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {Object.entries(metrics.errorCounts).map(([error, count]) => (
                <div key={error} className="flex justify-between">
                  <span>{error}</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results List */}
        {testRun.results && testRun.results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Results</h4>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {testRun.results.map((result, index) => (
                <div
                  key={result.id || index}
                  className={`p-3 rounded-lg border ${
                    result.success
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                      : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">
                        Prompt {index + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                      {result.latency_ms && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {(result.latency_ms / 1000).toFixed(2)}s
                        </span>
                      )}
                      {result.output_tokens && (
                        <span>{result.output_tokens} tokens</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {result.prompt.slice(0, 80)}
                    {result.prompt.length > 80 ? '...' : ''}
                  </p>
                  {result.error && (
                    <p className="text-xs text-red-600 mt-1">{result.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Running indicator */}
        {testRun.status === 'running' && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing prompts...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default BatchTestProgress;
