import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Strongly-typed records for analytics processing
type AnalyticsMessage = {
  id: string;
  role: 'assistant' | 'user' | string;
  created_at: string;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  tools_called?: Array<{ name: string; success?: boolean }>;
  tool_success?: boolean;
  error_type?: string;
  user_id: string;
  conversation_id?: string;
  model_id?: string;
  provider?: string | null;
};

type AnalyticsEvaluation = {
  message_id: string;
  rating?: number;
  success?: boolean;
  created_at: string;
};

type AnalyticsConversation = {
  id: string;
  session_id?: string;
  experiment_name?: string | null;
  created_at: string;
  is_widget_session?: boolean;
};

type LLMModelRow = {
  id: string;
  model_id?: string;
  name?: string;
  provider?: string;
  training_method?: string;
  base_model?: string | null;
  training_dataset?: unknown;
  evaluation_metrics?: unknown;
};

// Per-model performance metrics interface
export interface ModelPerformanceMetrics {
  modelId: string;
  modelName: string;
  provider: string | null;
  baseModel: string | null;
  trainingMethod: string | null;

  // Quality metrics
  avgRating: number;
  successRate: number;
  errorRate: number;

  // Efficiency metrics
  avgInputTokens: number;
  avgOutputTokens: number;
  avgResponseTime: number;
  costPerMessage: number;

  // Usage stats
  totalMessages: number;
  totalConversations: number;
  evaluationCount: number;

  // Training correlation (if available)
  trainingMetrics: Record<string, number> | null;
}

// Session-based A/B testing metrics interface
export interface SessionMetrics {
  sessionId: string;
  experimentName: string | null;

  // Conversation counts
  totalConversations: number;
  totalMessages: number;

  // Quality metrics
  avgRating: number;
  successRate: number;
  errorRate: number;
  // NEW: raw counts for stats
  successCount: number;

  // Efficiency metrics
  avgInputTokens: number;
  avgOutputTokens: number;
  avgResponseTime: number;
  totalCost: number;

  // Usage stats
  evaluationCount: number;
  firstConversation: string;
  lastConversation: string;
}

// Training effectiveness metrics interface
export interface TrainingEffectivenessMetrics {
  trainingMethod: string; // 'base', 'sft', 'dpo', 'rlhf'
  modelCount: number;

  // Aggregated performance
  avgRating: number;
  successRate: number;
  errorRate: number;

  // Efficiency
  avgInputTokens: number;
  avgOutputTokens: number;
  avgResponseTime: number;
  avgCostPerMessage: number;

  // Usage
  totalMessages: number;
  evaluationCount: number;

  // Model details
  models: Array<{
    modelId: string;
    modelName: string;
    baseModel: string | null;
    avgRating: number;
    successRate: number;
  }>;
}

export interface AnalyticsData {
  overview: {
    totalMessages: number;
    totalConversations: number;
    totalEvaluations: number;
    avgRating: number;
    successRate: number;

    // NEW: cost summary
    totalCost?: number;
    costPerMessage?: number;
  };
  ratingDistribution: Array<{ rating: number; count: number }>;
  successFailure: Array<{ name: string; value: number }>;
  tokenUsage: Array<{ date: string; input: number; output: number }>;
  errorBreakdown: Array<{ name: string; value: number }>;
  toolPerformance: Array<{ tool: string; success: number; failure: number }>;
  costTracking: Array<{ date: string; cost: number; tokens: number }>;
  conversationLengths: Array<{ range: string; count: number }>;
  // Enhanced to include latency percentiles and SLA
  responseTimeTrends: Array<{
    date: string;
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    slaBreachRate: number; // percentage 0-100
    sampleSize: number;
  }>;

  // NEW: Per-model breakdowns
  modelPerformance: ModelPerformanceMetrics[];

  // NEW: Session-based A/B testing
  sessionMetrics: SessionMetrics[];

  // NEW: Training effectiveness analysis
  trainingEffectiveness: TrainingEffectivenessMetrics[];

  // NEW: judgments (failure tags) breakdown
  failureTags: Array<{ tag: string; count: number }>;
}

// Analytics filters interface
export interface AnalyticsFilters {
  ratings: number[]; // Filter by specific ratings (1-5)
  models: string[]; // Filter by specific model IDs
  successFilter: 'all' | 'success' | 'failure'; // Filter by success/failure
  trainingMethods: string[]; // Filter by training methods
  sessions: string[]; // Filter by session IDs
  widgetSessionFilter: 'all' | 'widget' | 'normal'; // Filter by widget vs normal sessions
}

// New: computation/visualization settings separate from filters
export interface AnalyticsSettings {
  slaThresholdMs?: number;
  priceBook?: PriceBook;
}

// Pricing types and defaults
export type PricingRate = { inputPer1K: number; outputPer1K: number };
export type PriceBook = {
  // Exact model_id match overrides
  models?: Record<string, PricingRate>;
  // Provider-wide defaults (e.g., 'openai', 'anthropic')
  providers?: Record<string, PricingRate>;
  // Global default if nothing else matches
  default?: PricingRate;
};

const DEFAULT_PRICE_BOOK: PriceBook = {
  default: { inputPer1K: 0.03, outputPer1K: 0.06 }
};

interface UseAnalyticsParams {
  userId: string;
  timeRange?: '7d' | '30d' | '90d' | 'all';
  filters?: AnalyticsFilters;
  settings?: AnalyticsSettings;
}

export function useAnalytics({ userId, timeRange = '30d', filters, settings }: UseAnalyticsParams) {
  // Raw data state (fetched from database)
  const [rawData, setRawData] = useState<{
    messages: AnalyticsMessage[];
    evaluations: AnalyticsEvaluation[];
    conversations: AnalyticsConversation[];
    llmModels: LLMModelRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);

      try {
        const dateFilter = getDateFilter(timeRange);

        console.log('[Analytics] Fetching with filters:', {
          timeRange,
          filters: filters || 'none'
        });

        // Fetch messages with metrics
        const { data: messages, error: msgError} = await supabase
          .from('messages')
          .select('id, role, created_at, latency_ms, input_tokens, output_tokens, tools_called, tool_success, error_type, user_id, conversation_id, model_id, provider')
          .eq('user_id', userId)
          .gte('created_at', dateFilter)
          .order('created_at', { ascending: true });

        if (msgError) throw msgError;

        console.log('[Analytics] Messages loaded:', {
          total: messages?.length || 0,
          withModelId: messages?.filter(m => (m as AnalyticsMessage).model_id).length || 0
        });

        // Fetch evaluations
        const { data: evaluations, error: evalError } = await supabase
          .from('message_evaluations')
          .select('message_id, rating, success, created_at')
          .eq('user_id', userId)
          .gte('created_at', dateFilter);

        if (evalError) throw evalError;

        // Fetch conversations with session data and widget tracking
        const { data: conversations, error: convError } = await supabase
          .from('conversations')
          .select('id, session_id, experiment_name, created_at, is_widget_session')
          .eq('user_id', userId)
          .gte('created_at', dateFilter);

        if (convError) throw convError;

        console.log('[Analytics] Conversations loaded:', {
          total: conversations?.length || 0,
          withSessionId: conversations?.filter(c => (c as AnalyticsConversation).session_id).length || 0
        });

        // Fetch llm_models for training correlation
        const { data: llmModels, error: llmError } = await supabase
          .from('llm_models')
          .select('id, model_id, name, provider, training_method, base_model, training_dataset, evaluation_metrics')
          .eq('user_id', userId);

        if (llmError) {
          console.warn('[Analytics] Failed to load llm_models:', llmError);
        }

        console.log('[Analytics] LLM Models loaded:', {
          total: llmModels?.length || 0,
          withTraining: llmModels?.filter(m => (m as LLMModelRow).training_method).length || 0
        });

        // Store raw data (processing happens in useMemo)
        setRawData({
          messages: (messages || []) as AnalyticsMessage[],
          evaluations: (evaluations || []) as AnalyticsEvaluation[],
          conversations: (conversations || []) as AnalyticsConversation[],
          llmModels: (llmModels || []) as LLMModelRow[]
        });

        console.log('[Analytics] Raw data loaded:', {
          messages: messages?.length,
          evaluations: evaluations?.length,
          conversations: conversations?.length || 0,
          llmModels: llmModels?.length || 0
        });
      } catch (err) {
        console.error('[Analytics] Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    if (!userId) {
      // No user yet; stop loading so UI can render helpful empty states
      setRawData(null);
      setLoading(false);
      return;
    }

    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, timeRange]);

  // Process raw data with filters (client-side, instant updates)
  const data = useMemo(() => {
    if (!rawData) return null;

    console.log('[Analytics] Processing data with filters/settings:', {
      hasFilters: !!filters,
      hasSettings: !!settings,
      filterDetails: filters,
      settingsDetails: settings
    });

    return processAnalyticsData(
      rawData.messages,
      rawData.evaluations,
      rawData.conversations,
      rawData.llmModels,
      filters,
      settings
    );
  }, [rawData, filters, settings]);

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

// Apply filters to data before processing
function applyFilters(
  messages: AnalyticsMessage[],
  evaluations: AnalyticsEvaluation[],
  conversations: AnalyticsConversation[],
  llmModels: LLMModelRow[],
  filters?: AnalyticsFilters
): { messages: AnalyticsMessage[]; evaluations: AnalyticsEvaluation[]; conversations: AnalyticsConversation[] } {
  if (!filters) {
    console.log('[Analytics] No filters applied');
    return { messages, evaluations, conversations };
  }

  let filteredMessages = messages;
  let filteredEvaluations = evaluations;
  let filteredConversations = conversations;

  // Filter by models
  if (filters.models && filters.models.length > 0) {
    const modelSet = new Set(filters.models);
    console.log('[Analytics] Filter: models - BEFORE filtering', {
      filterModelIds: filters.models,
      totalMessages: messages.length,
      messagesWithModelId: messages.filter(m => m.model_id).length,
      uniqueModelIds: [...new Set(messages.map(m => m.model_id).filter(Boolean))],
      sampleMessage: messages.find(m => m.model_id)
    });
    filteredMessages = filteredMessages.filter(m =>
      m.model_id && modelSet.has(m.model_id)
    );
    console.log('[Analytics] Filter: models - AFTER filtering', {
      before: messages.length,
      after: filteredMessages.length,
      matchingMessages: filteredMessages.slice(0, 3).map(m => ({ id: m.id, model_id: m.model_id }))
    });
  }

  // Filter by training methods
  if (filters.trainingMethods && filters.trainingMethods.length > 0) {
    const methodSet = new Set(filters.trainingMethods);
    const modelMap = new Map<string, LLMModelRow>();
    llmModels.forEach(m => {
      if (m.model_id) {
        modelMap.set(m.model_id, m);
      }
    });

    filteredMessages = filteredMessages.filter(m => {
      if (!m.model_id) return false;
      const llmModel = modelMap.get(m.model_id);
      const trainingMethod = llmModel?.training_method || 'base';
      return methodSet.has(trainingMethod);
    });

    console.log('[Analytics] Filter: training methods', {
      before: messages.length,
      after: filteredMessages.length
    });
  }

  // Get message IDs after model/training filters
  const messageIds = new Set(filteredMessages.map(m => m.id));

  // Filter evaluations to match filtered messages
  filteredEvaluations = filteredEvaluations.filter(e =>
    messageIds.has(e.message_id)
  );

  // Filter by ratings
  if (filters.ratings && filters.ratings.length > 0) {
    const ratingSet = new Set(filters.ratings);
    filteredEvaluations = filteredEvaluations.filter(e =>
      !!e.rating && ratingSet.has(e.rating)
    );
    console.log('[Analytics] Filter: ratings', {
      before: evaluations.length,
      after: filteredEvaluations.length
    });
  }

  // Filter by success/failure
  if (filters.successFilter && filters.successFilter !== 'all') {
    const beforeCount = filteredEvaluations.length;
    if (filters.successFilter === 'success') {
      filteredEvaluations = filteredEvaluations.filter(e => e.success === true);
    } else if (filters.successFilter === 'failure') {
      filteredEvaluations = filteredEvaluations.filter(e => e.success === false);
    }
    console.log('[Analytics] Filter: success/failure', {
      type: filters.successFilter,
      before: beforeCount,
      after: filteredEvaluations.length
    });
  }

  // Get final message IDs that have evaluations (if eval filters were applied)
  const evalMessageIds = new Set(filteredEvaluations.map(e => e.message_id));

  // Only keep messages that have evaluations after filtering
  if (filters.ratings?.length > 0 || filters.successFilter !== 'all') {
    filteredMessages = filteredMessages.filter(m => evalMessageIds.has(m.id));
  }

  // Filter by sessions
  if (filters.sessions && filters.sessions.length > 0) {
    const sessionSet = new Set(filters.sessions);
    filteredConversations = filteredConversations.filter(c =>
      !!c.session_id && sessionSet.has(c.session_id)
    );

    const convIds = new Set(filteredConversations.map(c => c.id));
    filteredMessages = filteredMessages.filter(m =>
      !!m.conversation_id && convIds.has(m.conversation_id)
    );

    console.log('[Analytics] Filter: sessions', {
      before: conversations.length,
      after: filteredConversations.length
    });
  }

  // Filter by widget session type
  if (filters.widgetSessionFilter && filters.widgetSessionFilter !== 'all') {
    const beforeCount = filteredConversations.length;
    if (filters.widgetSessionFilter === 'widget') {
      filteredConversations = filteredConversations.filter(c => c.is_widget_session === true);
    } else if (filters.widgetSessionFilter === 'normal') {
      filteredConversations = filteredConversations.filter(c => c.is_widget_session === false);
    }

    const convIds = new Set(filteredConversations.map(c => c.id));
    filteredMessages = filteredMessages.filter(m =>
      !!m.conversation_id && convIds.has(m.conversation_id)
    );

    console.log('[Analytics] Filter: widget sessions', {
      type: filters.widgetSessionFilter,
      before: beforeCount,
      after: filteredConversations.length
    });
  }

  console.log('[Analytics] Final filtered counts:', {
    messages: filteredMessages.length,
    evaluations: filteredEvaluations.length,
    conversations: filteredConversations.length
  });

  return {
    messages: filteredMessages,
    evaluations: filteredEvaluations,
    conversations: filteredConversations
  };
}

function processAnalyticsData(
  messages: AnalyticsMessage[],
  evaluations: AnalyticsEvaluation[],
  conversations: AnalyticsConversation[],
  llmModels: LLMModelRow[],
  filters?: AnalyticsFilters,
  settings?: AnalyticsSettings
): AnalyticsData {
  console.log('[Analytics] Processing with filters/settings:', {
    hasFilters: !!filters,
    hasSettings: !!settings,
    filterDetails: filters,
    settingsDetails: settings
  });

  // Apply filters to data before processing
  const filtered = applyFilters(messages, evaluations, conversations, llmModels, filters);

  // Use filtered data for all calculations
  const totalMessages = filtered.messages.filter(m => m.role === 'assistant').length;
  const totalEvaluations = filtered.evaluations.length;
  const conversationCount = filtered.conversations.length;

  // DEBUG: Log evaluation data for avgRating and successRate calculation
  console.log('[Analytics] Overview calculation - Evaluation data:', {
    totalEvaluations: filtered.evaluations.length,
    sampleEvaluations: filtered.evaluations.slice(0, 3),
    allRatings: filtered.evaluations.map(e => e.rating),
    allSuccessFlags: filtered.evaluations.map(e => e.success)
  });

  const avgRating = filtered.evaluations.length > 0
    ? filtered.evaluations.reduce((sum, e) => sum + (e.rating || 0), 0) / filtered.evaluations.length
    : 0;
  const successCount = filtered.evaluations.filter(e => e.success).length;
  const successRate = filtered.evaluations.length > 0 ? (successCount / filtered.evaluations.length) * 100 : 0;

  console.log('[Analytics] Overview calculation - Results:', {
    avgRating,
    successRate,
    successCount,
    totalEvaluations
  });

  // Rating distribution
  const ratingCounts = [1, 2, 3, 4, 5].map(rating => ({
    rating,
    count: filtered.evaluations.filter(e => e.rating === rating).length
  }));

  // Success vs failure
  const successFailure = [
    { name: 'Successful', value: successCount },
    { name: 'Failed', value: filtered.evaluations.length - successCount }
  ];

  // Token usage by day
  const tokenUsage = aggregateTokensByDay(filtered.messages);

  // Error breakdown
  const errorTypes = filtered.messages
    .filter(m => m.error_type)
    .reduce((acc: Record<string, number>, m) => {
      const key = m.error_type as string;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  const errorBreakdown = Object.entries(errorTypes).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value
  }));

  // Tool performance
  const toolStats = filtered.messages
    .filter(m => m.tools_called && Array.isArray(m.tools_called))
    .flatMap(m => (m.tools_called as Array<{ name: string; success?: boolean }>))
    .reduce((acc: Record<string, { success: number; failure: number }>, tool: { name: string; success?: boolean }) => {
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

  // NEW: Failure tags (judgments) breakdown
  const failureTags = aggregateFailureTags(filtered.evaluations);

  // Cost tracking (using price book, per-message accuracy)
  const costTracking = calculateCostTracking(filtered.messages, llmModels, settings?.priceBook);
  const totalCost = costTracking.reduce((sum, d) => sum + d.cost, 0);
  const pricedMessageCount = filtered.messages.filter(m => m.role === 'assistant').length;
  const costPerMessage = pricedMessageCount > 0 ? totalCost / pricedMessageCount : 0;

  // Conversation lengths
  const conversationLengths = aggregateConversationLengths(filtered.messages);

  // Response time trends (with configurable SLA)
  console.log('[processAnalyticsData] About to calculate responseTimeTrends:', {
    messageCount: filtered.messages.length,
    slaThresholdMs: settings?.slaThresholdMs
  });
  const responseTimeTrends = aggregateResponseTimes(filtered.messages, settings?.slaThresholdMs);
  console.log('[processAnalyticsData] responseTimeTrends calculated:', {
    trendsCount: responseTimeTrends.length,
    sample: responseTimeTrends.slice(0, 2)
  });

  // NEW: Per-model performance metrics (with configurable pricing)
  const modelPerformance = aggregateByModel(filtered.messages, filtered.evaluations, llmModels, settings?.priceBook);

  // NEW: Session-based A/B testing (with configurable pricing)
  const sessionMetrics = aggregateBySession(filtered.conversations, filtered.messages, filtered.evaluations, settings?.priceBook);

  // NEW: Training effectiveness analysis (with configurable pricing)
  const trainingEffectiveness = aggregateTrainingEffectiveness(filtered.messages, filtered.evaluations, llmModels, settings?.priceBook);

  return {
    overview: {
      totalMessages,
      totalConversations: conversationCount,
      totalEvaluations,
      avgRating,
      successRate,
      totalCost: Math.round(totalCost * 100) / 100,
      costPerMessage: Math.round(costPerMessage * 10000) / 10000
    },
    ratingDistribution: ratingCounts,
    successFailure,
    tokenUsage,
    errorBreakdown,
    toolPerformance,
    costTracking,
    conversationLengths,
    responseTimeTrends,
    modelPerformance,
    sessionMetrics,
    trainingEffectiveness,
    failureTags
  };
}

// Aggregate failure tags from evaluations
// Note: failure_tags column removed from schema - returning empty array
export function aggregateFailureTags(evaluations: AnalyticsEvaluation[]): Array<{ tag: string; count: number }> {
  // TODO: Re-implement when failure_tags is added back to message_evaluations table
  console.log('[Analytics] Failure tags feature disabled (column not in database)');
  return [];

  /* Original implementation - restore when column exists:
  const tagCounts: Record<string, number> = {};

  evaluations.forEach((e) => {
    const tags = Array.isArray(e.failure_tags) ? e.failure_tags : [];
    tags.forEach((t) => {
      if (!t) return;
      const key = String(t).toLowerCase();
      tagCounts[key] = (tagCounts[key] || 0) + 1;
    });
  });

  const result = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  console.log('[Analytics] Failure tags breakdown:', {
    uniqueTags: result.length,
    top5: result.slice(0, 5)
  });

  return result;
  */
}

// Token usage by day
function aggregateTokensByDay(messages: AnalyticsMessage[]): Array<{ date: string; input: number; output: number }> {
  const dayMap: Record<string, { input: number, output: number }> = {};

  messages.forEach((msg) => {
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

// Helper to resolve pricing for a message using priceBook
function resolvePricingRate(
  message: AnalyticsMessage,
  priceBook?: PriceBook
): PricingRate {
  const book: PriceBook = { ...DEFAULT_PRICE_BOOK, ...priceBook };

  // Try model-specific pricing first
  const byModel = message.model_id && book.models?.[message.model_id];
  if (byModel) return byModel;

  // Try provider pricing second
  const providerKey = (message.provider || '').toLowerCase();
  const byProvider = providerKey && book.providers?.[providerKey];
  if (byProvider) return byProvider;

  // Fall back to default pricing
  return book.default || DEFAULT_PRICE_BOOK.default!;
}

function calculateCostTracking(
  messages: AnalyticsMessage[],
  llmModels: LLMModelRow[],
  priceBook?: PriceBook
): Array<{ date: string; cost: number; tokens: number }> {

  const dayMap: Record<string, { tokens: number; cost: number }> = {};

  messages
    .filter(m => m.role === 'assistant')
    .forEach(m => {
      const date = new Date(m.created_at).toISOString().split('T')[0];
      const rate = resolvePricingRate(m, priceBook);
      const inTok = m.input_tokens || 0;
      const outTok = m.output_tokens || 0;
      const cost = (inTok / 1000) * rate.inputPer1K + (outTok / 1000) * rate.outputPer1K;
      if (!dayMap[date]) dayMap[date] = { tokens: 0, cost: 0 };
      dayMap[date].tokens += inTok + outTok;
      dayMap[date].cost += cost;
    });

  return Object.entries(dayMap)
    .map(([date, v]) => ({ date, cost: parseFloat(v.cost.toFixed(4)), tokens: v.tokens }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateConversationLengths(messages: AnalyticsMessage[]): Array<{ range: string; count: number }> {
  // Group messages by conversation
  const convMap: Record<string, number> = {};

  messages.forEach((msg) => {
    if (msg.conversation_id) {
      convMap[msg.conversation_id] = (convMap[msg.conversation_id] || 0) + 1;
    }
  });

  // Count conversations in each range
  const ranges: Record<string, number> = {
    '1-5': 0,
    '6-10': 0,
    '11-20': 0,
    '21-50': 0,
    '51+': 0,
  };

  Object.values(convMap).forEach((count) => {
    if (count <= 5) ranges['1-5']++;
    else if (count <= 10) ranges['6-10']++;
    else if (count <= 20) ranges['11-20']++;
    else if (count <= 50) ranges['21-50']++;
    else ranges['51+']++;
  });

  return Object.entries(ranges).map(([range, count]) => ({ range, count }));
}

// Helper to compute percentile from a sorted numeric array
function computePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedValues[lower];
  const weight = idx - lower;
  return Math.round(sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight);
}

function aggregateResponseTimes(
  messages: AnalyticsMessage[],
  slaThresholdMs?: number
): Array<{ date: string; avgLatency: number; minLatency: number; maxLatency: number; p50: number; p90: number; p95: number; p99: number; slaBreachRate: number; sampleSize: number }> {
  const dayMap: Record<string, number[]> = {};

  // DEBUG: Log input data
  console.log('[aggregateResponseTimes] Input:', {
    totalMessages: messages.length,
    assistantMessages: messages.filter(m => m.role === 'assistant').length,
    messagesWithLatency: messages.filter(m => m.latency_ms).length,
    messagesWithBoth: messages.filter(m => m.latency_ms && m.role === 'assistant').length,
    sampleLatencies: messages.slice(0, 3).map(m => ({ role: m.role, latency_ms: m.latency_ms }))
  });

  // Group latencies by day
  messages
    .filter((m) => m.latency_ms && m.role === 'assistant')
    .forEach((msg) => {
      const date = new Date(msg.created_at).toISOString().split('T')[0];
      if (!dayMap[date]) {
        dayMap[date] = [];
      }
      dayMap[date].push(msg.latency_ms as number);
    });

  const SLA_THRESHOLD_MS = typeof slaThresholdMs === 'number' && slaThresholdMs > 0 ? slaThresholdMs : 2000;

  // Calculate stats for each day
  const results = Object.entries(dayMap)
    .map(([date, latencies]) => {
      const sampleSize = latencies.length;
      const sorted = [...latencies].sort((a, b) => a - b);
      const avg = sorted.reduce((sum: number, l: number) => sum + l, 0) / sampleSize;
      const min = sorted[0];
      const max = sorted[sorted.length - 1];

      const p50 = computePercentile(sorted, 50);
      const p90 = computePercentile(sorted, 90);
      const p95 = computePercentile(sorted, 95);
      const p99 = computePercentile(sorted, 99);

      const breaches = sorted.filter((l) => l > SLA_THRESHOLD_MS).length;
      const slaBreachRate = sampleSize > 0 ? (breaches / sampleSize) * 100 : 0;

      return {
        date,
        avgLatency: Math.round(avg),
        minLatency: min,
        maxLatency: max,
        p50,
        p90,
        p95,
        p99,
        slaBreachRate: Math.round(slaBreachRate * 100) / 100,
        sampleSize,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // DEBUG
  console.log('[Analytics] Response time percentiles summary', {
    days: results.length,
    slaThresholdMs: SLA_THRESHOLD_MS,
    avgSamplesPerDay: results.length ? Math.round(results.reduce((s, r) => s + r.sampleSize, 0) / results.length) : 0,
  });

  return results;
}

// Per-model aggregation function
function aggregateByModel(
  messages: AnalyticsMessage[],
  evaluations: AnalyticsEvaluation[],
  llmModels: LLMModelRow[],
  priceBook?: PriceBook
): ModelPerformanceMetrics[] {
  console.log('[Analytics] Aggregating by model:', {
    messageCount: messages.length,
    evaluationCount: evaluations.length
  });

  // Group messages by model
  const messagesByModel = messages
    .filter(m => m.role === 'assistant' && m.model_id)
    .reduce((acc: Record<string, AnalyticsMessage[]>, msg) => {
      const modelId = msg.model_id as string;
      if (!acc[modelId]) {
        acc[modelId] = [];
      }
      acc[modelId].push(msg);
      return acc;
    }, {} as Record<string, AnalyticsMessage[]>);

  // Calculate metrics for each model
  const modelMetrics: ModelPerformanceMetrics[] = [];

  for (const [modelId, msgs] of Object.entries(messagesByModel)) {
    // Get evaluations for this model's messages
    const msgIds = new Set(msgs.map(m => m.id));
    const modelEvals = evaluations.filter(e => msgIds.has(e.message_id));

    // Basic counts
    const totalMessages = msgs.length;

    // Token calculations
    const totalTokensIn = msgs.reduce((sum, m) => sum + (m.input_tokens || 0), 0);
    const totalTokensOut = msgs.reduce((sum, m) => sum + (m.output_tokens || 0), 0);
    const avgInputTokens = totalMessages > 0 ? totalTokensIn / totalMessages : 0;
    const avgOutputTokens = totalMessages > 0 ? totalTokensOut / totalMessages : 0;

    // Cost calculation using configurable pricing (model/provider/default)
    const totalCost = msgs.reduce((sum, m) => {
      const rate = resolvePricingRate(m, priceBook);
      const inTok = m.input_tokens || 0;
      const outTok = m.output_tokens || 0;
      return sum + (inTok / 1000) * rate.inputPer1K + (outTok / 1000) * rate.outputPer1K;
    }, 0);
    const costPerMessage = totalMessages > 0 ? totalCost / totalMessages : 0;

    // Quality metrics
    const avgRating = modelEvals.length > 0
      ? modelEvals.reduce((sum, e) => sum + (e.rating || 0), 0) / modelEvals.length
      : 0;

    const successCount = modelEvals.filter(e => e.success).length;
    const successRate = modelEvals.length > 0
      ? (successCount / modelEvals.length) * 100
      : 0;

    const errorCount = msgs.filter(m => m.error_type).length;
    const errorRate = totalMessages > 0
      ? (errorCount / totalMessages) * 100
      : 0;

    // Response time
    const latencies = msgs
      .filter(m => m.latency_ms)
      .map(m => m.latency_ms as number);
    const avgResponseTime = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;

    // Unique conversations
    const uniqueConversations = new Set(
      msgs.map(m => m.conversation_id).filter(Boolean)
    ).size;

    // Extract provider from first message (they should all be the same)
    const provider = msgs[0]?.provider || null;

    // Look up model details from llm_models table
    // Note: modelId here is the UUID (FK to llm_models.id), not the model_id string
    const llmModel = llmModels?.find(m => m.id === modelId);

    // Fallback priority: name > model_id > "Unknown Model (provider)" > UUID
    // Use || operator to ensure we skip empty strings and get first truthy value
    const modelName = llmModel?.name || llmModel?.model_id || (provider ? `Unknown Model (${provider})` : modelId);

    const baseModel = llmModel?.base_model || null;
    const trainingMethod = llmModel?.training_method || null;

    modelMetrics.push({
      modelId,
      modelName,
      provider,
      baseModel,
      trainingMethod,
      avgRating,
      successRate,
      errorRate,
      avgInputTokens,
      avgOutputTokens,
      avgResponseTime,
      costPerMessage,
      totalMessages,
      totalConversations: uniqueConversations,
      evaluationCount: modelEvals.length,
      trainingMetrics: null
    });
  }

  // Sort by message count (most used first)
  modelMetrics.sort((a, b) => b.totalMessages - a.totalMessages);

  console.log('[Analytics] Model metrics calculated:', {
    modelCount: modelMetrics.length,
    topModel: modelMetrics[0]?.modelName
  });

  return modelMetrics;
}

// Per-session aggregation function for A/B testing
function aggregateBySession(
  conversations: AnalyticsConversation[],
  messages: AnalyticsMessage[],
  evaluations: AnalyticsEvaluation[],
  priceBook?: PriceBook
): SessionMetrics[] {
  console.log('[Analytics] Aggregating by session:', {
    conversationCount: conversations.length,
    messageCount: messages.length,
    evaluationCount: evaluations.length
  });

  // Filter only conversations with session_id
  const sessionsWithId = conversations.filter(c => c.session_id);

  if (sessionsWithId.length === 0) {
    console.log('[Analytics] No sessions with session_id found');
    return [];
  }

  // Group conversations by session_id
  const convBySession = sessionsWithId.reduce((acc: Record<string, AnalyticsConversation[]>, conv) => {
    const sessionId = conv.session_id as string;
    if (!acc[sessionId]) {
      acc[sessionId] = [];
    }
    acc[sessionId].push(conv);
    return acc;
  }, {} as Record<string, AnalyticsConversation[]>);

  // Calculate metrics for each session
  const sessionMetrics: SessionMetrics[] = [];

  for (const [sessionId, convs] of Object.entries(convBySession)) {
    // Get conversation IDs for this session
    const convIds = new Set(convs.map(c => c.id));

    // Get all messages for this session's conversations
    const sessionMessages = messages.filter(
      m => m.conversation_id && convIds.has(m.conversation_id)
    );

    // Get evaluations for this session's messages
    const msgIds = new Set(sessionMessages.map(m => m.id));
    const sessionEvals = evaluations.filter(e => msgIds.has(e.message_id));

    // Extract experiment name (use first conversation's value)
    const experimentName = convs[0]?.experiment_name || null;

    // Basic counts
    const totalConversations = convs.length;
    const totalMessages = sessionMessages.filter(m => m.role === 'assistant').length;

    // Token calculations
    const assistantMsgs = sessionMessages.filter(m => m.role === 'assistant');
    const totalTokensIn = assistantMsgs.reduce((sum, m) => sum + (m.input_tokens || 0), 0);
    const totalTokensOut = assistantMsgs.reduce((sum, m) => sum + (m.output_tokens || 0), 0);
    const avgInputTokens = totalMessages > 0 ? totalTokensIn / totalMessages : 0;
    const avgOutputTokens = totalMessages > 0 ? totalTokensOut / totalMessages : 0;

    // Cost calculation using configurable pricing (model/provider/default)
    const totalCost = assistantMsgs.reduce((sum, m) => {
      const rate = resolvePricingRate(m, priceBook);
      const inTok = m.input_tokens || 0;
      const outTok = m.output_tokens || 0;
      return sum + (inTok / 1000) * rate.inputPer1K + (outTok / 1000) * rate.outputPer1K;
    }, 0);

    // Quality metrics
    const avgRating = sessionEvals.length > 0
      ? sessionEvals.reduce((sum, e) => sum + (e.rating || 0), 0) / sessionEvals.length
      : 0;
    const successCount = sessionEvals.filter(e => e.success).length;
    const successRate = sessionEvals.length > 0
      ? (successCount / sessionEvals.length) * 100
      : 0;
    const errorCount = assistantMsgs.filter(m => m.error_type).length;
    const errorRate = totalMessages > 0
      ? (errorCount / totalMessages) * 100
      : 0;

    // Response time
    const latencies = assistantMsgs
      .filter(m => m.latency_ms)
      .map(m => m.latency_ms as number);
    const avgResponseTime = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;

    // Timestamp info
    const timestamps = convs.map(c => new Date(c.created_at).getTime());
    const firstConversation = new Date(Math.min(...timestamps)).toISOString();
    const lastConversation = new Date(Math.max(...timestamps)).toISOString();

    sessionMetrics.push({
      sessionId,
      experimentName,
      totalConversations,
      totalMessages,
      avgRating,
      successRate,
      errorRate,
      successCount,
      avgInputTokens,
      avgOutputTokens,
      avgResponseTime,
      totalCost,
      evaluationCount: sessionEvals.length,
      firstConversation,
      lastConversation
    });
  }

  console.log('[Analytics] Session metrics calculated:', {
    sessionCount: sessionMetrics.length
  });

  return sessionMetrics;
}

// Training effectiveness aggregation function
function aggregateTrainingEffectiveness(
  messages: AnalyticsMessage[],
  evaluations: AnalyticsEvaluation[],
  llmModels: LLMModelRow[],
  priceBook?: PriceBook
): TrainingEffectivenessMetrics[] {
  console.log('[Analytics] Aggregating training effectiveness:', {
    messageCount: messages.length,
    evaluationCount: evaluations.length,
    llmModelCount: llmModels.length
  });

  // Create a map of id (UUID) -> llm_model for quick lookup
  // Note: messages.model_id contains UUIDs (FK to llm_models.id), not the model_id string
  const modelMap = new Map<string, LLMModelRow>();
  llmModels.forEach(m => {
    modelMap.set(m.id, m);  // Use UUID (id), not model_id string
  });

  // Group messages by training_method
  const messagesByTraining: Record<string, AnalyticsMessage[]> = {};

  messages
    .filter(m => m.role === 'assistant' && m.model_id)
    .forEach(msg => {
      const llmModel = modelMap.get(msg.model_id as string);
      const trainingMethod = llmModel?.training_method || 'base';

      if (!messagesByTraining[trainingMethod]) {
        messagesByTraining[trainingMethod] = [];
      }
      messagesByTraining[trainingMethod].push({
        ...msg
      });
    });

  // Calculate metrics for each training method
  const trainingMetrics: TrainingEffectivenessMetrics[] = [];

  for (const [trainingMethod, msgs] of Object.entries(messagesByTraining)) {
    // Get evaluations for these messages
    const msgIds = new Set(msgs.map(m => m.id));
    const methodEvals = evaluations.filter(e => msgIds.has(e.message_id));

    // Basic counts
    const totalMessages = msgs.length;

    // Get unique models in this training method
    const uniqueModels = new Map<string, LLMModelRow | undefined>();
    msgs.forEach(m => {
      if (m.model_id && !uniqueModels.has(m.model_id)) {
        uniqueModels.set(m.model_id, modelMap.get(m.model_id));
      }
    });

    // Token calculations
    const totalTokensIn = msgs.reduce((sum, m) => sum + (m.input_tokens || 0), 0);
    const totalTokensOut = msgs.reduce((sum, m) => sum + (m.output_tokens || 0), 0);
    const avgInputTokens = totalMessages > 0 ? totalTokensIn / totalMessages : 0;
    const avgOutputTokens = totalMessages > 0 ? totalTokensOut / totalMessages : 0;

    // Cost calculation using configurable pricing (model/provider/default)
    const totalCost = msgs.reduce((sum, m) => {
      const rate = resolvePricingRate(m, priceBook);
      const inTok = m.input_tokens || 0;
      const outTok = m.output_tokens || 0;
      return sum + (inTok / 1000) * rate.inputPer1K + (outTok / 1000) * rate.outputPer1K;
    }, 0);
    const avgCostPerMessage = totalMessages > 0 ? totalCost / totalMessages : 0;

    // Quality metrics
    const avgRating = methodEvals.length > 0
      ? methodEvals.reduce((sum, e) => sum + (e.rating || 0), 0) / methodEvals.length
      : 0;

    const successCount = methodEvals.filter(e => e.success).length;
    const successRate = methodEvals.length > 0
      ? (successCount / methodEvals.length) * 100
      : 0;

    const errorCount = msgs.filter(m => m.error_type).length;
    const errorRate = totalMessages > 0
      ? (errorCount / totalMessages) * 100
      : 0;

    // Response time
    const latencies = msgs
      .filter(m => m.latency_ms)
      .map(m => m.latency_ms as number);
    const avgResponseTime = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;

    // Build model details for this training method
    const modelDetails: Array<{
      modelId: string;
      modelName: string;
      baseModel: string | null;
      avgRating: number;
      successRate: number;
    }> = [];

    uniqueModels.forEach((llmModel, modelId) => {
      const modelMsgs = msgs.filter(m => m.model_id === modelId);
      const modelMsgIds = new Set(modelMsgs.map(m => m.id));
      const modelEvals = evaluations.filter(e => modelMsgIds.has(e.message_id));

      const modelAvgRating = modelEvals.length > 0
        ? modelEvals.reduce((sum, e) => sum + (e.rating || 0), 0) / modelEvals.length
        : 0;

      const modelSuccessCount = modelEvals.filter(e => e.success).length;
      const modelSuccessRate = modelEvals.length > 0
        ? (modelSuccessCount / modelEvals.length) * 100
        : 0;

      modelDetails.push({
        modelId,
        modelName: llmModel?.name || llmModel?.model_id || modelId,  // Enhanced fallback: name → model_id → UUID
        baseModel: llmModel?.base_model || null,
        avgRating: modelAvgRating,
        successRate: modelSuccessRate
      });
    });

    trainingMetrics.push({
      trainingMethod,
      modelCount: uniqueModels.size,
      avgRating,
      successRate,
      errorRate,
      avgInputTokens,
      avgOutputTokens,
      avgResponseTime,
      avgCostPerMessage,
      totalMessages,
      evaluationCount: methodEvals.length,
      models: modelDetails
    });
  }

  // Sort by training method (base, sft, dpo, rlhf, others)
  const methodOrder: Record<string, number> = { 'base': 0, 'sft': 1, 'dpo': 2, 'rlhf': 3 };
  trainingMetrics.sort((a, b) => {
    const aOrder = methodOrder[a.trainingMethod as keyof typeof methodOrder] ?? 999;
    const bOrder = methodOrder[b.trainingMethod as keyof typeof methodOrder] ?? 999;
    return aOrder - bOrder;
  });

  console.log('[Analytics] Training effectiveness calculated:', {
    methodCount: trainingMetrics.length,
    methods: trainingMetrics.map(m => m.trainingMethod)
  });

  return trainingMetrics;
}
