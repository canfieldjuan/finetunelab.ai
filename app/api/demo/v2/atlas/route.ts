/**
 * Demo V2 Chat API
 * POST /api/demo/v2/atlas - Chat with user's model about batch test results
 *
 * Enables BYOM (Bring Your Own Model) qualitative analysis.
 * Users chat with their configured model to analyze test metrics.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDemoSessionMetrics,
  getDemoTestRunSummary,
  validateDemoSession,
} from '@/lib/demo/demo-analytics.service';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { session_id, messages } = await req.json();

    if (!session_id) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    // Validate session
    const validation = await validateDemoSession(session_id);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid session' },
        { status: validation.error === 'Session expired' ? 410 : 404 }
      );
    }

    // Get test run summary for context
    const testRun = await getDemoTestRunSummary(session_id);
    const metrics = await getDemoSessionMetrics(session_id);

    // Build system prompt with session context (simplified for user's model)
    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant helping users analyze their batch test results.

## CURRENT TEST CONTEXT
Model: ${validation.modelName || 'Unknown'}
${testRun ? `
Test Status: ${testRun.status}
Total Prompts: ${testRun.total_prompts}
Completed: ${testRun.completed_prompts}
Failed: ${testRun.failed_prompts}
` : ''}
${metrics ? `
## QUICK METRICS SUMMARY
- Success Rate: ${metrics.successRate.toFixed(1)}%
- Average Latency: ${metrics.avgLatencyMs.toFixed(0)}ms
- P95 Latency: ${metrics.p95LatencyMs.toFixed(0)}ms
- Total Tokens: ${metrics.totalInputTokens + metrics.totalOutputTokens}
` : ''}

## YOUR ROLE
Help the user understand these batch test results. Answer questions about:
- Success rates and failure patterns
- Latency performance (averages, percentiles)
- Token usage and efficiency
- Specific prompt/response quality

Be conversational and data-driven. Use the metrics summary above to answer questions.
If the user asks for detailed breakdowns or specific examples, let them know the summary above contains the key metrics available.`,
    };

    const enhancedMessages = [systemMessage, ...messages];

    // Load user's model configuration from session
    const supabase = await createClient();
    const { data: modelConfig, error: configError } = await supabase
      .from('demo_model_configs')
      .select('endpoint_url, api_key_encrypted, model_id, model_name')
      .eq('session_id', session_id)
      .single();

    if (configError || !modelConfig) {
      console.error('[DemoAtlas] Failed to load model config:', configError);
      return NextResponse.json({ error: 'Session configuration not found' }, { status: 404 });
    }

    // Decrypt API key
    const { decryptApiKey } = await import('@/lib/demo/encryption');
    let apiKey: string;
    try {
      apiKey = decryptApiKey(modelConfig.api_key_encrypted);
    } catch (decryptError) {
      console.error('[DemoAtlas] Failed to decrypt API key:', decryptError);
      return NextResponse.json({ error: 'Invalid session configuration' }, { status: 400 });
    }

    // Call user's model
    const { callDemoModel } = await import('@/lib/demo/openai-compatible-caller');

    const modelResponse = await callDemoModel(
      {
        url: modelConfig.endpoint_url,
        apiKey: apiKey,
        modelId: modelConfig.model_id,
      },
      enhancedMessages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      {
        maxTokens: 2000,
        temperature: 0.3,
      }
    );

    // Handle model errors
    if (!modelResponse.success) {
      console.error('[DemoAtlas] Model call failed:', modelResponse.error);
      return NextResponse.json(
        { error: modelResponse.error || 'Failed to get response from model' },
        { status: 500 }
      );
    }

    // Extract response content
    const finalResponse = modelResponse.response || '';
    const tokenUsage = {
      input_tokens: modelResponse.input_tokens || 0,
      output_tokens: modelResponse.output_tokens || 0,
    };

    // Stream response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send token usage if available
          if (tokenUsage) {
            const tokenData = `data: ${JSON.stringify({
              type: 'token_usage',
              input_tokens: tokenUsage.input_tokens,
              output_tokens: tokenUsage.output_tokens,
            })}\n\n`;
            controller.enqueue(encoder.encode(tokenData));
          }

          // Stream response in chunks
          const chunkSize = 3;
          for (let i = 0; i < finalResponse.length; i += chunkSize) {
            const chunk = finalResponse.slice(i, i + chunkSize);
            const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(data));
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('[DemoAtlas] Streaming error:', error);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[DemoAtlas] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
