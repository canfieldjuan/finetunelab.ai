// API route for analytics chat - provides tools for analyzing tagged sessions
import { NextRequest } from 'next/server';
import { unifiedLLMClient } from '@/lib/llm/unified-client';
import type { ToolDefinition } from '@/lib/llm/openai';
import { supabase } from '@/lib/supabaseClient';
import { executeTool } from '@/lib/tools/toolManager';
import { createClient } from '@supabase/supabase-js';
import { trainingControlTool } from '@/lib/tools/trainingControl';

export const runtime = 'nodejs';

// Analytics-specific tools for session analysis
const analyticsTools: ToolDefinition[] = [
  // Calculator tool for exact calculations
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: 'Perform EXACT mathematical calculations with full precision. Use this for computing percentages, averages, ratios, costs, and any other numeric analysis. Returns precise numeric results.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "(100 / 200) * 100" for percentage)',
          },
        },
        required: ['expression']
      }
    }
  },
  // Evaluation Metrics tool for quality analysis
  {
    type: 'function',
    function: {
      name: 'evaluation_metrics',
      description: 'Track evaluation quality scores, analyze trends, monitor success rates, compare performance across time periods, compare AI model performance, analyze tool impact on quality, analyze error patterns, analyze temporal patterns, analyze textual feedback, measure benchmark accuracy, perform advanced sentiment analysis, predict future quality trends, and detect anomalies.',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            description: 'Metrics operation to perform',
            enum: ['get_metrics', 'quality_trends', 'success_analysis', 'compare_periods', 'model_comparison', 'tool_impact_analysis', 'error_analysis', 'temporal_analysis', 'textual_feedback_analysis', 'benchmark_analysis', 'advanced_sentiment_analysis', 'predictive_quality_modeling', 'anomaly_detection']
          },
          period: {
            type: 'string',
            enum: ['day', 'week', 'month', 'quarter', 'year', 'all'],
            description: 'Time period to analyze (default: week)'
          },
          conversationId: {
            type: 'string',
            description: 'Optional: Analyze specific conversation only'
          },
          startDate: {
            type: 'string',
            description: 'Optional: Custom start date (ISO format)'
          },
          endDate: {
            type: 'string',
            description: 'Optional: Custom end date (ISO format)'
          },
          minRating: {
            type: 'number',
            description: 'Optional: Filter evaluations by minimum rating (1-5)'
          },
          maxRating: {
            type: 'number',
            description: 'Optional: Filter evaluations by maximum rating (1-5)'
          },
          modelId: {
            type: 'string',
            description: 'Optional: Filter by specific AI model ID'
          }
        },
        required: ['operation']
      }
    }
  },
  // DateTime tool for date and time operations
  {
    type: 'function',
    function: {
      name: 'datetime',
      description: 'Get current date and time information, convert between timezones, and format dates. Useful for analyzing session timing and temporal patterns.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Action to perform',
            enum: ['current', 'convert', 'format']
          },
          timezone: {
            type: 'string',
            description: 'Timezone (e.g., "America/New_York", "UTC", "Europe/London")'
          },
          fromTimezone: {
            type: 'string',
            description: 'Source timezone for conversion'
          },
          toTimezone: {
            type: 'string',
            description: 'Target timezone for conversion'
          },
          dateTime: {
            type: 'string',
            description: 'ISO 8601 date/time string (optional, defaults to now)'
          }
        },
        required: ['action']
      }
    }
  },
  // System Monitor tool for system health and performance
  {
    type: 'function',
    function: {
      name: 'system_monitor',
      description: 'Monitor system health, resource usage, and performance metrics. Check database status, tool availability, OS-level resources (CPU, Memory, Disk), analyze logs for errors, correlate user activity with performance, and get alerts for potential issues.',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            description: 'Monitoring operation to perform',
            enum: ['health_check', 'resource_usage', 'performance_metrics', 'get_alerts', 'get_system_info', 'analyze_logs', 'user_activity_correlation']
          },
          period: {
            type: 'string',
            enum: ['hour', 'day', 'week', 'month', 'all'],
            description: 'Time period for metrics analysis (default: day)'
          },
          metricType: {
            type: 'string',
            enum: ['response_time', 'throughput', 'errors', 'all'],
            description: 'Type of performance metrics to retrieve'
          },
          includeDetails: {
            type: 'boolean',
            description: 'Include detailed breakdown in results'
          },
          periodHours: {
            type: 'number',
            description: 'Number of hours to analyze logs (default: 1, for analyze_logs operation)'
          }
        },
        required: ['operation']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_session_evaluations',
      description: 'Retrieves all evaluation scores and feedback for conversations in the selected session. Returns ratings, success/failure status, feedback comments, and evaluation metadata.',
      parameters: {
        type: 'object',
        properties: {
          conversationIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of conversation IDs to get evaluations for'
          }
        },
        required: ['conversationIds']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_session_metrics',
      description: 'Aggregates performance metrics across all conversations in the session. Returns token usage, response times, tool usage statistics, error rates, and cost estimates.',
      parameters: {
        type: 'object',
        properties: {
          conversationIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of conversation IDs to analyze metrics for'
          }
        },
        required: ['conversationIds']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_session_conversations',
      description: 'Retrieves full conversation data including all messages, tools used, and metadata for the selected session. Useful for detailed analysis of conversation patterns and content.',
      parameters: {
        type: 'object',
        properties: {
          conversationIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of conversation IDs to retrieve'
          },
          includeMessages: {
            type: 'boolean',
            description: 'Whether to include full message content (default: true)',
            default: true
          }
        },
        required: ['conversationIds']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'training_control',
      description: 'Control training jobs: list saved configurations, view config details, attach datasets, and start training. Use this to help users execute training with their existing configurations.',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['list_configs', 'get_config', 'list_datasets', 'attach_dataset', 'start_training'],
            description: 'Training operation to perform'
          },
          config_id: {
            type: 'string',
            description: 'Configuration ID (required for get_config, attach_dataset, start_training)'
          },
          dataset_id: {
            type: 'string',
            description: 'Dataset ID (required for attach_dataset)'
          },
          target: {
            type: 'string',
            enum: ['local', 'kaggle', 'hf-spaces', 'runpod'],
            description: 'Training target platform (for start_training, default: local)'
          }
        },
        required: ['operation']
      }
    }
  }
];

// Tool execution handlers
async function getSessionEvaluations(conversationIds: string[]) {
  console.log('[AnalyticsAPI] Getting evaluations for', conversationIds.length, 'conversations');

  // Get message evaluations by joining through messages table
  const { data: evaluations, error } = await supabase
    .from('message_evaluations')
    .select(`
      *,
      messages!inner(conversation_id)
    `)
    .in('messages.conversation_id', conversationIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[AnalyticsAPI] Error fetching evaluations:', error);
    return { error: 'Failed to fetch evaluations' };
  }

  // Aggregate statistics
  const stats = {
    total: evaluations.length,
    avgRating: evaluations.length > 0
      ? evaluations.reduce((sum, e) => sum + (e.rating || 0), 0) / evaluations.length
      : 0,
    successRate: evaluations.length > 0
      ? (evaluations.filter(e => e.success).length / evaluations.length) * 100
      : 0,
    withFeedback: evaluations.filter(e => e.notes && e.notes.trim().length > 0).length
  };

  return {
    evaluations,
    statistics: stats
  };
}

async function getSessionMetrics(conversationIds: string[]) {
  console.log('[AnalyticsAPI] Getting metrics for', conversationIds.length, 'conversations');

  // Get all messages for token usage
  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('input_tokens, output_tokens, llm_model, created_at, conversation_id')
    .in('conversation_id', conversationIds)
    .eq('role', 'assistant'); // Only count assistant messages for token usage

  if (msgError) {
    console.error('[AnalyticsAPI] Error fetching messages:', msgError);
    return { error: 'Failed to fetch message metrics' };
  }

  // Get evaluations for response quality metrics
  const { data: evaluations } = await supabase
    .from('message_evaluations')
    .select(`
      rating,
      success,
      response_time_ms,
      messages!inner(conversation_id)
    `)
    .in('messages.conversation_id', conversationIds);

  // Get tool usage metrics
  const { data: toolCalls } = await supabase
    .from('tool_calls')
    .select(`
      tool_name,
      success,
      error_message,
      duration_ms,
      messages!inner(conversation_id)
    `)
    .in('messages.conversation_id', conversationIds);

  // Aggregate token usage
  const totalInputTokens = messages?.reduce((sum, m) => sum + (m.input_tokens || 0), 0) || 0;
  const totalOutputTokens = messages?.reduce((sum, m) => sum + (m.output_tokens || 0), 0) || 0;

  // Estimate cost (rough estimates, adjust based on actual pricing)
  // GPT-4o-mini example: $0.15/1M input, $0.60/1M output
  const estimatedCost = (totalInputTokens * 0.15 / 1_000_000) + (totalOutputTokens * 0.60 / 1_000_000);

  // Tool statistics
  const toolStats = toolCalls ? {
    total: toolCalls.length,
    successful: toolCalls.filter(t => t.success).length,
    failed: toolCalls.filter(t => !t.success).length,
    avgExecutionTime: toolCalls.length > 0
      ? toolCalls.reduce((sum, t) => sum + (t.duration_ms || 0), 0) / toolCalls.length
      : 0,
    byTool: toolCalls.reduce((acc, t) => {
      acc[t.tool_name] = (acc[t.tool_name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  } : null;

  // Response time statistics
  const avgResponseTime = evaluations && evaluations.length > 0
    ? evaluations.reduce((sum, e) => sum + (e.response_time_ms || 0), 0) / evaluations.length
    : 0;

  return {
    tokenUsage: {
      totalInput: totalInputTokens,
      totalOutput: totalOutputTokens,
      total: totalInputTokens + totalOutputTokens,
      estimatedCost: estimatedCost.toFixed(4)
    },
    performance: {
      avgResponseTimeMs: avgResponseTime,
      totalMessages: messages?.length || 0
    },
    tools: toolStats,
    conversationCount: conversationIds.length
  };
}

async function getSessionConversations(conversationIds: string[], includeMessages = true) {
  console.log('[AnalyticsAPI] Getting conversations for', conversationIds.length, 'IDs');

  // Get conversation metadata
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .in('id', conversationIds)
    .order('created_at', { ascending: false });

  if (convError) {
    console.error('[AnalyticsAPI] Error fetching conversations:', convError);
    return { error: 'Failed to fetch conversations' };
  }

  if (!includeMessages) {
    return { conversations };
  }

  // Get messages for each conversation
  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true });

  if (msgError) {
    console.error('[AnalyticsAPI] Error fetching messages:', msgError);
    return { error: 'Failed to fetch messages' };
  }

  // Group messages by conversation
  const conversationsWithMessages = conversations?.map(conv => ({
    ...conv,
    messages: messages?.filter(m => m.conversation_id === conv.id) || []
  }));

  return {
    conversations: conversationsWithMessages,
    totalMessages: messages?.length || 0
  };
}

// Tool call handler
async function executeAnalyticsTool(toolName: string, args: Record<string, unknown>, userId: string) {
  console.log('[AnalyticsAPI] Executing tool:', toolName, 'with args:', JSON.stringify(args).slice(0, 100));

  try {
    switch (toolName) {
      case 'calculator':
        // Use the shared tool manager for calculator
        const calcResult = await executeTool('calculator', args, '', undefined, userId);
        if (calcResult.error) {
          return { error: calcResult.error };
        }
        return calcResult.data;

      case 'evaluation_metrics':
        // Add userId to args for evaluation metrics
        const metricsArgs = { ...args, userId };
        const metricsResult = await executeTool('evaluation_metrics', metricsArgs, '', undefined, userId);
        if (metricsResult.error) {
          return { error: metricsResult.error };
        }
        return metricsResult.data;

      case 'datetime':
        // Use the shared tool manager for datetime
        const datetimeResult = await executeTool('datetime', args, '', undefined, userId);
        if (datetimeResult.error) {
          return { error: datetimeResult.error };
        }
        return datetimeResult.data;

      case 'system_monitor':
        // Use the shared tool manager for system monitor
        const systemResult = await executeTool('system_monitor', args, '', undefined, userId);
        if (systemResult.error) {
          return { error: systemResult.error };
        }
        return systemResult.data;

      case 'get_session_evaluations':
        return await getSessionEvaluations(args.conversationIds as string[]);

      case 'get_session_metrics':
        return await getSessionMetrics(args.conversationIds as string[]);

      case 'get_session_conversations':
        return await getSessionConversations(
          args.conversationIds as string[],
          args.includeMessages as boolean | undefined
        );

      case 'training_control':
        const trainingResult = await executeTool('training_control', args, '', undefined, userId);
        if (trainingResult.error) {
          return { error: trainingResult.error };
        }
        return trainingResult.data;

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error('[AnalyticsAPI] Tool execution error:', error);
    return { error: error instanceof Error ? error.message : 'Tool execution failed' };
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[AnalyticsAPI] Missing authorization header');
      return new Response('Unauthorized', { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authSupabase.auth.getUser();
    if (authError || !user) {
      console.error('[AnalyticsAPI] Auth failed:', authError);
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('[AnalyticsAPI] Authenticated user:', user.id);

    // Parse request body
    let messages, sessionId, experimentName, conversationIds;
    try {
      ({ messages, sessionId, experimentName, conversationIds } = await req.json());
    } catch (jsonError) {
      console.log('[AnalyticsAPI] Request aborted or invalid JSON:', jsonError instanceof Error ? jsonError.message : 'Unknown error');
      return new Response('Request aborted', { status: 499 });
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format', { status: 400 });
    }

    if (!sessionId || !experimentName || !conversationIds) {
      return new Response('Missing session context', { status: 400 });
    }

    console.log('[AnalyticsAPI] Request for session:', sessionId, '/', experimentName, 'with', conversationIds.length, 'conversations');

    // Add system message with session context
    const systemMessage = {
      role: 'system',
      content: `You are the Analytics Assistant for Fine Tune Lab.

CRITICAL: When discussing Fine Tune Lab, ALWAYS use first-person pronouns:
- Say "we offer" NOT "they offer" or "Fine Tune Lab offers"
- Say "our platform" NOT "the platform" or "their platform"
- Say "we provide" NOT "they provide"
You ARE part of the Fine Tune Lab team, not an external observer.

FORMATTING: Do NOT use bold formatting (**text**) in numbered lists. Use plain text instead.
Example: "1. Supervised Learning: explanation" NOT "1. **Supervised Learning**: explanation"

Your purpose is to help users understand and improve their LLM training sessions through data-driven insights. Provide detailed explanations and actionable recommendations.

## PROJECT CONTEXT
Our platform enables users to:
- Fine-tune and train LLM models (RLHF, DPO, supervised learning)
- Run evaluation sessions to test model quality
- Track performance metrics, costs, and token usage
- Compare different training approaches and models
- Optimize for quality vs cost tradeoffs

## YOUR ROLE
You help users analyze their training sessions by:
1. Surfacing key metrics (success rates, costs, quality scores)
2. Identifying patterns and trends in their data
3. Comparing performance across sessions or time periods
4. Diagnosing issues (errors, quality drops, cost spikes)
5. Providing actionable recommendations for improvement

## CURRENT SESSION
- Session ID: ${sessionId}
- Experiment Name: ${experimentName}
- Conversations: ${conversationIds.length}

## YOUR 7 TOOLS

### Session Data Tools (Start Here)
1. **get_session_evaluations** - Get ratings, feedback, and success/failure data
   - USE FIRST when asked about quality, ratings, or user feedback
   - Returns: evaluation scores (1-5), success boolean, feedback comments

2. **get_session_metrics** - Get token usage, costs, response times, tool usage
   - USE FIRST when asked about costs, performance, or tool usage
   - Returns: token counts, estimated costs, average response times, tool statistics

3. **get_session_conversations** - Get full conversation messages and content
   - USE when user wants to see actual conversation content or patterns
   - Returns: message history, metadata, timestamps

### Analysis Tools (Use After Getting Data)
4. **calculator** - Perform exact mathematical calculations
   - USE to compute percentages, averages, ratios, cost per conversation
   - Example: "(successful_count / total_count) * 100" for success rate
   - ALWAYS use calculator for math instead of estimating

5. **evaluation_metrics** - Advanced quality analysis with 13 operations
   - get_metrics: Overall quality statistics
   - quality_trends: Rating trends over time
   - success_analysis: Success/failure breakdown
   - compare_periods: Compare two time periods
   - model_comparison: Compare different AI models
   - tool_impact_analysis: Which tools improve/hurt quality
   - error_analysis: Error patterns and frequencies
   - temporal_analysis: Quality by time of day/week
   - textual_feedback_analysis: Analyze feedback comments
   - benchmark_analysis: Task-specific accuracy
   - advanced_sentiment_analysis: Sentiment in feedback
   - predictive_quality_modeling: Forecast future trends
   - anomaly_detection: Detect outliers

6. **datetime** - Date/time operations and formatting
   - USE for temporal analysis, timezone conversions, date formatting
   - Helps analyze when sessions ran, how recent data is

7. **system_monitor** - System health and performance monitoring
   - USE when checking system status, resource usage, or infrastructure health
   - Operations: health_check, resource_usage, performance_metrics, analyze_logs

## ANALYSIS WORKFLOWS

### "What's my success rate?" or "How did this session perform?"
1. Call get_session_evaluations(conversationIds) - get the raw data
2. Call calculator to compute: (successful / total) * 100
3. Compare to typical benchmarks (>80% is good, <60% needs attention)
4. If low, check get_session_metrics for clues (which tools failed, error rates)

### "What did this cost me?" or "Token usage analysis"
1. Call get_session_metrics(conversationIds) - get token counts and cost estimate
2. Call calculator for: cost_per_conversation = total_cost / conversation_count
3. Call calculator for: cost_per_1k_tokens = (total_cost / total_tokens) * 1000
4. Provide context: compare to typical costs, suggest optimizations if high

### "Compare this to my last session"
1. Use evaluation_metrics with operation: "compare_periods"
2. Specify date ranges for both sessions
3. Highlight key differences: quality delta, cost delta, efficiency changes
4. Provide actionable insights on what improved or degraded

### "What's causing errors?" or "Why are ratings low?"
1. Call get_session_evaluations to see ratings distribution
2. Call get_session_metrics to check tool failure rates and error patterns
3. Use evaluation_metrics with operation: "error_analysis" for patterns
4. Use evaluation_metrics with operation: "tool_impact_analysis" to see which tools correlate with low ratings
5. Provide specific diagnosis with evidence

### "Show me the actual conversations"
1. Call get_session_conversations(conversationIds, includeMessages: true)
2. Analyze message patterns, length, tool usage
3. Identify standout conversations (very high or very low ratings)

## BEST PRACTICES

1. **Always Start With Data**: Call get_session_evaluations or get_session_metrics FIRST before analyzing
2. **Use Calculator for Math**: Never estimate - always use calculator for percentages, averages, ratios
3. **Cite Specific Numbers**: "Success rate is 87.5% (35/40 conversations)" not "most conversations succeeded"
4. **Provide Context**: Compare to benchmarks, previous sessions, or industry standards
5. **Be Proactive**: If you see concerning metrics, mention it even if not asked
6. **Guide Next Steps**: Suggest what to investigate next or how to improve
7. **Chain Tools**: Combine tools for deeper insights (e.g., get evaluations → calculator → compare to benchmarks)

## DOMAIN KNOWLEDGE

**Success Rate**: % of conversations marked successful. >80% is good, 60-80% is acceptable, <60% needs attention.
**Token Economy**: Input tokens are cheaper than output. High output may indicate verbosity.
**Quality vs Cost**: Sometimes higher quality requires more expensive models or more tokens.
**Tool Impact**: Some tools may slow responses or increase costs - analyze if benefit justifies cost.
**Evaluation Lag**: Not all conversations may be evaluated yet - mention if evaluation count < conversation count.

## COMMUNICATION STYLE

- Be conversational but data-driven
- Start with the headline (key finding), then support with data
- Use markdown for structure: headers, lists, bold for emphasis
- Show calculations explicitly: "Success Rate = 35/40 = 87.5%"
- Proactively suggest next questions or investigations
- If data is missing or unclear, ask clarifying questions

Now, help the user analyze their session. If they're starting fresh, offer: "I can help you analyze this session's quality, costs, performance, or conversation content. What would you like to explore first?"`
    };

    const enhancedMessages = [systemMessage, ...messages];

    // Use a specific model for analytics (GPT-4o for better analysis)
    // TODO: Make this configurable per user preferences
    const analyticsModelId = 'gpt-4o'; // Can be changed to any model in registry

    console.log('[AnalyticsAPI] Using model:', analyticsModelId);

    // Create tool call handler with userId bound
    const toolCallHandler = async (toolName: string, args: Record<string, unknown>) => {
      return await executeAnalyticsTool(toolName, args, user.id);
    };

    // Execute chat with tools using UnifiedLLMClient
    const llmResponse = await unifiedLLMClient.chat(
      analyticsModelId,
      enhancedMessages,
      {
        tools: analyticsTools,
        temperature: 0.3, // Lower temperature for more factual analysis
        maxTokens: 4000,
        toolCallHandler,
      }
    );

    // Extract response content and metadata
    let finalResponse: string;
    let tokenUsage: { input_tokens: number; output_tokens: number } | null = null;
    let toolsCalled: Array<{name: string; success: boolean; error?: string}> | null = null;

    if (typeof llmResponse === 'object' && 'content' in llmResponse && 'usage' in llmResponse) {
      finalResponse = llmResponse.content;
      tokenUsage = llmResponse.usage;
      toolsCalled = (llmResponse as { toolsCalled?: Array<{name: string; success: boolean; error?: string}> }).toolsCalled || null;

      console.log('[AnalyticsAPI] Token usage:', tokenUsage.input_tokens, 'in,', tokenUsage.output_tokens, 'out');
      if (toolsCalled) {
        console.log('[AnalyticsAPI] Tools called:', toolsCalled.map(t => t.name).join(', '));
      }
    } else {
      finalResponse = llmResponse as string;
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send token usage metadata if available
          if (tokenUsage) {
            const tokenData = `data: ${JSON.stringify({
              type: 'token_usage',
              input_tokens: tokenUsage.input_tokens,
              output_tokens: tokenUsage.output_tokens
            })}\n\n`;
            controller.enqueue(encoder.encode(tokenData));
          }

          // Send tool metadata if available
          if (toolsCalled && toolsCalled.length > 0) {
            const toolData = `data: ${JSON.stringify({
              type: 'tools_metadata',
              tools_called: toolsCalled
            })}\n\n`;
            controller.enqueue(encoder.encode(toolData));
          }

          // Stream the response character-by-character for smooth UX
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
          console.error('[AnalyticsAPI] Streaming error:', error);
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
    console.error('[AnalyticsAPI] Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
