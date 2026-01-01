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
import type { AnalyticsExportFilters } from './export/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
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
    filters?: AnalyticsExportFilters;
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

    const filters = options.filters;

    // First get conversation IDs for this user
    let convQuery = supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId);

    // Apply conversation ID filter if specified
    if (filters?.conversationIds && filters.conversationIds.length > 0) {
      convQuery = convQuery.in('id', filters.conversationIds);
    }

    const { data: convData, error: convError } = await convQuery;

    if (convError) throw convError;

    const conversationIds = convData?.map(c => c.id) || [];

    if (conversationIds.length === 0) {
      console.log('[DataAggregator] No conversations found for user');
      return [];
    }

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
      .in('conversation_id', conversationIds)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    let dataPoints: TokenUsageDataPoint[] = (data || []).map((msg) => ({
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

    // Apply model filter in JavaScript (metadata field filtering)
    if (filters?.models && filters.models.length > 0) {
      dataPoints = dataPoints.filter(dp => filters.models!.includes(dp.modelId));
    }

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
    filters?: AnalyticsExportFilters;
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

    const filters = options.filters;

    // First get message IDs for this user's conversations
    let convQuery = supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId);

    // Apply conversation ID filter if specified
    if (filters?.conversationIds && filters.conversationIds.length > 0) {
      convQuery = convQuery.in('id', filters.conversationIds);
    }

    const { data: convData, error: convError } = await convQuery;

    if (convError) throw convError;

    const conversationIds = convData?.map(c => c.id) || [];

    if (conversationIds.length === 0) {
      console.log('[DataAggregator] No conversations found for user');
      return [];
    }

    const { data: msgData, error: msgError } = await supabase
      .from('messages')
      .select('id, conversation_id, metadata')
      .in('conversation_id', conversationIds);

    if (msgError) throw msgError;

    const messageIds = msgData?.map(m => m.id) || [];
    const messageMap = new Map(msgData?.map(m => [m.id, m]) || []);

    if (messageIds.length === 0) {
      console.log('[DataAggregator] No messages found for user');
      return [];
    }

    // Batch messageIds to avoid URL length limits (PostgREST has ~2048 char limit)
    // With UUIDs at 36 chars each, use batches of 50 to be safe
    const BATCH_SIZE = 50;
    const batches: string[][] = [];
    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      batches.push(messageIds.slice(i, i + BATCH_SIZE));
    }

    console.log('[DataAggregator] Querying message_evaluations in', batches.length, 'batches');

    // Query each batch and combine results
    const allEvaluations: unknown[] = [];
    for (const batch of batches) {
      const { data, error } = await supabase
        .from('message_evaluations')
        .select(`
          id,
          message_id,
          created_at,
          rating,
          success,
          notes
        `)
        .in('message_id', batch)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.log('[DataAggregator] Quality metrics batch query error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          batchSize: batch.length,
          dateRange: { start: dateRange.start, end: dateRange.end }
        });
        // Continue with other batches even if one fails
        continue;
      }

      if (data) {
        allEvaluations.push(...data);
      }
    }

    let dataPoints: QualityDataPoint[] = allEvaluations.map((evaluation) => {
      const messageData = messageMap.get(evaluation.message_id);

      return {
        timestamp: new Date(evaluation.created_at),
        messageId: evaluation.message_id,
        conversationId: messageData?.conversation_id || 'unknown',
        modelId: messageData?.metadata?.model || 'unknown',
        rating: evaluation.rating || 0,
        successStatus: evaluation.success ? 'success' : 'failure',
        evaluationType: 'manual',
        notes: evaluation.notes,
      };
    });

    // Apply filters in JavaScript
    if (filters?.models && filters.models.length > 0) {
      dataPoints = dataPoints.filter(dp => filters.models!.includes(dp.modelId));
    }
    if (filters?.status && filters.status !== 'all') {
      dataPoints = dataPoints.filter(dp => dp.successStatus === filters.status);
    }
    if (filters?.minRating && filters.minRating > 0) {
      dataPoints = dataPoints.filter(dp => dp.rating >= filters.minRating!);
    }

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
    filters?: AnalyticsExportFilters;
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

    const filters = options.filters;

    // First get conversation IDs for this user
    let convQuery = supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId);

    // Apply conversation ID filter if specified
    if (filters?.conversationIds && filters.conversationIds.length > 0) {
      convQuery = convQuery.in('id', filters.conversationIds);
    }

    const { data: convData, error: convError } = await convQuery;

    if (convError) throw convError;

    const conversationIds = convData?.map(c => c.id) || [];

    if (conversationIds.length === 0) {
      console.log('[DataAggregator] No conversations found for user');
      return [];
    }

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
      .in('conversation_id', conversationIds)
      .not('tools_called', 'is', null)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    let dataPoints: ToolUsageDataPoint[] = [];

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

    // Apply filters in JavaScript
    if (filters?.toolNames && filters.toolNames.length > 0) {
      dataPoints = dataPoints.filter(dp => filters.toolNames!.includes(dp.toolName));
    }
    if (filters?.status && filters.status !== 'all') {
      const successFilter = filters.status === 'success';
      dataPoints = dataPoints.filter(dp => dp.success === successFilter);
    }

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
    filters?: AnalyticsExportFilters;
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

    const filters = options.filters;

    let query = supabase
      .from('conversations')
      .select(`
        id,
        created_at,
        updated_at,
        messages(metadata)
      `)
      .eq('user_id', userId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: true });

    // Apply conversation ID filter if specified
    if (filters?.conversationIds && filters.conversationIds.length > 0) {
      query = query.in('id', filters.conversationIds);
    }

    const { data, error } = await query;

    if (error) throw error;

    let dataPoints: ConversationDataPoint[] = (data || []).map((conv) => {
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

    // Apply model filter in JavaScript
    if (filters?.models && filters.models.length > 0) {
      dataPoints = dataPoints.filter(dp => filters.models!.includes(dp.modelId));
    }

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
    filters?: AnalyticsExportFilters;
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

    const filters = options.filters;

    // First get conversation IDs for this user
    let convQuery = supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId);

    // Apply conversation ID filter if specified
    if (filters?.conversationIds && filters.conversationIds.length > 0) {
      convQuery = convQuery.in('id', filters.conversationIds);
    }

    const { data: convData, error: convError } = await convQuery;

    if (convError) throw convError;

    const conversationIds = convData?.map(c => c.id) || [];

    if (conversationIds.length === 0) {
      console.log('[DataAggregator] No conversations found for user');
      return [];
    }

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
      .in('conversation_id', conversationIds)
      .not('error_type', 'is', null)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    let dataPoints: ErrorDataPoint[] = (data || []).map((msg) => ({
      timestamp: new Date(msg.created_at),
      messageId: msg.id,
      conversationId: msg.conversation_id,
      errorType: msg.error_type || 'unknown',
      errorMessage: msg.metadata?.error_message || 'No details available',
      fallbackUsed: msg.fallback_used || false,
      modelId: msg.metadata?.model || 'unknown',
    }));

    // Apply model filter in JavaScript
    if (filters?.models && filters.models.length > 0) {
      dataPoints = dataPoints.filter(dp => filters.models!.includes(dp.modelId));
    }

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
    filters?: AnalyticsExportFilters;
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

    const filters = options.filters;

    // First get conversation IDs for this user
    let convQuery = supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId);

    // Apply conversation ID filter if specified
    if (filters?.conversationIds && filters.conversationIds.length > 0) {
      convQuery = convQuery.in('id', filters.conversationIds);
    }

    const { data: convData, error: convError } = await convQuery;

    if (convError) throw convError;

    const conversationIds = convData?.map(c => c.id) || [];

    if (conversationIds.length === 0) {
      console.log('[DataAggregator] No conversations found for user');
      return [];
    }

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
      .in('conversation_id', conversationIds)
      .not('latency_ms', 'is', null)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    let dataPoints: LatencyDataPoint[] = (data || []).map((msg) => {
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

    // Apply model filter in JavaScript
    if (filters?.models && filters.models.length > 0) {
      dataPoints = dataPoints.filter(dp => filters.models!.includes(dp.modelId));
    }

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
