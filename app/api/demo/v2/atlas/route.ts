/**
 * Demo V2 Atlas Chat API
 * POST /api/demo/v2/atlas - Chat with Atlas about demo batch test results
 *
 * This is a simplified version of the full Atlas chat API,
 * scoped to demo sessions only with demo-specific tools.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDemoSessionMetrics,
  getDemoPromptResults,
  searchDemoResponses,
  getDemoLatencyDistribution,
  getDemoTestRunSummary,
  getDemoExtremeLatencyPrompts,
  validateDemoSession,
} from '@/lib/demo/demo-analytics.service';
import type { ToolDefinition } from '@/lib/llm/openai';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Demo-specific tools (simplified subset)
const demoAtlasTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_demo_metrics',
      description: 'Get overall metrics for the batch test: success rate, latency percentiles (p50, p95, p99), token usage, and response statistics.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_demo_results',
      description: 'Get individual prompt results with optional sorting and filtering.',
      parameters: {
        type: 'object',
        properties: {
          sortBy: {
            type: 'string',
            enum: ['latency', 'tokens', 'created_at'],
            description: 'Sort results by latency, token count, or creation time',
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: 'Sort order (ascending or descending)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
          },
          successOnly: {
            type: 'boolean',
            description: 'Only return successful results',
          },
          failedOnly: {
            type: 'boolean',
            description: 'Only return failed results',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_demo_responses',
      description: 'Search prompts and responses by keyword.',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Keyword to search for in prompts and responses',
          },
          searchIn: {
            type: 'string',
            enum: ['prompt', 'response', 'both'],
            description: 'Where to search (default: both)',
          },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_latency_distribution',
      description: 'Get latency distribution data for visualization (histogram buckets).',
      parameters: {
        type: 'object',
        properties: {
          bucketCount: {
            type: 'number',
            description: 'Number of histogram buckets (default: 10)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_extreme_latency',
      description: 'Get the slowest or fastest prompts.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['slowest', 'fastest'],
            description: 'Get slowest or fastest prompts',
          },
          limit: {
            type: 'number',
            description: 'Number of prompts to return (default: 5)',
          },
        },
        required: ['type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: 'Perform mathematical calculations for precise analysis.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate (e.g., "100 / 50 * 100" for percentage)',
          },
        },
        required: ['expression'],
      },
    },
  },
];

// Tool execution handler
async function executeDemoAtlasTool(
  toolName: string,
  args: Record<string, unknown>,
  sessionId: string
): Promise<unknown> {
  console.log('[DemoAtlas] Executing tool:', toolName, 'args:', JSON.stringify(args).slice(0, 200));

  switch (toolName) {
    case 'get_demo_metrics': {
      const metrics = await getDemoSessionMetrics(sessionId);
      if (!metrics) {
        return { error: 'Failed to fetch metrics' };
      }
      return metrics;
    }

    case 'get_demo_results': {
      const results = await getDemoPromptResults(sessionId, {
        sortBy: args.sortBy as 'latency' | 'tokens' | 'created_at' | undefined,
        order: args.order as 'asc' | 'desc' | undefined,
        limit: (args.limit as number) || 10,
        successOnly: args.successOnly as boolean | undefined,
        failedOnly: args.failedOnly as boolean | undefined,
      });
      return { results, count: results.length };
    }

    case 'search_demo_responses': {
      const keyword = args.keyword as string;
      if (!keyword) {
        return { error: 'Keyword is required' };
      }
      const results = await searchDemoResponses(sessionId, keyword, {
        searchIn: args.searchIn as 'prompt' | 'response' | 'both' | undefined,
      });
      return { results, count: results.length, keyword };
    }

    case 'get_latency_distribution': {
      const distribution = await getDemoLatencyDistribution(
        sessionId,
        (args.bucketCount as number) || 10
      );
      return { distribution };
    }

    case 'get_extreme_latency': {
      const type = args.type as 'slowest' | 'fastest';
      const limit = (args.limit as number) || 5;
      const results = await getDemoExtremeLatencyPrompts(sessionId, type, limit);
      return { type, results, count: results.length };
    }

    case 'calculator': {
      const expression = args.expression as string;
      if (!expression) {
        return { error: 'Expression is required' };
      }
      try {
        // Safe math evaluation (no eval)
        const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
        const result = Function(`"use strict"; return (${sanitized})`)();
        return { expression, result };
      } catch (_err) {
        return { error: `Invalid expression: ${expression}` };
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

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
    const { decrypt } = await import('@/lib/encryption');
    let apiKey: string;
    try {
      apiKey = decrypt(modelConfig.api_key_encrypted);
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
