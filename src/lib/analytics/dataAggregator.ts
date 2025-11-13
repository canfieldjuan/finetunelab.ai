/**
 * Analytics Data Aggregator
 * Aggregates raw analytics data from all sources
 * Phase 1: Enhanced Data Collection Services
 * Date: October 25, 2025
 */

import { createClient } from '@supabase/supabase-js';
import {
  DateRange,
  TokenUsageDataPoint,
  QualityDataPoint,
  ToolUsageDataPoint,
  ConversationDataPoint,
  ErrorDataPoint,
  LatencyDataPoint,
} from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Calculate date range from period
 */
function calculateDateRange(
  period: 'hour' | 'day' | 'week' | 'month' | 'all',
  endDate?: Date
): DateRange {
  const end = endDate || new Date();
  const start = new Date(end);

  switch (period) {
    case 'hour':
      start.setHours(start.getHours() - 1);
      break;
    case 'day':
      start.setDate(start.getDate() - 1);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'all':
      start.setFullYear(2020, 0, 1);
      break;
  }

  return { start, end, period };
}

/**
 * Aggregate token usage data from messages
 */
export async function aggregateTokenUsageData(
  userId: string,
  options: {
    period?: 'hour' | 'day' | 'week' | 'month' | 'all';
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<TokenUsageDataPoint[]> {
  console.log('[DataAggregator] Aggregating token usage', {
    userId,
    options,
  });

  try {
    const dateRange = options.startDate && options.endDate
      ? {
          start: new Date(options.startDate),
          end: new Date(options.endDate),
          period: options.period || 'week',
        }
      : calculateDateRange(options.period || 'week');

    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        created_at,
        input_tokens,
        output_tokens,
        metadata
      `)
      .eq('conversations.user_id', userId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    const dataPoints: TokenUsageDataPoint[] = (data || []).map((msg) => ({
      timestamp: new Date(msg.created_at),
      messageId: msg.id,
      conversationId: msg.conversation_id,
      modelId: msg.metadata?.model || 'unknown',
      inputTokens: msg.input_tokens || 0,
      outputTokens: msg.output_tokens || 0,
      totalTokens: (msg.input_tokens || 0) + (msg.output_tokens || 0),
      estimatedCost: calculateTokenCost(
        msg.input_tokens || 0,
        msg.output_tokens || 0,
        msg.metadata?.model
      ),
    }));

    console.log('[DataAggregator] Token usage aggregated', {
      dataPoints: dataPoints.length,
    });

    return dataPoints;
  } catch (error) {
    console.error('[DataAggregator] Error aggregating token usage:', error);
    throw new Error(
      `Failed to aggregate token usage: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Calculate estimated cost based on model pricing
 */
function calculateTokenCost(
  inputTokens: number,
  outputTokens: number,
  model?: string
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  };

  const modelPricing = pricing[model || ''] || { input: 0.001, output: 0.002 };
  return (inputTokens / 1000) * modelPricing.input + (outputTokens / 1000) * modelPricing.output;
}

/**
 * Aggregate quality metrics from evaluations
 */
export async function aggregateQualityMetrics(
  userId: string,
  options: {
    period?: 'hour' | 'day' | 'week' | 'month' | 'all';
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<QualityDataPoint[]> {
  console.log('[DataAggregator] Aggregating quality metrics', {
    userId,
    options,
  });

  try {
    const dateRange = options.startDate && options.endDate
      ? {
          start: new Date(options.startDate),
          end: new Date(options.endDate),
          period: options.period || 'week',
        }
      : calculateDateRange(options.period || 'week');

    const { data, error } = await supabase
      .from('evaluations')
      .select(`
        id,
        message_id,
        created_at,
        rating,
        success_status,
        evaluation_type,
        notes,
        messages!inner(conversation_id, metadata)
      `)
      .eq('messages.conversations.user_id', userId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    const dataPoints: QualityDataPoint[] = (data || []).map((evaluation) => {
      const messageData = Array.isArray(evaluation.messages) 
        ? evaluation.messages[0] 
        : evaluation.messages;
      
      return {
        timestamp: new Date(evaluation.created_at),
        messageId: evaluation.message_id,
        conversationId: messageData?.conversation_id || 'unknown',
        modelId: messageData?.metadata?.model || 'unknown',
        rating: evaluation.rating || 0,
        successStatus: evaluation.success_status || 'partial',
        evaluationType: evaluation.evaluation_type || 'manual',
        notes: evaluation.notes,
      };
    });

    console.log('[DataAggregator] Quality metrics aggregated', {
      dataPoints: dataPoints.length,
    });

    return dataPoints;
  } catch (error) {
    console.error('[DataAggregator] Error aggregating quality:', error);
    throw new Error(
      `Failed to aggregate quality metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Aggregate tool usage data from messages
 */
export async function aggregateToolUsageData(
  userId: string,
  options: {
    period?: 'hour' | 'day' | 'week' | 'month' | 'all';
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<ToolUsageDataPoint[]> {
  console.log('[DataAggregator] Aggregating tool usage', {
    userId,
    options,
  });

  try {
    const dateRange = options.startDate && options.endDate
      ? {
          start: new Date(options.startDate),
          end: new Date(options.endDate),
          period: options.period || 'week',
        }
      : calculateDateRange(options.period || 'week');

    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        created_at,
        tools_called,
        tool_success,
        error_type,
        latency_ms
      `)
      .eq('conversations.user_id', userId)
      .not('tools_called', 'is', null)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    const dataPoints: ToolUsageDataPoint[] = [];
    
    (data || []).forEach((msg) => {
      const tools = msg.tools_called || [];
      tools.forEach((toolName: string, index: number) => {
        dataPoints.push({
          timestamp: new Date(msg.created_at),
          messageId: msg.id,
          conversationId: msg.conversation_id,
          toolName,
          executionTimeMs: msg.latency_ms || 0,
          success: msg.tool_success?.[index] || false,
          errorType: msg.error_type,
        });
      });
    });

    console.log('[DataAggregator] Tool usage aggregated', {
      dataPoints: dataPoints.length,
    });

    return dataPoints;
  } catch (error) {
    console.error('[DataAggregator] Error aggregating tool usage:', error);
    throw new Error(
      `Failed to aggregate tool usage: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Aggregate conversation metrics
 */
export async function aggregateConversationMetrics(
  userId: string,
  options: {
    period?: 'hour' | 'day' | 'week' | 'month' | 'all';
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<ConversationDataPoint[]> {
  console.log('[DataAggregator] Aggregating conversation metrics', {
    userId,
    options,
  });

  try {
    const dateRange = options.startDate && options.endDate
      ? {
          start: new Date(options.startDate),
          end: new Date(options.endDate),
          period: options.period || 'week',
        }
      : calculateDateRange(options.period || 'week');

    const { data, error} = await supabase
      .from('conversations')
      .select(`
        id,
        created_at,
        updated_at,
        messages(count, metadata)
      `)
      .eq('user_id', userId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    const dataPoints: ConversationDataPoint[] = (data || []).map((conv) => {
      const messageCount = Array.isArray(conv.messages) ? conv.messages.length : 0;
      const firstMessage = Array.isArray(conv.messages) && conv.messages[0] ? conv.messages[0] : null;
      const createdTime = new Date(conv.created_at).getTime();
      const updatedTime = new Date(conv.updated_at).getTime();
      
      return {
        timestamp: new Date(conv.created_at),
        conversationId: conv.id,
        messageCount,
        turnCount: Math.ceil(messageCount / 2),
        durationMs: updatedTime - createdTime,
        completionStatus: messageCount > 0 ? 'completed' : 'active',
        modelId: (firstMessage && 'metadata' in firstMessage) ? firstMessage.metadata?.model || 'unknown' : 'unknown',
      };
    });

    console.log('[DataAggregator] Conversation metrics aggregated', {
      dataPoints: dataPoints.length,
    });

    return dataPoints;
  } catch (error) {
    console.error('[DataAggregator] Error aggregating conversations:', error);
    throw new Error(
      `Failed to aggregate conversations: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Aggregate error data from messages
 */
export async function aggregateErrorData(
  userId: string,
  options: {
    period?: 'hour' | 'day' | 'week' | 'month' | 'all';
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<ErrorDataPoint[]> {
  console.log('[DataAggregator] Aggregating error data', {
    userId,
    options,
  });

  try {
    const dateRange = options.startDate && options.endDate
      ? {
          start: new Date(options.startDate),
          end: new Date(options.endDate),
          period: options.period || 'week',
        }
      : calculateDateRange(options.period || 'week');

    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        created_at,
        error_type,
        fallback_used,
        metadata
      `)
      .eq('conversations.user_id', userId)
      .not('error_type', 'is', null)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    const dataPoints: ErrorDataPoint[] = (data || []).map((msg) => ({
      timestamp: new Date(msg.created_at),
      messageId: msg.id,
      conversationId: msg.conversation_id,
      errorType: msg.error_type || 'unknown',
      errorMessage: msg.metadata?.error_message || 'No details available',
      fallbackUsed: msg.fallback_used || false,
      modelId: msg.metadata?.model || 'unknown',
    }));

    console.log('[DataAggregator] Error data aggregated', {
      dataPoints: dataPoints.length,
    });

    return dataPoints;
  } catch (error) {
    console.error('[DataAggregator] Error aggregating errors:', error);
    throw new Error(
      `Failed to aggregate error data: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Aggregate latency data from messages
 */
export async function aggregateLatencyData(
  userId: string,
  options: {
    period?: 'hour' | 'day' | 'week' | 'month' | 'all';
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<LatencyDataPoint[]> {
  console.log('[DataAggregator] Aggregating latency data', {
    userId,
    options,
  });

  try {
    const dateRange = options.startDate && options.endDate
      ? {
          start: new Date(options.startDate),
          end: new Date(options.endDate),
          period: options.period || 'week',
        }
      : calculateDateRange(options.period || 'week');

    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        created_at,
        latency_ms,
        output_tokens,
        metadata
      `)
      .eq('conversations.user_id', userId)
      .not('latency_ms', 'is', null)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    const dataPoints: LatencyDataPoint[] = (data || []).map((msg) => {
      const latency = msg.latency_ms || 0;
      const tokens = msg.output_tokens || 1;
      
      return {
        timestamp: new Date(msg.created_at),
        messageId: msg.id,
        conversationId: msg.conversation_id,
        modelId: msg.metadata?.model || 'unknown',
        latencyMs: latency,
        tokenCount: tokens,
        tokensPerSecond: latency > 0 ? (tokens / latency) * 1000 : 0,
      };
    });

    console.log('[DataAggregator] Latency data aggregated', {
      dataPoints: dataPoints.length,
    });

    return dataPoints;
  } catch (error) {
    console.error('[DataAggregator] Error aggregating latency:', error);
    throw new Error(
      `Failed to aggregate latency data: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
