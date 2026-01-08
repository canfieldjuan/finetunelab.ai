import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

interface ReplayOverrides {
  modelName?: string;
  modelProvider?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  disableCache?: boolean;
}

interface ReplayRequest {
  overrides?: ReplayOverrides;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: traceId } = await params;

  try {
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

    const { data: originalTrace, error: traceError } = await supabase
      .from('llm_traces')
      .select('*')
      .eq('id', traceId)
      .eq('user_id', user.id)
      .single();

    if (traceError || !originalTrace) {
      return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
    }

    const body = (await req.json()) as ReplayRequest;
    const overrides = body.overrides || {};

    const inputData = originalTrace.input_data as Record<string, unknown> || {};
    const originalParams = inputData.parameters as Record<string, unknown> || {};

    const replayedInputData = {
      ...inputData,
      systemPrompt: overrides.systemPrompt !== undefined ? overrides.systemPrompt : inputData.systemPrompt,
      parameters: {
        ...originalParams,
        temperature: overrides.temperature !== undefined ? overrides.temperature : originalParams.temperature,
        maxTokens: overrides.maxTokens !== undefined ? overrides.maxTokens : originalParams.maxTokens,
        disableCache: overrides.disableCache !== undefined ? overrides.disableCache : false,
      },
    };

    const replayMetadata = {
      originalTraceId: originalTrace.id,
      replayedAt: new Date().toISOString(),
      overrides: Object.keys(overrides).length > 0 ? overrides : null,
      isReplay: true,
    };

    const replaySpanId = `replay_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const replayTraceId = `replay_${originalTrace.trace_id}_${Date.now()}`;

    const { data: replayTrace, error: insertError } = await supabase
      .from('llm_traces')
      .insert({
        user_id: user.id,
        conversation_id: originalTrace.conversation_id,
        message_id: originalTrace.message_id,
        trace_id: replayTraceId,
        parent_trace_id: originalTrace.trace_id,
        span_id: replaySpanId,
        span_name: `${originalTrace.span_name}_replay`,
        start_time: new Date().toISOString(),
        operation_type: 'replay',
        model_name: overrides.modelName || originalTrace.model_name,
        model_provider: overrides.modelProvider || originalTrace.model_provider,
        input_data: replayedInputData,
        metadata: replayMetadata,
        status: 'completed',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      originalTrace: {
        id: originalTrace.id,
        trace_id: originalTrace.trace_id,
        span_name: originalTrace.span_name,
        model_name: originalTrace.model_name,
        model_provider: originalTrace.model_provider,
        input_data: originalTrace.input_data,
        output_data: originalTrace.output_data,
        input_tokens: originalTrace.input_tokens,
        output_tokens: originalTrace.output_tokens,
        cost_usd: originalTrace.cost_usd,
        duration_ms: originalTrace.duration_ms,
      },
      replayTrace,
      overridesApplied: overrides,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
