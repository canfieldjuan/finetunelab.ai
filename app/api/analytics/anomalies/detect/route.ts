import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { detectAnomalies } from '@/lib/services/anomaly-detection.service';

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch data for the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Latency Analysis
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('created_at, latency_ms, input_tokens, output_tokens')
      .eq('user_id', user.id)
      .gte('created_at', oneDayAgo)
      .not('latency_ms', 'is', null)
      .order('created_at', { ascending: true });

    if (msgError) throw msgError;

    const latencyPoints = (messages || []).map(m => ({
      timestamp: m.created_at,
      value: m.latency_ms || 0
    }));

    const latencyAnomalies = await detectAnomalies(latencyPoints, 'latency_ms', { zScoreThreshold: 3 });

    // 2. Token Usage Analysis
    const tokenPoints = (messages || []).map(m => ({
      timestamp: m.created_at,
      value: (m.input_tokens || 0) + (m.output_tokens || 0)
    }));

    const tokenAnomalies = await detectAnomalies(tokenPoints, 'total_tokens', { zScoreThreshold: 3 });

    // Save anomalies
    const allAnomalies = [...latencyAnomalies, ...tokenAnomalies];
    const savedAnomalies = [];

    for (const anomaly of allAnomalies) {
      const { data, error } = await supabase
        .from('anomaly_detections')
        .insert({
          user_id: user.id,
          anomaly_type: anomaly.type,
          severity: anomaly.severity,
          confidence_score: anomaly.confidence,
          metric_name: anomaly.description.split(' ')[0].toLowerCase(), // Extract metric name from description or pass it through
          detected_value: anomaly.detectedValue,
          expected_value: (anomaly.expectedRange.lower + anomaly.expectedRange.upper) / 2,
          threshold_value: anomaly.expectedRange.upper,
          deviation_percentage: anomaly.deviation,
          statistics: {
            expectedRange: anomaly.expectedRange,
            confidence: anomaly.confidence
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
      analyzed_points: messages?.length || 0,
      anomalies_detected: allAnomalies.length,
      anomalies_saved: savedAnomalies.length 
    });

  } catch (error) {
    console.error('[Anomaly API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
