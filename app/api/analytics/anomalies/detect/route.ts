import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { detectAnomalies } from '@/lib/services/anomaly-detection.service';
import { recordUsageEvent } from '@/lib/usage/checker';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    // Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    }: { data: { user: any }; error: any } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch data for the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch trace data for the last 24 hours
    const { data: traces, error: traceError }: { data: any; error: any } = await supabase
      .from('llm_traces')
      .select(`
        id,
        span_id,
        trace_id,
        start_time,
        duration_ms,
        ttft_ms,
        tokens_per_second,
        input_tokens,
        output_tokens,
        total_tokens,
        cache_read_input_tokens,
        cost_usd,
        retrieval_latency_ms,
        rag_relevance_score,
        context_tokens,
        queue_time_ms,
        inference_time_ms,
        status,
        error_category,
        operation_type,
        model_name,
        model_provider
      `)
      .eq('user_id', user.id)
      .gte('start_time', oneDayAgo)
      .not('duration_ms', 'is', null)
      .order('start_time', { ascending: true });

    if (traceError) throw traceError;

    // Type-safe traces array
    type TraceData = {
      id: string;
      span_id: string;
      trace_id: string;
      start_time: string;
      duration_ms: number | null;
      ttft_ms: number | null;
      tokens_per_second: number | null;
      input_tokens: number | null;
      output_tokens: number | null;
      total_tokens: number | null;
      cache_read_input_tokens: number | null;
      cost_usd: number | null;
      retrieval_latency_ms: number | null;
      rag_relevance_score: number | null;
      context_tokens: number | null;
      queue_time_ms: number | null;
      inference_time_ms: number | null;
      status: string | null;
      error_category: string | null;
      operation_type: string | null;
      model_name: string | null;
      model_provider: string | null;
    };
    const typedTraces = (traces as TraceData[]) || [];

    // OPTIMIZED: Single-pass data collection for all 10 anomaly types
    // Before: O(10n) - 10 separate filter/map iterations
    // After: O(n) - single loop through traces
    type DataPoint = {
      timestamp: string;
      value: number;
      metadata: Record<string, any>;
    };

    const durationPoints: DataPoint[] = [];
    const ttftPoints: DataPoint[] = [];
    const throughputPoints: DataPoint[] = [];
    const tokenPoints: DataPoint[] = [];
    const cachePoints: DataPoint[] = [];
    const costPoints: DataPoint[] = [];
    const ragLatencyPoints: DataPoint[] = [];
    const relevancePoints: DataPoint[] = [];
    const contextPoints: DataPoint[] = [];
    const queueTimePoints: DataPoint[] = [];

    for (const t of typedTraces) {
      // 1. Duration Analysis
      if (t.duration_ms) {
        durationPoints.push({
          timestamp: t.start_time,
          value: t.duration_ms,
          metadata: { trace_id: t.trace_id, span_id: t.span_id, operation_type: t.operation_type }
        });
      }

      // 2. TTFT Analysis (streaming first token delay)
      if (t.ttft_ms) {
        ttftPoints.push({
          timestamp: t.start_time,
          value: t.ttft_ms,
          metadata: { trace_id: t.trace_id, model_name: t.model_name }
        });
      }

      // 3. Throughput Analysis (tokens/second degradation)
      if (t.tokens_per_second) {
        throughputPoints.push({
          timestamp: t.start_time,
          value: t.tokens_per_second,
          metadata: { trace_id: t.trace_id, model_name: t.model_name }
        });
      }

      // 4. Token Usage Analysis (always add - enhanced with cache awareness)
      tokenPoints.push({
        timestamp: t.start_time,
        value: (t.input_tokens || 0) + (t.output_tokens || 0),
        metadata: {
          trace_id: t.trace_id,
          cache_read: t.cache_read_input_tokens || 0,
          model_name: t.model_name
        }
      });

      // 5. Cache Miss Analysis (cache_read_input_tokens drops)
      if (t.cache_read_input_tokens !== null && t.cache_read_input_tokens !== undefined) {
        cachePoints.push({
          timestamp: t.start_time,
          value: t.cache_read_input_tokens,
          metadata: { trace_id: t.trace_id, model_name: t.model_name }
        });
      }

      // 6. Cost Analysis (cost spikes)
      if (t.cost_usd) {
        costPoints.push({
          timestamp: t.start_time,
          value: t.cost_usd,
          metadata: { trace_id: t.trace_id, model_name: t.model_name }
        });
      }

      // 7. RAG Retrieval Latency Analysis
      if (t.retrieval_latency_ms) {
        ragLatencyPoints.push({
          timestamp: t.start_time,
          value: t.retrieval_latency_ms,
          metadata: { trace_id: t.trace_id, rag_relevance: t.rag_relevance_score }
        });
      }

      // 8. RAG Relevance Score Analysis (low relevance detection)
      if (t.rag_relevance_score !== null && t.rag_relevance_score !== undefined) {
        relevancePoints.push({
          timestamp: t.start_time,
          value: t.rag_relevance_score,
          metadata: { trace_id: t.trace_id }
        });
      }

      // 9. Context Token Bloat Analysis
      if (t.context_tokens) {
        contextPoints.push({
          timestamp: t.start_time,
          value: t.context_tokens,
          metadata: { trace_id: t.trace_id }
        });
      }

      // 10. Provider Queue Time Analysis
      if (t.queue_time_ms) {
        queueTimePoints.push({
          timestamp: t.start_time,
          value: t.queue_time_ms,
          metadata: { trace_id: t.trace_id, model_provider: t.model_provider }
        });
      }
    }

    // Run anomaly detection on all collected data points
    const durationAnomalies = await detectAnomalies(
      durationPoints,
      'duration_ms',
      { zScoreThreshold: 3 }
    );

    const ttftAnomalies = await detectAnomalies(
      ttftPoints,
      'ttft_ms',
      { zScoreThreshold: 3 }
    );

    const throughputAnomalies = await detectAnomalies(
      throughputPoints,
      'tokens_per_second',
      { zScoreThreshold: 3 }
    );

    const tokenAnomalies = await detectAnomalies(
      tokenPoints,
      'total_tokens',
      { zScoreThreshold: 3 }
    );

    const cacheMissAnomalies = await detectAnomalies(
      cachePoints,
      'cache_hit_rate',
      { zScoreThreshold: 2 }
    );

    const costAnomalies = await detectAnomalies(
      costPoints,
      'cost_usd',
      { zScoreThreshold: 3 }
    );

    const ragLatencyAnomalies = await detectAnomalies(
      ragLatencyPoints,
      'retrieval_latency_ms',
      { zScoreThreshold: 3 }
    );

    const lowRelevanceAnomalies = await detectAnomalies(
      relevancePoints,
      'rag_relevance_score',
      { zScoreThreshold: 2 }
    );

    const contextBloatAnomalies = await detectAnomalies(
      contextPoints,
      'context_tokens',
      { zScoreThreshold: 3 }
    );

    const queueTimeAnomalies = await detectAnomalies(
      queueTimePoints,
      'queue_time_ms',
      { zScoreThreshold: 3 }
    );

    // Merge all anomalies
    const allAnomalies = [
      ...durationAnomalies,
      ...ttftAnomalies,
      ...throughputAnomalies,
      ...tokenAnomalies,
      ...cacheMissAnomalies,
      ...costAnomalies,
      ...ragLatencyAnomalies,
      ...lowRelevanceAnomalies,
      ...contextBloatAnomalies,
      ...queueTimeAnomalies
    ];
    const savedAnomalies: any[] = [];

    for (const anomaly of allAnomalies) {
      const traceId: string | undefined = anomaly.metadata?.trace_id as string | undefined;
      const modelName: string | undefined = anomaly.metadata?.model_name as string | undefined;
      const operationType: string | undefined = anomaly.metadata?.operation_type as string | undefined;

      const { data, error }: { data: any; error: any } = await supabase
        .from('anomaly_detections')
        .insert({
          user_id: user.id,
          anomaly_type: anomaly.type,
          severity: anomaly.severity,
          confidence_score: anomaly.confidence,
          metric_name: anomaly.description.split(' ')[0].toLowerCase(),
          model_id: modelName,  // Add model context
          detected_value: anomaly.detectedValue,
          expected_value: (anomaly.expectedRange.lower + anomaly.expectedRange.upper) / 2,
          threshold_value: anomaly.expectedRange.upper,
          deviation_percentage: anomaly.deviation,
          statistics: {
            expectedRange: anomaly.expectedRange,
            confidence: anomaly.confidence,
            trace_id: traceId,  // Store trace_id for linking
            operation_type: operationType
          },
          description: anomaly.description,
          contributing_factors: anomaly.contributingFactors,
          recommended_actions: anomaly.recommendedActions,
          resolution_status: 'pending',
          acknowledged: false,
          detected_at: new Date().toISOString()
        })
        .select()
        .single();

      if (!error && data) {
        savedAnomalies.push(data);
      }
    }

    // Record usage event for anomaly detection
    await recordUsageEvent({
      userId: user.id,
      metricType: 'anomaly_detection',
      value: traces?.length || 0,
      resourceType: 'trace_batch',
      metadata: {
        anomaliesDetected: allAnomalies.length,
        anomaliesSaved: savedAnomalies.length,
        timeRange: '24h',
        anomalyTypes: 10,
      },
    });

    return NextResponse.json({
      success: true,
      analyzed_traces: traces?.length || 0,
      anomaly_types_analyzed: 10,  // 10 different anomaly types
      anomalies_detected: allAnomalies.length,
      anomalies_saved: savedAnomalies.length,
      breakdown: {
        duration: durationAnomalies.length,
        ttft: ttftAnomalies.length,
        throughput: throughputAnomalies.length,
        tokens: tokenAnomalies.length,
        cache_miss: cacheMissAnomalies.length,
        cost: costAnomalies.length,
        rag_latency: ragLatencyAnomalies.length,
        rag_relevance: lowRelevanceAnomalies.length,
        context_bloat: contextBloatAnomalies.length,
        queue_time: queueTimeAnomalies.length
      }
    });

  } catch (error) {
    console.error('[Anomaly API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
