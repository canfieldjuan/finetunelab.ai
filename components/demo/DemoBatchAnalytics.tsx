/**
 * DemoBatchAnalytics Component
 * Step 6: Display full traces + real analytics charts
 * Strategy: Show real value through live metrics
 */

'use client';

import React, { useEffect, useState } from 'react';
import TraceView, { Trace } from '@/components/analytics/TraceView';
import { DemoLatencyChart } from './DemoLatencyChart';
import { DemoSuccessChart } from './DemoSuccessChart';
import { DemoCostChart } from './DemoCostChart';
import { ContactSalesModal } from '@/components/pricing/ContactSalesModal';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface DemoBatchAnalyticsProps {
  sessionId: string;
  modelName?: string;
  onExportClick: () => void;
}

interface DemoBatchTestResult {
  id: string;
  test_run_id: string;
  demo_session_id: string;
  prompt: string;
  response?: string;
  latency_ms?: number;
  success: boolean;
  error?: string;
  model_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at: string;
}

/**
 * Convert demo batch result to Trace format for TraceView
 */
function batchResultToTrace(result: DemoBatchTestResult): Trace {
  const startTime = new Date(result.created_at);
  const endTime = new Date(startTime.getTime() + (result.latency_ms || 0));

  return {
    id: result.id,
    trace_id: result.id,
    parent_trace_id: undefined,
    span_id: result.id,
    span_name: 'batch_test_request',
    operation_type: 'llm_call',
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    duration_ms: result.latency_ms,
    status: result.success ? 'completed' : 'failed',
    model_name: result.model_id,
    input_tokens: result.input_tokens,
    output_tokens: result.output_tokens,
    total_tokens: (result.input_tokens || 0) + (result.output_tokens || 0),
    error_message: result.error,
    input_data: { prompt: result.prompt },
    output_data: { response: result.response },
    children: []
  };
}

export function DemoBatchAnalytics({ sessionId, modelName, onExportClick }: DemoBatchAnalyticsProps) {
  const [results, setResults] = useState<DemoBatchTestResult[]>([]);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  // Fetch batch results
  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/demo/v2/batch-results?session_id=${sessionId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch batch results');
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
          setResults(data.results);
          // Convert to traces
          const convertedTraces = data.results.map(batchResultToTrace);
          setTraces(convertedTraces);
        } else {
          setError('No batch test results found for this session');
        }
      } catch (err) {
        console.error('[DemoBatchAnalytics] Error fetching results:', err);
        setError(err instanceof Error ? err.message : 'Failed to load batch results');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [sessionId]);

  // Loading state
  if (isLoading) {
    return (
      <Card className="w-full max-w-6xl mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-3 text-muted-foreground">Loading batch test results...</p>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="w-full max-w-6xl mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-lg font-medium mb-2">Failed to Load Results</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button
            onClick={onExportClick}
            className="bg-green-400 hover:bg-green-500 text-white border border-green-300"
          >
            Continue to Export
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="w-full max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Batch Test Analysis</h2>
            <p className="text-muted-foreground">
              {results.length} request{results.length !== 1 ? 's' : ''} analyzed
              {modelName && ` • ${modelName}`}
            </p>
          </div>
          <Button
            onClick={onExportClick}
            className="bg-green-400 hover:bg-green-500 text-white border border-green-300"
          >
            Continue to Export
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Traces Section */}
        <Card>
          <CardHeader>
            <CardTitle>Request Traces</CardTitle>
            <CardDescription>
              Detailed execution traces for each batch test request. Click to expand and see full metrics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {traces.length > 0 ? (
              <TraceView traces={traces} />
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No traces available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-muted"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Batch Test Analytics
            </span>
          </div>
        </div>

        {/* Real Charts Section */}
        <div className="relative">
          {/* Charts Grid */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Chart 1: Latency Distribution */}
            <DemoLatencyChart
              latencies={results.map(r => r.latency_ms).filter((l): l is number => l !== undefined)}
            />

            {/* Chart 2: Success Rate */}
            <DemoSuccessChart
              successCount={results.filter(r => r.success).length}
              failureCount={results.filter(r => !r.success).length}
            />

            {/* Chart 3: Cost Analysis */}
            <DemoCostChart
              inputTokens={results.reduce((sum, r) => sum + (r.input_tokens || 0), 0)}
              outputTokens={results.reduce((sum, r) => sum + (r.output_tokens || 0), 0)}
            />
          </div>

          {/* Upgrade CTA Overlay */}
          <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="text-center">
              <h4 className="font-semibold text-base mb-2">Want More Insights?</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Get historical trend analysis, anomaly detection, quality forecasting, and custom dashboards with a full account.
              </p>
              <Button
                onClick={() => setShowContactModal(true)}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              >
                Sign Up for Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                No credit card required • 14-day free trial
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      <ContactSalesModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />
    </>
  );
}
