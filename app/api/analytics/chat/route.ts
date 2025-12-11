// API route for analytics chat - provides tools for analyzing tagged sessions
import { NextRequest } from 'next/server';
import type { ToolDefinition } from '@/lib/llm/openai';
import { supabase } from '@/lib/supabaseClient';
import { executeTool } from '@/lib/tools/toolManager';
import { createClient } from '@supabase/supabase-js';
import { executeTrainingMetrics } from '@/lib/tools/analytics/training-metrics.handler';
import { executeTrainingPredictions } from '@/lib/tools/analytics/training-predictions.handler';
import { executeAdvancedAnalytics } from '@/lib/tools/analytics/advanced-analytics.handler';

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
      description: 'Retrieves all evaluation scores and feedback for conversations in the selected session. Returns ratings, success/failure status, feedback comments, and evaluation metadata. IMPORTANT: Use the conversation IDs from the CURRENT SESSION context above.',
      parameters: {
        type: 'object',
        properties: {
          conversationIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of conversation UUIDs from the CURRENT SESSION context (copy the exact IDs provided in the session context)'
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
      description: 'Aggregates performance metrics across all conversations in the session. Returns token usage, response times, tool usage statistics, error rates, and cost estimates with PROVIDER-SPECIFIC cost breakdown (self-hosted providers like VLLM/Ollama show $0, cloud providers show actual costs). IMPORTANT: Use the conversation IDs from the CURRENT SESSION context above.',
      parameters: {
        type: 'object',
        properties: {
          conversationIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of conversation UUIDs from the CURRENT SESSION context (copy the exact IDs provided in the session context)'
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
      description: 'Retrieves full conversation data including all messages, tools used, and metadata for the selected session. Useful for detailed analysis of conversation patterns and content. IMPORTANT: Use the conversation IDs from the CURRENT SESSION context above.',
      parameters: {
        type: 'object',
        properties: {
          conversationIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of conversation UUIDs from the CURRENT SESSION context (copy the exact IDs provided in the session context)'
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
  },
  {
    type: 'function',
    function: {
      name: 'evaluate_messages',
      description: 'Evaluate message quality using LLM-as-judge. Analyzes assistant responses for helpfulness, accuracy, clarity, safety, and completeness. Use this when the user asks about response quality, wants to evaluate session messages, or compare quality across models. Returns detailed scores (0-10) with reasoning and evidence.',
      parameters: {
        type: 'object',
        properties: {
          message_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of message IDs to evaluate. Get these from get_session_conversations tool first (filter to role=assistant messages only).'
          },
          criteria: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['helpfulness', 'accuracy', 'clarity', 'safety', 'completeness', 'all']
            },
            description: 'Which criteria to evaluate. Use "all" for comprehensive evaluation (default). Each criterion scores 0-10.',
            default: ['all']
          },
          judge_model: {
            type: 'string',
            enum: ['gpt-4-turbo', 'claude-3-opus', 'claude-3-sonnet'],
            description: 'Which LLM to use as judge. Claude Sonnet is cheaper and fast (~$0.005/msg), GPT-4 Turbo is more accurate (~$0.015/msg). Default: claude-3-sonnet',
            default: 'claude-3-sonnet'
          }
        },
        required: ['message_ids']
      }
    }
  },
  // Tool 10: Training Metrics
  {
    type: 'function',
    function: {
      name: 'training_metrics',
      description: 'Access training job status, metrics, and history. Monitor training progress, view loss curves, check GPU usage, list all training jobs, and get detailed job configurations. Use this when users ask about training jobs, progress, or want to see training metrics.',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['get_job_status', 'get_job_metrics', 'list_jobs', 'get_job_details'],
            description: 'Operation to perform'
          },
          jobId: {
            type: 'string',
            description: 'Training job ID (required for get_job_status, get_job_metrics, get_job_details)'
          },
          status: {
            type: 'string',
            enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'all'],
            description: 'Filter jobs by status (for list_jobs, default: all)'
          },
          limit: {
            type: 'number',
            description: 'Max number of jobs to return (for list_jobs, default: 50)'
          },
          offset: {
            type: 'number',
            description: 'Pagination offset (for list_jobs, default: 0)'
          }
        },
        required: ['operation']
      }
    }
  },
  // Tool 11: Training Predictions
  {
    type: 'function',
    function: {
      name: 'training_predictions',
      description: 'Access model predictions generated during training. Track how predictions improve across epochs, compare quality evolution, and analyze specific training samples. Use when users want to see prediction quality or epoch-by-epoch improvements.',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['get_predictions', 'get_predictions_by_epoch', 'compare_epochs', 'list_available_epochs'],
            description: 'Operation to perform'
          },
          jobId: {
            type: 'string',
            description: 'Training job ID (required for all operations)'
          },
          epoch: {
            type: 'number',
            description: 'Epoch number (for get_predictions_by_epoch)'
          },
          epochs: {
            type: 'array',
            items: { type: 'number' },
            description: 'Array of epoch numbers to compare (for compare_epochs)'
          },
          limit: {
            type: 'number',
            description: 'Max predictions to return (default: 50)'
          },
          offset: {
            type: 'number',
            description: 'Pagination offset (default: 0)'
          }
        },
        required: ['operation', 'jobId']
      }
    }
  },
  // Tool 12: Advanced Analytics
  {
    type: 'function',
    function: {
      name: 'advanced_analytics',
      description: 'Access advanced analytics including model comparison, benchmark results, cohort analysis, anomaly detection, sentiment trends, and quality forecasting. Use for high-level analysis across models and time periods.',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['model_comparison', 'benchmark_analysis', 'cohort_analysis', 'anomaly_detection', 'sentiment_trends', 'quality_forecast'],
            description: 'Analytics operation to perform'
          },
          period: {
            type: 'string',
            enum: ['day', 'week', 'month', 'quarter', 'year', 'all'],
            description: 'Time period to analyze (default: month)'
          },
          startDate: {
            type: 'string',
            description: 'Start date (ISO format, overrides period)'
          },
          endDate: {
            type: 'string',
            description: 'End date (ISO format)'
          },
          cohortId: {
            type: 'string',
            description: 'Cohort ID (for cohort_analysis)'
          },
          modelIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Model IDs to compare (for model_comparison)'
          },
          threshold: {
            type: 'number',
            description: 'Anomaly detection threshold (for anomaly_detection)'
          }
        },
        required: ['operation']
      }
    }
  }
];

// Tool execution handlers
async function getSessionEvaluations(conversationIds: string[], authClient = supabase) {
  console.log('[AnalyticsAPI] Getting evaluations for', conversationIds.length, 'conversations');
  console.log('[AnalyticsAPI] Conversation IDs:', conversationIds);

  // Validate conversation IDs are valid UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const invalidIds = conversationIds.filter(id => !uuidRegex.test(id));
  if (invalidIds.length > 0) {
    console.error('[AnalyticsAPI] Invalid conversation IDs detected:', invalidIds);
    return { 
      error: `Invalid conversation IDs: ${invalidIds.join(', ')}. Conversation IDs must be valid UUIDs.` 
    };
  }

  // First get message IDs from the conversations
  const { data: messages, error: msgError } = await authClient
    .from('messages')
    .select('id')
    .in('conversation_id', conversationIds);

  if (msgError) {
    console.error('[AnalyticsAPI] Error fetching messages for evaluations:', msgError);
    return { error: 'Failed to fetch messages: ' + msgError.message };
  }

  if (!messages || messages.length === 0) {
    console.log('[AnalyticsAPI] No messages found for these conversations');
    return {
      evaluations: [],
      statistics: {
        total: 0,
        avgRating: 0,
        successRate: 0,
        withFeedback: 0
      }
    };
  }

  const messageIds = messages.map(m => m.id);
  console.log('[AnalyticsAPI] Found', messageIds.length, 'messages to check for evaluations');

  // Get message evaluations
  const { data: evaluations, error } = await authClient
    .from('message_evaluations')
    .select('*')
    .in('message_id', messageIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[AnalyticsAPI] Error fetching evaluations:', error);
    return { error: 'Failed to fetch evaluations: ' + error.message };
  }

  console.log('[AnalyticsAPI] Found', evaluations?.length || 0, 'evaluations');

  // Aggregate statistics
  const stats = {
    total: evaluations?.length || 0,
    avgRating: evaluations && evaluations.length > 0
      ? evaluations.reduce((sum, e) => sum + (e.rating || 0), 0) / evaluations.length
      : 0,
    successRate: evaluations && evaluations.length > 0
      ? (evaluations.filter(e => e.success).length / evaluations.length) * 100
      : 0,
    withFeedback: evaluations ? evaluations.filter(e => e.notes && e.notes.trim().length > 0).length : 0
  };

  return {
    evaluations: evaluations || [],
    statistics: stats
  };
}

async function getSessionMetrics(conversationIds: string[], authClient = supabase) {
  console.log('[AnalyticsAPI] Getting metrics for', conversationIds.length, 'conversations');
  console.log('[AnalyticsAPI] Conversation IDs:', conversationIds);

  // Validate conversation IDs are valid UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const invalidIds = conversationIds.filter(id => !uuidRegex.test(id));
  if (invalidIds.length > 0) {
    console.error('[AnalyticsAPI] Invalid conversation IDs detected:', invalidIds);
    return { 
      error: `Invalid conversation IDs: ${invalidIds.join(', ')}. Conversation IDs must be valid UUIDs.` 
    };
  }

  // First, verify the conversations exist
  const { data: conversations, error: convCheckError } = await authClient
    .from('conversations')
    .select('id, created_at, title')
    .in('id', conversationIds);

  console.log('[AnalyticsAPI] Conversations check:', {
    found: conversations?.length || 0,
    requested: conversationIds.length,
    conversations: conversations,
    error: convCheckError
  });

  // Get all messages for token usage
  const { data: messages, error: msgError } = await authClient
    .from('messages')
    .select('id, input_tokens, output_tokens, llm_model_id, created_at, conversation_id, role')
    .in('conversation_id', conversationIds);
  
  // Get unique model IDs from messages to fetch provider information
  const modelIds = messages ? [...new Set(messages.map(m => m.llm_model_id).filter(Boolean))] : [];
  
  // Fetch model provider information for all models used in these messages
  const { data: models, error: modelError } = modelIds.length > 0 
    ? await authClient
        .from('llm_models')
        .select('id, provider, model_id, name')
        .in('id', modelIds)
    : { data: null, error: null };
  
  if (modelError) {
    console.error('[AnalyticsAPI] Error fetching model info:', modelError);
  }
  
  // Create a map of model_id -> model data for quick lookup
  const modelMap = new Map(models?.map(m => [m.id, m]) || []);
  
  console.log('[AnalyticsAPI] Fetched', models?.length || 0, 'unique models for', messages?.length || 0, 'messages');
  console.log('[AnalyticsAPI] Model providers:', models?.map(m => `${m.name}: ${m.provider}`) || []);

  console.log('[AnalyticsAPI] Query result:', {
    messageCount: messages?.length || 0,
    error: msgError,
    conversationIds: conversationIds
  });

  if (msgError) {
    console.error('[AnalyticsAPI] Error fetching messages:', msgError);
    return { error: 'Failed to fetch message metrics: ' + msgError.message };
  }

  if (!messages || messages.length === 0) {
    console.log('[AnalyticsAPI] No messages found for these conversations');
    console.log('[AnalyticsAPI] This could mean:');
    console.log('[AnalyticsAPI]   1. The conversations have no messages yet');
    console.log('[AnalyticsAPI]   2. The conversation IDs are incorrect');
    console.log('[AnalyticsAPI]   3. Messages are in a different table or structure');
    return {
      tokenUsage: {
        totalInput: 0,
        totalOutput: 0,
        total: 0,
        estimatedCost: '0.0000'
      },
      performance: {
        avgResponseTime: 0,
        totalMessages: 0
      },
      tools: null
    };
  }

  const messageIds = messages.map(m => m.id);
  console.log('[AnalyticsAPI] Found', messageIds.length, 'messages for metrics');
  
  // Log message details for debugging
  const messagesByRole = messages.reduce((acc, m) => {
    acc[m.role] = (acc[m.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('[AnalyticsAPI] Messages by role:', messagesByRole);
  console.log('[AnalyticsAPI] Sample message:', messages[0]);

  // Get evaluations for response quality metrics
  const { data: evaluations, error: evalError } = await authClient
    .from('message_evaluations')
    .select('rating, success, response_time_ms, message_id')
    .in('message_id', messageIds);

  if (evalError) {
    console.error('[AnalyticsAPI] Error fetching evaluations:', evalError);
  }

  // Get tool usage metrics
  const { data: toolCalls, error: toolError } = await authClient
    .from('tool_calls')
    .select('tool_name, success, error_message, duration_ms, message_id')
    .in('message_id', messageIds);

  if (toolError) {
    console.error('[AnalyticsAPI] Error fetching tool calls:', toolError);
  }

  // Aggregate token usage (now including ALL messages, not just assistant)
  const totalInputTokens = messages?.reduce((sum, m) => sum + (m.input_tokens || 0), 0) || 0;
  const totalOutputTokens = messages?.reduce((sum, m) => sum + (m.output_tokens || 0), 0) || 0;
  
  console.log('[AnalyticsAPI] Token totals:', {
    input: totalInputTokens,
    output: totalOutputTokens,
    messagesWithInputTokens: messages.filter(m => m.input_tokens > 0).length,
    messagesWithOutputTokens: messages.filter(m => m.output_tokens > 0).length
  });

  // Provider-based cost calculation
  // Self-hosted providers (VLLM, Ollama, etc.) = $0
  // Cloud providers use configured pricing
  const getPricingForProvider = (provider: string | null | undefined): { input: number; output: number } => {
    // Self-hosted providers have zero cost
    const selfHostedProviders = ['vllm', 'ollama', 'lmstudio', 'llamacpp', 'local'];
    if (provider && selfHostedProviders.includes(provider.toLowerCase())) {
      return { input: 0, output: 0 };
    }

    // Provider-specific pricing (per million tokens)
    switch (provider?.toLowerCase()) {
      case 'huggingface':
        return {
          input: parseFloat(process.env.ANALYTICS_COST_HUGGINGFACE_INPUT_PER_MILLION || '0.005'),
          output: parseFloat(process.env.ANALYTICS_COST_HUGGINGFACE_OUTPUT_PER_MILLION || '0.016')
        };
      case 'runpod':
      case 'runpod-serverless':
        return {
          input: parseFloat(process.env.ANALYTICS_COST_RUNPOD_INPUT_PER_MILLION || '0.10'),
          output: parseFloat(process.env.ANALYTICS_COST_RUNPOD_OUTPUT_PER_MILLION || '0.10')
        };
      case 'openai':
        return {
          input: parseFloat(process.env.ANALYTICS_COST_OPENAI_INPUT_PER_MILLION || '0.15'),
          output: parseFloat(process.env.ANALYTICS_COST_OPENAI_OUTPUT_PER_MILLION || '0.60')
        };
      case 'anthropic':
        return {
          input: parseFloat(process.env.ANALYTICS_COST_ANTHROPIC_INPUT_PER_MILLION || '0.25'),
          output: parseFloat(process.env.ANALYTICS_COST_ANTHROPIC_OUTPUT_PER_MILLION || '1.25')
        };
      default:
        // Default fallback pricing (GPT-4o-mini-like)
        return {
          input: parseFloat(process.env.ANALYTICS_COST_INPUT_PRICE_PER_MILLION || '0.15'),
          output: parseFloat(process.env.ANALYTICS_COST_OUTPUT_PRICE_PER_MILLION || '0.60')
        };
    }
  };

  // Calculate cost per message based on provider, then sum up
  let estimatedCost = 0;
  const costByProvider: Record<string, { input: number; output: number; cost: number; tokens: number }> = {};

  messages?.forEach((message) => {
    const messageData = message as { input_tokens?: number; output_tokens?: number; llm_model_id?: string };
    
    // Look up model provider from the modelMap
    const model = messageData.llm_model_id ? modelMap.get(messageData.llm_model_id) : null;
    const provider = model?.provider || 'unknown';
    const pricing = getPricingForProvider(provider);
    
    const inputCost = (messageData.input_tokens || 0) * pricing.input / 1_000_000;
    const outputCost = (messageData.output_tokens || 0) * pricing.output / 1_000_000;
    const messageCost = inputCost + outputCost;
    
    estimatedCost += messageCost;

    // Track cost breakdown by provider
    if (!costByProvider[provider]) {
      costByProvider[provider] = { input: 0, output: 0, cost: 0, tokens: 0 };
    }
    costByProvider[provider].input += messageData.input_tokens || 0;
    costByProvider[provider].output += messageData.output_tokens || 0;
    costByProvider[provider].cost += messageCost;
    costByProvider[provider].tokens += (messageData.input_tokens || 0) + (messageData.output_tokens || 0);
  });

  console.log('[AnalyticsAPI] Cost breakdown by provider:', costByProvider);

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
      estimatedCost: estimatedCost.toFixed(4),
      costByProvider: Object.entries(costByProvider).map(([provider, data]) => ({
        provider,
        inputTokens: data.input,
        outputTokens: data.output,
        totalTokens: data.tokens,
        cost: data.cost.toFixed(4)
      }))
    },
    performance: {
      avgResponseTimeMs: avgResponseTime,
      totalMessages: messages?.length || 0
    },
    tools: toolStats,
    conversationCount: conversationIds.length
  };
}

async function getSessionConversations(conversationIds: string[], includeMessages = true, authClient = supabase) {
  console.log('[AnalyticsAPI] Getting conversations for', conversationIds.length, 'IDs');
  console.log('[AnalyticsAPI] Conversation IDs:', conversationIds);

  // Validate conversation IDs are valid UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const invalidIds = conversationIds.filter(id => !uuidRegex.test(id));
  if (invalidIds.length > 0) {
    console.error('[AnalyticsAPI] Invalid conversation IDs detected:', invalidIds);
    return { 
      error: `Invalid conversation IDs: ${invalidIds.join(', ')}. Conversation IDs must be valid UUIDs.` 
    };
  }

  // Get conversation metadata
  const { data: conversations, error: convError } = await authClient
    .from('conversations')
    .select('*')
    .in('id', conversationIds)
    .order('created_at', { ascending: false });

  if (convError) {
    console.error('[AnalyticsAPI] Error fetching conversations:', convError);
    return { error: 'Failed to fetch conversations: ' + convError.message };
  }

  if (!includeMessages) {
    return { conversations };
  }

  // Get messages for each conversation
  const { data: messages, error: msgError } = await authClient
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

// Evaluate messages using LLM-as-judge
async function evaluateMessages(
  messageIds: string[],
  criteria: string[] = ['all'],
  judgeModel: string = 'claude-3-sonnet',
  authHeader: string
) {
  console.log(`[AnalyticsAPI] Evaluating ${messageIds.length} messages with ${judgeModel}`);

  try {
    // Expand 'all' to full criteria list
    const actualCriteria = criteria.includes('all')
      ? ['helpfulness', 'accuracy', 'clarity', 'safety', 'completeness']
      : criteria;

    // Call the existing judge API
    const judgeResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/evaluation/judge`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message_ids: messageIds,
        criteria: actualCriteria,
        judge_model: judgeModel,
        save_to_db: true,
        source: 'analytics_assistant',  // Tag as assistant-initiated
      }),
    });

    if (!judgeResponse.ok) {
      const errorText = await judgeResponse.text();
      console.error('[AnalyticsAPI] Judge API error:', judgeResponse.status, errorText);
      return {
        error: true,
        message: `Judge API error (${judgeResponse.status}): ${errorText.slice(0, 200)}`,
      };
    }

    const judgeData = await judgeResponse.json();

    // Calculate summary statistics
    const evaluations = judgeData.evaluations || [];
    const totalEvaluations = evaluations.length;
    const passedCount = evaluations.filter((e: any) => e.passed).length;
    const passRate = totalEvaluations > 0 ? (passedCount / totalEvaluations) * 100 : 0;

    // Calculate average scores per criterion
    const criterionScores: Record<string, number[]> = {};
    evaluations.forEach((evaluation: any) => {
      if (!criterionScores[evaluation.criterion]) {
        criterionScores[evaluation.criterion] = [];
      }
      criterionScores[evaluation.criterion].push(evaluation.score);
    });

    const averageScores: Record<string, number> = {};
    Object.entries(criterionScores).forEach(([criterion, scores]) => {
      const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      averageScores[criterion] = Math.round(avg * 10) / 10; // Round to 1 decimal
    });

    // Identify failed evaluations
    const failedEvaluations = evaluations.filter((e: any) => !e.passed);

    // Return structured summary for the assistant
    return {
      success: true,
      summary: {
        total_evaluated: messageIds.length,
        total_judgments: totalEvaluations,
        passed: passedCount,
        failed: totalEvaluations - passedCount,
        pass_rate: `${passRate.toFixed(1)}%`,
        judge_model: judgeModel,
      },
      average_scores: averageScores,
      failed_evaluations: failedEvaluations.map((e: any) => ({
        message_id: e.message_id,
        criterion: e.criterion,
        score: e.score,
        reasoning: e.evidence?.reasoning || 'No reasoning provided',
      })),
      criteria_evaluated: actualCriteria,
    };
  } catch (error: any) {
    console.error('[AnalyticsAPI] Error in evaluateMessages:', error);
    return {
      error: true,
      message: `Failed to evaluate messages: ${error.message}`,
    };
  }
}

// Tool call handler
async function executeAnalyticsTool(toolName: string, args: Record<string, unknown>, userId: string, authHeader?: string, authClient?: any) {
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
        console.log('[AnalyticsAPI] get_session_evaluations called with args:', JSON.stringify(args));
        return await getSessionEvaluations(args.conversationIds as string[], authClient || supabase);

      case 'get_session_metrics':
        console.log('[AnalyticsAPI] get_session_metrics called with args:', JSON.stringify(args));
        return await getSessionMetrics(args.conversationIds as string[], authClient || supabase);

      case 'get_session_conversations':
        console.log('[AnalyticsAPI] get_session_conversations called with args:', JSON.stringify(args));
        return await getSessionConversations(
          args.conversationIds as string[],
          args.includeMessages as boolean | undefined,
          authClient || supabase
        );

      case 'training_control':
        const trainingResult = await executeTool('training_control', args, '', undefined, userId);
        if (trainingResult.error) {
          return { error: trainingResult.error };
        }
        return trainingResult.data;

      case 'evaluate_messages':
        if (!authHeader) {
          return { error: 'Authorization required for message evaluation' };
        }
        return await evaluateMessages(
          args.message_ids as string[],
          args.criteria as string[] | undefined,
          args.judge_model as string | undefined,
          authHeader
        );

      case 'training_metrics':
        return await executeTrainingMetrics(args, userId, authHeader, authClient);

      case 'training_predictions':
        return await executeTrainingPredictions(args, userId, authHeader, authClient);

      case 'advanced_analytics':
        return await executeAdvancedAnalytics(args, userId, authHeader, authClient);

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
    let messages, sessionId, experimentName, conversationIds, model_id;
    try {
      ({ messages, sessionId, experimentName, conversationIds, model_id } = await req.json());
    } catch (jsonError) {
      console.log('[AnalyticsAPI] Request aborted or invalid JSON:', jsonError instanceof Error ? jsonError.message : 'Unknown error');
      return new Response('Request aborted', { status: 499 });
    }

    console.log('[AnalyticsAPI] Received request body:', {
      hasMessages: !!messages,
      messageCount: messages?.length,
      sessionId: sessionId,
      experimentName: experimentName,
      conversationIds: conversationIds,
      conversationIdsLength: conversationIds?.length,
      model_id: model_id
    });

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format', { status: 400 });
    }

    // Allow experimentName to be empty string, but sessionId and conversationIds must exist
    if (!sessionId || experimentName === undefined || experimentName === null || !conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      console.error('[AnalyticsAPI] Missing session context:', {
        hasSessionId: !!sessionId,
        experimentName: experimentName,
        hasConversationIds: !!conversationIds,
        conversationIdsIsArray: Array.isArray(conversationIds),
        conversationIdsLength: conversationIds?.length
      });
      return new Response('Missing session context', { status: 400 });
    }

    // Validate conversation IDs are valid UUIDs
    console.log('[AnalyticsAPI] Validating conversation IDs:', conversationIds);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidIds = conversationIds.filter((id: string) => !uuidRegex.test(id));
    if (invalidIds.length > 0) {
      console.error('[AnalyticsAPI] Invalid conversation IDs detected:', invalidIds);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid conversation IDs',
          details: `The following conversation IDs are not valid UUIDs: ${invalidIds.join(', ')}`,
          invalidIds: invalidIds
        }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
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

## CURRENT SESSION CONTEXT
Session ID: ${sessionId}
Experiment Name: ${experimentName || '(unnamed)'}
Total Conversations: ${conversationIds.length}

CONVERSATION IDS FOR THIS SESSION:
${JSON.stringify(conversationIds)}

⚠️ CRITICAL TOOL USAGE INSTRUCTION ⚠️
When calling ANY of these tools (get_session_evaluations, get_session_metrics, get_session_conversations):
- ALWAYS use this exact conversationIds array: ${JSON.stringify(conversationIds)}
- DO NOT use ["1"] or ["${conversationIds.length}"] or any number
- DO NOT invent or guess conversation IDs
- COPY the exact UUID array shown above

EXAMPLE CORRECT TOOL CALL:
{
  "name": "get_session_metrics",
  "arguments": {
    "conversationIds": ${JSON.stringify(conversationIds)}
  }
}

## YOUR 8 TOOLS

### Session Data Tools (Start Here)
1. **get_session_evaluations** - Get ratings, feedback, and success/failure data
   - USE FIRST when asked about quality, ratings, or user feedback
   - Returns: evaluation scores (1-5), success boolean, feedback comments
   - Parameter: conversationIds (use the array from CURRENT SESSION CONTEXT above)

2. **get_session_metrics** - Get token usage, costs, response times, tool usage
   - USE FIRST when asked about costs, performance, or tool usage
   - Returns: token counts, estimated costs, average response times, tool statistics
   - Parameter: conversationIds (use the array from CURRENT SESSION CONTEXT above)

3. **get_session_conversations** - Get full conversation messages and content
   - USE when user wants to see actual conversation content or patterns
   - Returns: message history, metadata, timestamps
   - Parameter: conversationIds (use the array from CURRENT SESSION CONTEXT above)

### Analysis Tools (Use After Getting Data)
4. **calculator** - Perform exact mathematical calculations
   - USE to compute percentages, averages, ratios, cost per conversation
   - Example: "(successful_count / total_count) * 100" for success rate
   - ALWAYS use calculator for math instead of estimating

5. **evaluate_messages** - LLM-as-judge quality evaluation (NEW!)
   - USE when user asks "evaluate quality", "how good are the responses", or "rate the messages"
   - First call get_session_conversations to get message IDs (filter to assistant messages only)
   - Returns: detailed scores (0-10) for helpfulness, accuracy, clarity, safety, completeness
   - Includes reasoning, pass/fail status, and improvement suggestions
   - Example: User asks "Evaluate this session" → get conversations → filter assistant messages → evaluate_messages

6. **evaluation_metrics** - Advanced quality analysis with 13 operations
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

7. **datetime** - Date/time operations and formatting
   - USE for temporal analysis, timezone conversions, date formatting
   - Helps analyze when sessions ran, how recent data is

8. **system_monitor** - System health and performance monitoring
   - USE when checking system status, resource usage, or infrastructure health
   - Operations: health_check, resource_usage, performance_metrics, analyze_logs

### Training Tools (NEW - Full Training Access)
9. **training_metrics** - Access training job status, metrics, and history
   - USE when asked about training jobs, progress, loss curves, or GPU usage
   - Operations:
     - get_job_status: Current status, progress, epoch, step, real-time metrics
     - get_job_metrics: Detailed metrics (loss, perplexity, GPU, throughput)
     - list_jobs: All training jobs with status filters (pending/running/completed/failed)
     - get_job_details: Full config, hyperparameters, checkpoint info
   - Returns: Job status, progress %, loss/eval_loss, GPU metrics, timing estimates

10. **training_predictions** - Access model predictions from training
    - USE when asked about prediction quality, epoch improvements, or training samples
    - Operations:
      - get_predictions: Get predictions for a job with pagination
      - get_predictions_by_epoch: Predictions from specific epoch
      - compare_epochs: Compare prediction quality across epochs
      - list_available_epochs: Which epochs have predictions stored
    - Returns: Predictions, ground truth, epoch info, quality statistics

11. **advanced_analytics** - Pre-computed analytics and comparisons
    - USE for high-level analysis across models and time periods
    - Operations:
      - model_comparison: Compare performance across models
      - benchmark_analysis: Benchmark results and accuracy scores
      - cohort_analysis: Performance metrics for user cohorts
      - anomaly_detection: Detect outliers and anomalies
      - sentiment_trends: Sentiment analysis trends over time
      - quality_forecast: Predictive quality modeling
    - Returns: Aggregated metrics, trends, comparisons, forecasts

## ANALYSIS WORKFLOWS

### "What's my success rate?" or "How did this session perform?"
1. Call get_session_evaluations(conversationIds) - get the raw data
2. Call calculator to compute: (successful / total) * 100
3. Compare to typical benchmarks (>80% is good, <60% needs attention)
4. If low, check get_session_metrics for clues (which tools failed, error rates)

### "What did this cost me?" or "Token usage analysis"
1. Call get_session_metrics(conversationIds) - get token counts and cost estimate with provider breakdown
2. **ALWAYS report the costByProvider breakdown** showing which providers cost what (self-hosted = $0)
3. Call calculator for: cost_per_conversation = total_cost / conversation_count
4. Call calculator for: cost_per_1k_tokens = (total_cost / total_tokens) * 1000
5. Highlight if self-hosted models (VLLM/Ollama) saved money vs cloud providers
6. Provide context: compare to typical costs, suggest optimizations if high

EXAMPLE COST REPORT:
"Total Cost: $0.0036
Cost Breakdown by Provider:
- vllm: 5,000 tokens, $0.0000 (self-hosted, saved ~$0.0008)
- openai: 4,672 tokens, $0.0036

The VLLM self-hosted model handled 52% of tokens at zero cost, resulting in 22% cost savings compared to using OpenAI for everything."

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

### "How is my training job doing?" (NEW)
1. Call training_metrics with operation: "list_jobs" to see all jobs
2. Call training_metrics with operation: "get_job_status" for specific job to get real-time progress
3. Report: status, current epoch/step, progress %, loss trends, GPU usage, ETA
4. Use calculator to compute: epochs_remaining = total_epochs - current_epoch
5. If loss is not improving, mention early stopping or hyperparameter adjustment

### "Show me training predictions" (NEW)
1. Call training_predictions with operation: "list_available_epochs" to see which epochs have predictions
2. Call training_predictions with operation: "get_predictions_by_epoch" for specific epochs
3. Compare early vs late epoch predictions to show quality improvement
4. Use training_predictions with operation: "compare_epochs" to get statistical comparison
5. Highlight: prediction length trends, completion rates, quality evolution

### "Compare my models" (NEW)
1. Call advanced_analytics with operation: "model_comparison" for aggregated comparison
2. Use training_metrics with operation: "list_jobs" to get individual job details
3. Compare: final loss, training time, GPU efficiency, cost (if applicable)
4. Provide recommendation on which model performed best for the use case

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

**Training Loss**: Lower is better. Training loss should decrease over epochs. If plateauing, model may need more data or different hyperparameters.
**Eval Loss**: Validation loss indicates generalization. If eval_loss > train_loss and diverging, model is overfitting.
**Perplexity**: Lower is better. Measures prediction confidence. <10 is excellent, 10-30 is good, >50 needs improvement.
**GPU Utilization**: >80% is good (efficient), <50% may indicate bottlenecks (data loading, CPU preprocessing).
**Learning Rate**: Typically 1e-5 to 5e-5 for fine-tuning. Too high = unstable loss, too low = slow convergence.
**Epochs Without Improvement**: If >3 epochs without eval_loss improvement, consider early stopping to prevent overfitting.

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

    // Log the system message to verify conversation IDs are correct
    console.log('[AnalyticsAPI] System message conversation IDs:', conversationIds);
    console.log('[AnalyticsAPI] System message excerpt:', systemMessage.content.substring(0, 500));

    // Use env var for default, allow per-request override
    const defaultModelName = process.env.ANALYTICS_DEFAULT_MODEL || 'gpt-4o-mini';
    const analyticsModelName = model_id || defaultModelName;

    console.log('[AnalyticsAPI] Using model:', analyticsModelName, model_id ? '(from request)' : '(from env/default)');

    // Map model name to provider
    const getProviderForModel = (modelName: string): 'openai' | 'anthropic' | 'xai' => {
      if (modelName.startsWith('claude')) return 'anthropic';
      if (modelName.startsWith('grok')) return 'xai';
      return 'openai'; // Default to OpenAI for gpt-* models
    };

    const provider = getProviderForModel(analyticsModelName);
    console.log('[AnalyticsAPI] Detected provider:', provider);

    // Create tool call handler with userId and authHeader bound
    const toolCallHandler = async (toolName: string, args: Record<string, unknown>) => {
      return await executeAnalyticsTool(toolName, args, user.id, authHeader, authSupabase);
    };

    // Import provider-specific functions
    const { runOpenAIWithToolCalls } = await import('@/lib/llm/openai');
    const { runAnthropicWithToolCalls } = await import('@/lib/llm/anthropic');

    // Execute chat with tools using provider-specific function
    let llmResponse;
    if (provider === 'openai' || provider === 'xai') {
      // OpenAI signature: (messages, model, temperature, maxTokens, tools, toolCallHandler)
      llmResponse = await runOpenAIWithToolCalls(
        enhancedMessages,
        analyticsModelName, // model
        0.3, // temperature
        4000, // maxTokens
        analyticsTools, // tools
        toolCallHandler
      );
    } else if (provider === 'anthropic') {
      // Anthropic signature: (messages, model, temperature, maxTokens, tools, toolCallHandler)
      llmResponse = await runAnthropicWithToolCalls(
        enhancedMessages,
        analyticsModelName, // model
        0.3, // temperature
        4000, // maxTokens
        analyticsTools, // tools
        toolCallHandler
      );
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

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
          const chunkSize = parseInt(process.env.ANALYTICS_CHAT_CHUNK_SIZE || '3', 10);
          for (let i = 0; i < finalResponse.length; i += chunkSize) {
            const chunk = finalResponse.slice(i, i + chunkSize);
            const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(data));
            await new Promise(resolve => setTimeout(resolve, parseInt(process.env.ANALYTICS_CHAT_STREAMING_DELAY_MS || '10', 10)));
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
