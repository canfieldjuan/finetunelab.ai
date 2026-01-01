/**
 * DemoBatchAnalytics Component
 * Step 6: Display full traces + locked historical charts
 * Strategy: Traces = hook, Charts = depth teaser
 */

'use client';

import React, { useEffect, useState } from 'react';
import TraceView, { Trace } from '@/components/analytics/TraceView';
import { LockedChartPlaceholder } from './LockedChartPlaceholder';
import { ContactSalesModal } from '@/components/pricing/ContactSalesModal';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingDown, Brain, DollarSign, Loader2, AlertCircle } from 'lucide-react';

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
          <Button onClick={onExportClick} variant="outline">
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
          <Button onClick={onExportClick}>
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
              Historical Analytics
            </span>
          </div>
        </div>

        {/* Locked Charts Section */}
        <div>
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold mb-2">Unlock Advanced Analytics</h3>
            <p className="text-sm text-muted-foreground">
              These features require historical data (7+ days) and are available with a full account
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Chart 1: Performance Degradation */}
            <LockedChartPlaceholder
              title="Performance Trends"
              description="Track latency over time"
              benefit="Detect SLA violations before they impact users"
              icon={TrendingDown}
              onUpgradeClick={() => setShowContactModal(true)}
            />

            {/* Chart 2: Quality Forecast */}
            <LockedChartPlaceholder
              title="Quality Forecasting"
              description="Predict quality drift with ML"
              benefit="Get alerts 3 days before quality degrades"
              icon={Brain}
              onUpgradeClick={() => setShowContactModal(true)}
            />

            {/* Chart 3: Cost Tracking */}
            <LockedChartPlaceholder
              title="Cost Monitoring"
              description="Track burn rate and budgets"
              benefit="Catch runaway costs before month-end"
              icon={DollarSign}
              onUpgradeClick={() => setShowContactModal(true)}
            />
          </div>

          {/* Footer note */}
          <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-muted">
            <p className="text-sm text-center text-muted-foreground">
              💡 Full accounts include anomaly detection, custom dashboards, cohort analysis, and more.{' '}
              <button
                onClick={() => setShowContactModal(true)}
                className="text-primary hover:underline font-medium"
              >
                Contact us to learn more
              </button>
            </p>
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
