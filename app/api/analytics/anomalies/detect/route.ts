import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { detectAnomalies } from '@/lib/services/anomaly-detection.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch data for the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch trace data for the last 24 hours
    const { data: traces, error: traceError } = await supabase
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

    // 1. Duration Analysis (replaces latency_ms)
    const durationPoints = typedTraces
      .filter(t => t.duration_ms)
      .map(t => ({
        timestamp: t.start_time,
        value: t.duration_ms || 0,
        metadata: { trace_id: t.trace_id, span_id: t.span_id, operation_type: t.operation_type }
      }));

    const durationAnomalies = await detectAnomalies(
      durationPoints,
      'duration_ms',
      { zScoreThreshold: 3 }
    );

    // 2. TTFT Analysis (NEW - streaming first token delay)
    const ttftPoints = typedTraces
      .filter(t => t.ttft_ms)
      .map(t => ({
        timestamp: t.start_time,
        value: t.ttft_ms || 0,
        metadata: { trace_id: t.trace_id, model_name: t.model_name }
      }));

    const ttftAnomalies = await detectAnomalies(
      ttftPoints,
      'ttft_ms',
      { zScoreThreshold: 3 }
    );

    // 3. Throughput Analysis (NEW - tokens/second degradation)
    const throughputPoints = typedTraces
      .filter(t => t.tokens_per_second)
      .map(t => ({
        timestamp: t.start_time,
        value: t.tokens_per_second || 0,
        metadata: { trace_id: t.trace_id, model_name: t.model_name }
      }));

    const throughputAnomalies = await detectAnomalies(
      throughputPoints,
      'tokens_per_second',
      { zScoreThreshold: 3 }
    );

    // 4. Token Usage Analysis (enhanced with cache awareness)
    const tokenPoints = typedTraces.map(t => ({
      timestamp: t.start_time,
      value: (t.input_tokens || 0) + (t.output_tokens || 0),
      metadata: {
        trace_id: t.trace_id,
        cache_read: t.cache_read_input_tokens || 0,
        model_name: t.model_name
      }
    }));

    const tokenAnomalies = await detectAnomalies(
      tokenPoints,
      'total_tokens',
      { zScoreThreshold: 3 }
    );

    // 5. Cache Miss Analysis (NEW - cache_read_input_tokens drops)
    const cachePoints = typedTraces
      .filter(t => t.cache_read_input_tokens !== null && t.cache_read_input_tokens !== undefined)
      .map(t => ({
        timestamp: t.start_time,
        value: t.cache_read_input_tokens || 0,
        metadata: { trace_id: t.trace_id, model_name: t.model_name }
      }));

    const cacheMissAnomalies = await detectAnomalies(
      cachePoints,
      'cache_hit_rate',
      { zScoreThreshold: 2 }
    );

    // 6. Cost Analysis (NEW - cost spikes)
    const costPoints = typedTraces
      .filter(t => t.cost_usd)
      .map(t => ({
        timestamp: t.start_time,
        value: t.cost_usd || 0,
        metadata: { trace_id: t.trace_id, model_name: t.model_name }
      }));

    const costAnomalies = await detectAnomalies(
      costPoints,
      'cost_usd',
      { zScoreThreshold: 3 }
    );

    // 7. RAG Retrieval Latency Analysis (NEW)
    const ragLatencyPoints = typedTraces
      .filter(t => t.retrieval_latency_ms)
      .map(t => ({
        timestamp: t.start_time,
        value: t.retrieval_latency_ms || 0,
        metadata: { trace_id: t.trace_id, rag_relevance: t.rag_relevance_score }
      }));

    const ragLatencyAnomalies = await detectAnomalies(
      ragLatencyPoints,
      'retrieval_latency_ms',
      { zScoreThreshold: 3 }
    );

    // 8. RAG Relevance Score Analysis (NEW - low relevance detection)
    const relevancePoints = typedTraces
      .filter(t => t.rag_relevance_score !== null && t.rag_relevance_score !== undefined)
      .map(t => ({
        timestamp: t.start_time,
        value: t.rag_relevance_score || 0,
        metadata: { trace_id: t.trace_id }
      }));

    const lowRelevanceAnomalies = await detectAnomalies(
      relevancePoints,
      'rag_relevance_score',
      { zScoreThreshold: 2 }
    );

    // 9. Context Token Bloat Analysis (NEW)
    const contextPoints = typedTraces
      .filter(t => t.context_tokens)
      .map(t => ({
        timestamp: t.start_time,
        value: t.context_tokens || 0,
        metadata: { trace_id: t.trace_id }
      }));

    const contextBloatAnomalies = await detectAnomalies(
      contextPoints,
      'context_tokens',
      { zScoreThreshold: 3 }
    );

    // 10. Provider Queue Time Analysis (NEW)
    const queueTimePoints = typedTraces
      .filter(t => t.queue_time_ms)
      .map(t => ({
        timestamp: t.start_time,
        value: t.queue_time_ms || 0,
        metadata: { trace_id: t.trace_id, model_provider: t.model_provider }
      }));

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
    const savedAnomalies = [];

    for (const anomaly of allAnomalies) {
      const traceId = anomaly.metadata?.trace_id;
      const modelName = anomaly.metadata?.model_name;
      const operationType = anomaly.metadata?.operation_type;

      const { data, error } = await supabase
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
