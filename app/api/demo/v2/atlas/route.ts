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
      } catch (err) {
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

    // Build system prompt with session context
    const systemMessage = {
      role: 'system',
      content: `You are Atlas, the Analytics Assistant for Fine Tune Lab's demo.

## YOUR ROLE
Help users understand their batch test results through natural language queries.
Provide data-driven insights about latency, success rates, token usage, and response quality.

## CURRENT SESSION CONTEXT
Session ID: ${session_id}
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

## YOUR 6 TOOLS
1. **get_demo_metrics** - Get overall metrics (success rate, latency percentiles, token usage)
2. **get_demo_results** - Get individual prompt results with sorting/filtering
3. **search_demo_responses** - Search prompts/responses by keyword
4. **get_latency_distribution** - Get latency histogram data
5. **get_extreme_latency** - Get slowest or fastest prompts
6. **calculator** - Perform mathematical calculations

## ANALYSIS WORKFLOWS

### "What's my success rate?"
1. Call get_demo_metrics to get overall statistics
2. Report success rate with context (>90% excellent, 80-90% good, <80% needs attention)

### "Which prompts were slowest?"
1. Call get_extreme_latency with type: "slowest"
2. Show the prompts with their latency times
3. Suggest potential causes (long prompts, complex reasoning, etc.)

### "What's my p95 latency?"
1. Call get_demo_metrics
2. Report p95LatencyMs with comparison to p50 (median) for context
3. Explain what p95 means (95% of requests complete within this time)

### "Search for [keyword]"
1. Call search_demo_responses with the keyword
2. Show matching prompts and responses
3. Highlight where the keyword appears

## COMMUNICATION STYLE
- Be conversational but data-driven
- Start with the headline (key finding), then support with data
- Use markdown for structure
- Show calculations explicitly when relevant
- Suggest follow-up questions the user might want to ask

Now, help the user analyze their batch test results. If they're starting fresh, offer to show them a summary of their test metrics.`,
    };

    const enhancedMessages = [systemMessage, ...messages];

    // Get model name from environment
    const modelName = process.env.DEMO_ATLAS_MODEL || process.env.ANALYTICS_DEFAULT_MODEL || 'gpt-4o-mini';

    // Determine provider
    const getProviderForModel = (model: string): 'openai' | 'anthropic' => {
      if (model.startsWith('claude')) return 'anthropic';
      return 'openai';
    };

    const provider = getProviderForModel(modelName);

    // Create tool call handler bound to session
    const toolCallHandler = async (toolName: string, args: Record<string, unknown>) => {
      return await executeDemoAtlasTool(toolName, args, session_id);
    };

    // Import provider-specific functions
    const { runOpenAIWithToolCalls } = await import('@/lib/llm/openai');
    const { runAnthropicWithToolCalls } = await import('@/lib/llm/anthropic');

    // Execute chat with tools
    let llmResponse;
    if (provider === 'openai') {
      llmResponse = await runOpenAIWithToolCalls(
        enhancedMessages,
        modelName,
        0.3,
        2000,
        demoAtlasTools,
        toolCallHandler
      );
    } else {
      llmResponse = await runAnthropicWithToolCalls(
        enhancedMessages,
        modelName,
        0.3,
        2000,
        demoAtlasTools,
        toolCallHandler
      );
    }

    // Extract response content
    let finalResponse: string;
    let tokenUsage: { input_tokens: number; output_tokens: number } | null = null;

    if (typeof llmResponse === 'object' && 'content' in llmResponse && 'usage' in llmResponse) {
      finalResponse = llmResponse.content;
      tokenUsage = llmResponse.usage;
    } else {
      finalResponse = llmResponse as string;
    }

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
