import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface AnalyticsData {
  overview: {
    totalMessages: number;
    totalConversations: number;
    totalEvaluations: number;
    avgRating: number;
    successRate: number;
  };
  ratingDistribution: Array<{ rating: number; count: number }>;
  successFailure: Array<{ name: string; value: number }>;
  tokenUsage: Array<{ date: string; input: number; output: number }>;
  errorBreakdown: Array<{ name: string; value: number }>;
  toolPerformance: Array<{ tool: string; success: number; failure: number }>;
  costTracking: Array<{ date: string; cost: number; tokens: number }>;
  conversationLengths: Array<{ range: string; count: number }>;
  responseTimeTrends: Array<{ date: string; avgLatency: number; minLatency: number; maxLatency: number }>;
}

interface UseAnalyticsParams {
  userId: string;
  timeRange?: '7d' | '30d' | '90d' | 'all';
}

export function useAnalytics({ userId, timeRange = '30d' }: UseAnalyticsParams) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);

      try {
        const dateFilter = getDateFilter(timeRange);

        // Fetch messages with metrics
        const { data: messages, error: msgError} = await supabase
          .from('messages')
          .select('id, role, created_at, latency_ms, input_tokens, output_tokens, tools_called, tool_success, error_type, user_id, conversation_id')
          .eq('user_id', userId)
          .gte('created_at', dateFilter)
          .order('created_at', { ascending: true });

        if (msgError) throw msgError;

        // Fetch evaluations
        const { data: evaluations, error: evalError } = await supabase
          .from('message_evaluations')
          .select('rating, success, failure_tags, created_at')
          .eq('evaluator_id', userId)
          .gte('created_at', dateFilter);

        if (evalError) throw evalError;

        // Fetch conversations count
        const { count: convCount, error: convError } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', dateFilter);

        if (convError) throw convError;

        // Process and aggregate data
        const analytics = processAnalyticsData(messages || [], evaluations || [], convCount || 0);
        setData(analytics);

        console.log('[Analytics] Data loaded:', {
          messages: messages?.length,
          evaluations: evaluations?.length,
          conversations: convCount
        });
      } catch (err) {
        console.error('[Analytics] Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchAnalytics();
    }
  }, [userId, timeRange]);

  return { data, loading, error, refetch: () => {} };
}

function getDateFilter(timeRange: string): string {
  const now = new Date();
  switch (timeRange) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    case 'all':
      return new Date(0).toISOString();
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }
}

function processAnalyticsData(
  messages: any[],
  evaluations: any[],
  conversationCount: number
): AnalyticsData {
  const totalMessages = messages.filter(m => m.role === 'assistant').length;
  const totalEvaluations = evaluations.length;
  const avgRating = evaluations.length > 0
    ? evaluations.reduce((sum, e) => sum + (e.rating || 0), 0) / evaluations.length
    : 0;
  const successCount = evaluations.filter(e => e.success).length;
  const successRate = evaluations.length > 0 ? (successCount / evaluations.length) * 100 : 0;

  // Rating distribution
  const ratingCounts = [1, 2, 3, 4, 5].map(rating => ({
    rating,
    count: evaluations.filter(e => e.rating === rating).length
  }));

  // Success vs failure
  const successFailure = [
    { name: 'Successful', value: successCount },
    { name: 'Failed', value: evaluations.length - successCount }
  ];

  // Token usage by day
  const tokenUsage = aggregateTokensByDay(messages);

  // Error breakdown
  const errorTypes = messages
    .filter(m => m.error_type)
    .reduce((acc: Record<string, number>, m) => {
      acc[m.error_type] = (acc[m.error_type] || 0) + 1;
      return acc;
    }, {});
  const errorBreakdown = Object.entries(errorTypes).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value
  }));

  // Tool performance
  const toolStats = messages
    .filter(m => m.tools_called && Array.isArray(m.tools_called))
    .flatMap(m => m.tools_called)
    .reduce((acc: Record<string, { success: number; failure: number }>, tool: any) => {
      if (!acc[tool.name]) {
        acc[tool.name] = { success: 0, failure: 0 };
      }
      if (tool.success) {
        acc[tool.name].success++;
      } else {
        acc[tool.name].failure++;
      }
      return acc;
    }, {});
  const toolPerformance = Object.entries(toolStats).map(([tool, stats]) => ({
    tool,
    ...stats
  }));

  // Cost tracking
  const costTracking = calculateCostTracking(tokenUsage);

  // Conversation lengths
  const conversationLengths = aggregateConversationLengths(messages);

  // Response time trends
  const responseTimeTrends = aggregateResponseTimes(messages);

  return {
    overview: {
      totalMessages,
      totalConversations: conversationCount,
      totalEvaluations,
      avgRating,
      successRate
    },
    ratingDistribution: ratingCounts,
    successFailure,
    tokenUsage,
    errorBreakdown,
    toolPerformance,
    costTracking,
    conversationLengths,
    responseTimeTrends
  };
}

function aggregateTokensByDay(messages: any[]): Array<{ date: string; input: number; output: number }> {
  const dayMap: Record<string, { input: number; output: number }> = {};

  messages.forEach(msg => {
    const date = new Date(msg.created_at).toISOString().split('T')[0];
    if (!dayMap[date]) {
      dayMap[date] = { input: 0, output: 0 };
    }
    dayMap[date].input += msg.input_tokens || 0;
    dayMap[date].output += msg.output_tokens || 0;
  });

  return Object.entries(dayMap)
    .map(([date, tokens]) => ({ date, ...tokens }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function calculateCostTracking(tokenUsage: Array<{ date: string; input: number; output: number }>): Array<{ date: string; cost: number; tokens: number }> {
  // Pricing per 1K tokens (GPT-4 default - can be made configurable)
  const INPUT_COST_PER_1K = 0.03;
  const OUTPUT_COST_PER_1K = 0.06;

  return tokenUsage.map(day => {
    const inputCost = (day.input / 1000) * INPUT_COST_PER_1K;
    const outputCost = (day.output / 1000) * OUTPUT_COST_PER_1K;
    const totalCost = inputCost + outputCost;
    const totalTokens = day.input + day.output;

    return {
      date: day.date,
      cost: parseFloat(totalCost.toFixed(4)),
      tokens: totalTokens
    };
  });
}

function aggregateConversationLengths(messages: any[]): Array<{ range: string; count: number }> {
  // Group messages by conversation
  const convMap: Record<string, number> = {};

  messages.forEach(msg => {
    if (msg.conversation_id) {
      convMap[msg.conversation_id] = (convMap[msg.conversation_id] || 0) + 1;
    }
  });

  // Count conversations in each range
  const ranges = {
    '1-5': 0,
    '6-10': 0,
    '11-20': 0,
    '21-50': 0,
    '51+': 0
  };

  Object.values(convMap).forEach(count => {
    if (count <= 5) ranges['1-5']++;
    else if (count <= 10) ranges['6-10']++;
    else if (count <= 20) ranges['11-20']++;
    else if (count <= 50) ranges['21-50']++;
    else ranges['51+']++;
  });

  return Object.entries(ranges).map(([range, count]) => ({ range, count }));
}

function aggregateResponseTimes(messages: any[]): Array<{ date: string; avgLatency: number; minLatency: number; maxLatency: number }> {
  const dayMap: Record<string, number[]> = {};

  // Group latencies by day
  messages
    .filter(m => m.latency_ms && m.role === 'assistant')
    .forEach(msg => {
      const date = new Date(msg.created_at).toISOString().split('T')[0];
      if (!dayMap[date]) {
        dayMap[date] = [];
      }
      dayMap[date].push(msg.latency_ms);
    });

  // Calculate stats for each day
  return Object.entries(dayMap)
    .map(([date, latencies]) => {
      const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
      const min = Math.min(...latencies);
      const max = Math.max(...latencies);

      return {
        date,
        avgLatency: Math.round(avg),
        minLatency: min,
        maxLatency: max
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
