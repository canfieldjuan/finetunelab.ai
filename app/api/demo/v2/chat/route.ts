/**
 * Demo Chat API - Atlas Assistant for BYOM Demo
 *
 * Session-based (no auth) chat API for Atlas to analyze batch test results.
 * Limited to 10 questions per demo session.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ToolDefinition } from '@/lib/llm/openai';
import { executeDemoBatchTestTraces } from '@/lib/tools/demo/demo-batch-test-traces.handler';
import { executeTool } from '@/lib/tools/toolManager';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Demo-specific tools (simplified subset)
const demoTools: ToolDefinition[] = [
  // Calculator tool
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: 'Perform EXACT mathematical calculations with full precision. Use this for computing percentages, averages, ratios, and any other numeric analysis.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "(100 / 200) * 100")',
          },
        },
        required: ['expression']
      }
    }
  },
  // Batch Test Results tool
  {
    type: 'function',
    function: {
      name: 'get_batch_test_results',
      description: `Retrieve and analyze batch test results from the current demo session.

Use this to:
- See all prompts and responses from the batch test
- Analyze success/failure patterns
- Check latency and performance metrics
- Review token usage

This provides detailed insights into how the user's model performed during the batch test.`,
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['get_batch_results', 'get_batch_summary', 'get_performance_stats'],
            description: `Operation to perform:
- get_batch_results: Get individual test results with filtering
- get_batch_summary: Get aggregate statistics (success rate, avg latency, token totals)
- get_performance_stats: Get detailed performance analysis (percentiles, outliers, efficiency)`
          },
          success_only: {
            type: 'boolean',
            description: 'Filter to only successful results (for get_batch_results)'
          },
          failed_only: {
            type: 'boolean',
            description: 'Filter to only failed results (for get_batch_results)'
          },
          min_latency_ms: {
            type: 'number',
            description: 'Minimum latency filter (for get_batch_results)'
          },
          max_latency_ms: {
            type: 'number',
            description: 'Maximum latency filter (for get_batch_results)'
          },
          min_tokens: {
            type: 'number',
            description: 'Minimum total tokens (input + output) filter (for get_batch_results)'
          },
          limit: {
            type: 'number',
            description: 'Max results to return (default: 50, for get_batch_results)'
          },
          offset: {
            type: 'number',
            description: 'Pagination offset (default: 0, for get_batch_results)'
          }
        },
        required: ['operation']
      }
    }
  },
  // DateTime tool
  {
    type: 'function',
    function: {
      name: 'datetime',
      description: 'Get current date and time information for temporal analysis.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['current'],
            description: 'Get current date/time'
          }
        },
        required: ['action']
      }
    }
  }
];

// Tool execution handler
async function executeDemoTool(toolName: string, args: Record<string, unknown>, sessionId: string) {
  console.log('[DemoChatAPI] Executing tool:', toolName, 'for session:', sessionId);

  try {
    switch (toolName) {
      case 'calculator':
        const calcResult = await executeTool('calculator', args, '', undefined, 'demo-session');
        if (calcResult.error) {
          return { error: calcResult.error };
        }
        return calcResult.data;

      case 'get_batch_test_results':
        return await executeDemoBatchTestTraces(args, sessionId);

      case 'datetime':
        const datetimeResult = await executeTool('datetime', args, '', undefined, 'demo-session');
        if (datetimeResult.error) {
          return { error: datetimeResult.error };
        }
        return datetimeResult.data;

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error('[DemoChatAPI] Tool execution error:', error);
    return { error: error instanceof Error ? error.message : 'Tool execution failed' };
  }
}

// Check and increment question count
async function checkQuestionLimit(sessionId: string): Promise<{ allowed: boolean; count: number; limit: number }> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Get or create session question count
  const { data: sessionData, error: fetchError } = await supabase
    .from('demo_sessions')
    .select('questions_asked')
    .eq('session_id', sessionId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('[DemoChatAPI] Error fetching session:', fetchError);
    // Allow on error to avoid blocking users
    return { allowed: true, count: 0, limit: 10 };
  }

  const currentCount = sessionData?.questions_asked || 0;
  const limit = 10;

  if (currentCount >= limit) {
    return { allowed: false, count: currentCount, limit };
  }

  // Increment count
  const { error: updateError } = await supabase
    .from('demo_sessions')
    .upsert({
      session_id: sessionId,
      questions_asked: currentCount + 1,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'session_id'
    });

  if (updateError) {
    console.error('[DemoChatAPI] Error updating question count:', updateError);
    // Allow on error
    return { allowed: true, count: currentCount, limit };
  }

  return { allowed: true, count: currentCount + 1, limit };
}

export async function POST(req: NextRequest) {
  try {
    // Get session ID from request
    let messages, sessionId;
    try {
      ({ messages, sessionId } = await req.json());
    } catch (jsonError) {
      console.log('[DemoChatAPI] Request aborted or invalid JSON');
      return new Response('Request aborted', { status: 499 });
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    console.log('[DemoChatAPI] Request for demo session:', sessionId);

    // Check question limit
    const limitCheck = await checkQuestionLimit(sessionId);
    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: 'question_limit_reached',
        message: `You've reached the demo limit of ${limitCheck.limit} questions. Export your results below or contact us for full access!`,
        questions_used: limitCheck.count,
        questions_limit: limitCheck.limit
      }, { status: 429 });
    }

    console.log('[DemoChatAPI] Question count:', limitCheck.count, '/', limitCheck.limit);

    // Add system message
    const systemMessage = {
      role: 'system',
      content: `You are Atlas, the Analytics Assistant for Fine Tune Lab's BYOM (Bring Your Own Model) demo.

## YOUR ROLE
You help users understand their batch test results by:
1. Analyzing success rates, latency, and token usage
2. Identifying patterns in successful vs failed requests
3. Providing insights on model performance
4. Suggesting optimizations based on the data

## CURRENT SESSION CONTEXT
Demo Session ID: ${sessionId}
Questions Used: ${limitCheck.count} / ${limitCheck.limit}

## YOUR 3 TOOLS

1. **get_batch_test_results** - Access batch test data
   - Use operation: "get_batch_summary" FIRST to get overall metrics
   - Then use "get_batch_results" to see specific test cases
   - Use "get_performance_stats" for detailed performance analysis

2. **calculator** - Perform exact calculations
   - Use for percentages, averages, cost estimates
   - Example: "(successful / total) * 100" for success rate

3. **datetime** - Get current timestamp
   - Use for temporal context

## ANALYSIS WORKFLOWS

### Initial Question: "How did my model do?"
1. Call get_batch_test_results with operation: "get_batch_summary"
2. Report key metrics: success rate, avg latency, total tokens
3. Use calculator to compute: cost estimates, tokens per second, etc.
4. Provide context: compare to typical benchmarks
5. Suggest next steps based on results

### "Why did some requests fail?"
1. Call get_batch_test_results with operation: "get_batch_results", failed_only: true
2. Analyze error messages and patterns
3. Compare failed vs successful latencies
4. Provide specific recommendations

### "How fast is my model?"
1. Call get_batch_test_results with operation: "get_performance_stats"
2. Report p50, p95, p99 latencies
3. Highlight outliers (slowest/fastest)
4. Calculate tokens per second
5. Provide optimization suggestions

## BEST PRACTICES
- Always start with get_batch_summary for overview
- Use calculator for all math (never estimate)
- Cite specific numbers from data
- Compare to benchmarks (>80% success is good, <1000ms latency is fast)
- Be encouraging - this is a demo, users are exploring
- Focus on insights, not demo limitations

## DEMO LIMITATIONS
- Limited to 10 questions per session (shown in UI badge - don't mention it)
- No user account required (session-based)
- Data auto-deleted after 24 hours
- If user asks about saving results, suggest they export the data (CSV/JSON)

Now, help the user analyze their batch test results!`
    };

    const enhancedMessages = [systemMessage, ...messages];

    // Use GPT-4o-mini for demo (cost-effective)
    const model = 'gpt-4o-mini';
    console.log('[DemoChatAPI] Using model:', model);

    // Create tool call handler
    const toolCallHandler = async (toolName: string, args: Record<string, unknown>) => {
      return await executeDemoTool(toolName, args, sessionId);
    };

    // Import and run OpenAI chat
    const { runOpenAIWithToolCalls } = await import('@/lib/llm/openai');
    const llmResponse = await runOpenAIWithToolCalls(
      enhancedMessages,
      model,
      0.3, // temperature
      3000, // maxTokens (shorter for demo)
      demoTools,
      toolCallHandler
    );

    // Extract response
    let finalResponse: string;
    let tokenUsage: { input_tokens: number; output_tokens: number } | null = null;
    let toolsCalled: Array<{name: string; success: boolean; error?: string}> | null = null;

    if (typeof llmResponse === 'object' && 'content' in llmResponse && 'usage' in llmResponse) {
      finalResponse = llmResponse.content;
      tokenUsage = llmResponse.usage;
      toolsCalled = (llmResponse as { toolsCalled?: Array<{name: string; success: boolean; error?: string}> }).toolsCalled || null;

      console.log('[DemoChatAPI] Token usage:', tokenUsage.input_tokens, 'in,', tokenUsage.output_tokens, 'out');
      if (toolsCalled) {
        console.log('[DemoChatAPI] Tools called:', toolsCalled.map(t => t.name).join(', '));
      }
    } else {
      finalResponse = llmResponse as string;
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send metadata
          if (tokenUsage) {
            const tokenData = `data: ${JSON.stringify({
              type: 'token_usage',
              input_tokens: tokenUsage.input_tokens,
              output_tokens: tokenUsage.output_tokens
            })}\n\n`;
            controller.enqueue(encoder.encode(tokenData));
          }

          // Send question count metadata
          const questionData = `data: ${JSON.stringify({
            type: 'question_count',
            questions_used: limitCheck.count,
            questions_limit: limitCheck.limit,
            questions_remaining: limitCheck.limit - limitCheck.count
          })}\n\n`;
          controller.enqueue(encoder.encode(questionData));

          // Send tools metadata
          if (toolsCalled && toolsCalled.length > 0) {
            const toolData = `data: ${JSON.stringify({
              type: 'tools_metadata',
              tools_called: toolsCalled
            })}\n\n`;
            controller.enqueue(encoder.encode(toolData));
          }

          // Stream response
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
          console.error('[DemoChatAPI] Streaming error:', error);
          const errorData = `data: ${JSON.stringify({ error: 'Stream error' })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
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
    console.error('[DemoChatAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
