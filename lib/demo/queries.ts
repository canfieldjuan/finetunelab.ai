/**
 * Demo Queries Service
 * Database operations for demo functionality
 * Date: December 15, 2025
 */

import { supabase } from '@/lib/supabaseClient';
import type {
  DemoConversation,
  DemoMessage,
  DemoBatchTestRun,
  DemoBatchTestResult,
  DemoBatchTestConfig,
  DemoEvaluation,
  DemoComparison,
  DemoTestSuite,
  DemoSession,
  DemoAnalyticsCache,
  DemoAnalyticsData,
  ComparisonRating,
  PreferenceChoice,
  DisplayOrder,
  TaskDomain,
} from './types';

// ============================================================================
// Demo Conversations
// ============================================================================

export async function createDemoConversation(params: {
  sessionId?: string;
  experimentName?: string;
  modelId?: string;
  title?: string;
  demoUserId?: string;
}): Promise<DemoConversation | null> {
  const { data, error } = await supabase
    .from('demo_conversations')
    .insert({
      session_id: params.sessionId,
      experiment_name: params.experimentName,
      model_id: params.modelId,
      title: params.title,
      demo_user_id: params.demoUserId || 'demo-user',
    })
    .select()
    .single();

  if (error) {
    console.error('[DemoQueries] Error creating conversation:', error);
    return null;
  }

  return data;
}

export async function getDemoConversation(id: string): Promise<DemoConversation | null> {
  const { data, error } = await supabase
    .from('demo_conversations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[DemoQueries] Error fetching conversation:', error);
    return null;
  }

  return data;
}

export async function getDemoSessions(): Promise<DemoSession[]> {
  const { data, error } = await supabase
    .from('demo_conversations')
    .select('id, session_id, experiment_name, model_id, created_at')
    .not('session_id', 'is', null)
    .not('experiment_name', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[DemoQueries] Error fetching sessions:', error);
    return [];
  }

  // Group by session_id and experiment_name
  const grouped = new Map<string, DemoSession>();

  data?.forEach((conv) => {
    const key = `${conv.session_id}-${conv.experiment_name}`;

    if (grouped.has(key)) {
      const existing = grouped.get(key)!;
      existing.conversation_count++;
      existing.conversation_ids.push(conv.id);
      if (conv.model_id && !existing.model_ids.includes(conv.model_id)) {
        existing.model_ids.push(conv.model_id);
      }
    } else {
      grouped.set(key, {
        session_id: conv.session_id!,
        experiment_name: conv.experiment_name!,
        conversation_count: 1,
        conversation_ids: [conv.id],
        model_ids: conv.model_id ? [conv.model_id] : [],
        created_at: conv.created_at,
      });
    }
  });

  return Array.from(grouped.values());
}

// ============================================================================
// Demo Messages
// ============================================================================

export async function createDemoMessage(params: {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  contentJson?: Record<string, unknown>;
  modelId?: string;
  latencyMs?: number;
  tokenCount?: number;
}): Promise<DemoMessage | null> {
  const { data, error } = await supabase
    .from('demo_messages')
    .insert({
      conversation_id: params.conversationId,
      role: params.role,
      content: params.content,
      content_json: params.contentJson,
      model_id: params.modelId,
      latency_ms: params.latencyMs,
      token_count: params.tokenCount,
    })
    .select()
    .single();

  if (error) {
    console.error('[DemoQueries] Error creating message:', error);
    return null;
  }

  return data;
}

export async function getDemoMessages(conversationId: string): Promise<DemoMessage[]> {
  const { data, error } = await supabase
    .from('demo_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[DemoQueries] Error fetching messages:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// Demo Batch Test Runs
// ============================================================================

export async function createDemoBatchTestRun(params: {
  modelName: string;
  config: DemoBatchTestConfig;
  totalPrompts: number;
  demoUserId?: string;
}): Promise<DemoBatchTestRun | null> {
  const { data, error } = await supabase
    .from('demo_batch_test_runs')
    .insert({
      model_name: params.modelName,
      config: params.config,
      total_prompts: params.totalPrompts,
      demo_user_id: params.demoUserId || 'demo-user',
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[DemoQueries] Error creating batch test run:', error);
    return null;
  }

  return data;
}

export async function getDemoBatchTestRun(id: string): Promise<DemoBatchTestRun | null> {
  const { data, error } = await supabase
    .from('demo_batch_test_runs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[DemoQueries] Error fetching batch test run:', error);
    return null;
  }

  return data;
}

export async function updateDemoBatchTestRun(
  id: string,
  updates: Partial<{
    status: string;
    completedPrompts: number;
    failedPrompts: number;
    completedAt: string;
    error: string;
  }>
): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.completedPrompts !== undefined) updateData.completed_prompts = updates.completedPrompts;
  if (updates.failedPrompts !== undefined) updateData.failed_prompts = updates.failedPrompts;
  if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;
  if (updates.error !== undefined) updateData.error = updates.error;

  const { error } = await supabase
    .from('demo_batch_test_runs')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('[DemoQueries] Error updating batch test run:', error);
    return false;
  }

  return true;
}

export async function getDemoBatchTestRuns(params?: {
  status?: string;
  limit?: number;
}): Promise<DemoBatchTestRun[]> {
  let query = supabase
    .from('demo_batch_test_runs')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: false });

  if (params?.status) {
    query = query.eq('status', params.status);
  }

  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[DemoQueries] Error fetching batch test runs:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// Demo Batch Test Results
// ============================================================================

export async function createDemoBatchTestResult(params: {
  testRunId: string;
  prompt: string;
  response?: string;
  latencyMs?: number;
  success: boolean;
  error?: string;
  modelId?: string;
}): Promise<DemoBatchTestResult | null> {
  const { data, error } = await supabase
    .from('demo_batch_test_results')
    .insert({
      test_run_id: params.testRunId,
      prompt: params.prompt,
      response: params.response,
      latency_ms: params.latencyMs,
      success: params.success,
      error: params.error,
      model_id: params.modelId,
    })
    .select()
    .single();

  if (error) {
    console.error('[DemoQueries] Error creating batch test result:', error);
    return null;
  }

  return data;
}

export async function getDemoBatchTestResults(testRunId: string): Promise<DemoBatchTestResult[]> {
  const { data, error } = await supabase
    .from('demo_batch_test_results')
    .select('*')
    .eq('test_run_id', testRunId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[DemoQueries] Error fetching batch test results:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// Demo Evaluations
// ============================================================================

export async function createDemoEvaluation(params: {
  messageId: string;
  rating: number;
  success?: boolean;
  failureTags?: string[];
  notes?: string;
  expectedBehavior?: string;
  demoUserId?: string;
}): Promise<DemoEvaluation | null> {
  const { data, error } = await supabase
    .from('demo_evaluations')
    .insert({
      message_id: params.messageId,
      rating: params.rating,
      success: params.success ?? true,
      failure_tags: params.failureTags,
      notes: params.notes,
      expected_behavior: params.expectedBehavior,
      demo_user_id: params.demoUserId || 'demo-user',
    })
    .select()
    .single();

  if (error) {
    console.error('[DemoQueries] Error creating evaluation:', error);
    return null;
  }

  return data;
}

export async function getDemoEvaluations(messageIds: string[]): Promise<DemoEvaluation[]> {
  const { data, error } = await supabase
    .from('demo_evaluations')
    .select('*')
    .in('message_id', messageIds);

  if (error) {
    console.error('[DemoQueries] Error fetching evaluations:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// Demo Comparisons (A/B Testing)
// ============================================================================

export async function createDemoComparison(params: {
  testRunId?: string;
  prompt: string;
  modelAId: string;
  modelAName?: string;
  modelAResponse?: string;
  modelALatencyMs?: number;
  modelBId: string;
  modelBName?: string;
  modelBResponse?: string;
  modelBLatencyMs?: number;
  displayOrder: DisplayOrder;
  demoUserId?: string;
}): Promise<DemoComparison | null> {
  const { data, error } = await supabase
    .from('demo_comparisons')
    .insert({
      test_run_id: params.testRunId,
      prompt: params.prompt,
      model_a_id: params.modelAId,
      model_a_name: params.modelAName,
      model_a_response: params.modelAResponse,
      model_a_latency_ms: params.modelALatencyMs,
      model_b_id: params.modelBId,
      model_b_name: params.modelBName,
      model_b_response: params.modelBResponse,
      model_b_latency_ms: params.modelBLatencyMs,
      display_order: params.displayOrder,
      preferred_model: null,
      revealed: false,
      demo_user_id: params.demoUserId || 'demo-user',
    })
    .select()
    .single();

  if (error) {
    console.error('[DemoQueries] Error creating comparison:', error);
    return null;
  }

  return data;
}

export async function updateDemoComparison(
  id: string,
  updates: {
    preferredModel?: PreferenceChoice;
    modelARating?: ComparisonRating;
    modelBRating?: ComparisonRating;
    revealed?: boolean;
  }
): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  if (updates.preferredModel !== undefined) updateData.preferred_model = updates.preferredModel;
  if (updates.modelARating !== undefined) updateData.model_a_rating = updates.modelARating;
  if (updates.modelBRating !== undefined) updateData.model_b_rating = updates.modelBRating;
  if (updates.revealed !== undefined) updateData.revealed = updates.revealed;

  const { error } = await supabase
    .from('demo_comparisons')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('[DemoQueries] Error updating comparison:', error);
    return false;
  }

  return true;
}

export async function getDemoComparisons(testRunId: string): Promise<DemoComparison[]> {
  const { data, error } = await supabase
    .from('demo_comparisons')
    .select('*')
    .eq('test_run_id', testRunId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[DemoQueries] Error fetching comparisons:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// Demo Test Suites
// ============================================================================

export async function getDemoTestSuites(params?: {
  taskDomain?: TaskDomain;
  isActive?: boolean;
}): Promise<DemoTestSuite[]> {
  let query = supabase
    .from('demo_test_suites')
    .select('*')
    .order('task_domain', { ascending: true });

  if (params?.taskDomain) {
    query = query.eq('task_domain', params.taskDomain);
  }

  if (params?.isActive !== undefined) {
    query = query.eq('is_active', params.isActive);
  } else {
    // Default to active only
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[DemoQueries] Error fetching test suites:', error);
    return [];
  }

  return data || [];
}

export async function getDemoTestSuite(id: string): Promise<DemoTestSuite | null> {
  const { data, error } = await supabase
    .from('demo_test_suites')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[DemoQueries] Error fetching test suite:', error);
    return null;
  }

  return data;
}

// ============================================================================
// Demo Analytics Cache
// ============================================================================

export async function getDemoAnalyticsCache(cacheKey: string): Promise<DemoAnalyticsData | null> {
  const { data, error } = await supabase
    .from('demo_analytics_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error) {
    // Cache miss is not an error
    return null;
  }

  return data?.analytics_data || null;
}

export async function setDemoAnalyticsCache(params: {
  cacheKey: string;
  testRunId?: string;
  analyticsData: DemoAnalyticsData;
  ttlMinutes?: number;
}): Promise<boolean> {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + (params.ttlMinutes || 60));

  const { error } = await supabase
    .from('demo_analytics_cache')
    .upsert({
      cache_key: params.cacheKey,
      test_run_id: params.testRunId,
      analytics_data: params.analyticsData,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    console.error('[DemoQueries] Error setting analytics cache:', error);
    return false;
  }

  return true;
}

// ============================================================================
// Demo Analytics Computation
// ============================================================================

export async function computeDemoAnalytics(testRunId: string): Promise<DemoAnalyticsData | null> {
  // Check cache first
  const cacheKey = `demo-analytics-${testRunId}`;
  const cached = await getDemoAnalyticsCache(cacheKey);
  if (cached) {
    return cached;
  }

  // Get test run
  const testRun = await getDemoBatchTestRun(testRunId);
  if (!testRun) {
    return null;
  }

  // Get comparisons
  const comparisons = await getDemoComparisons(testRunId);

  // Compute analytics
  const totalPrompts = testRun.total_prompts;
  const completedPrompts = testRun.completed_prompts;
  const failedPrompts = testRun.failed_prompts;

  // Rating distribution
  const ratingCounts = new Map<number, number>();
  comparisons.forEach((c) => {
    if (c.model_a_rating?.overall) {
      const current = ratingCounts.get(c.model_a_rating.overall) || 0;
      ratingCounts.set(c.model_a_rating.overall, current + 1);
    }
    if (c.model_b_rating?.overall) {
      const current = ratingCounts.get(c.model_b_rating.overall) || 0;
      ratingCounts.set(c.model_b_rating.overall, current + 1);
    }
  });

  const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: ratingCounts.get(rating) || 0,
  }));

  // Latency stats
  const latencies: number[] = [];
  comparisons.forEach((c) => {
    if (c.model_a_latency_ms) latencies.push(c.model_a_latency_ms);
    if (c.model_b_latency_ms) latencies.push(c.model_b_latency_ms);
  });

  const avgLatency = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0;

  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedLatencies.length * 0.95);
  const p95Latency = sortedLatencies[p95Index] || avgLatency;

  // Model comparison stats
  let modelAWins = 0;
  let modelBWins = 0;
  let ties = 0;

  const modelALatencies: number[] = [];
  const modelBLatencies: number[] = [];
  const modelARatings: number[] = [];
  const modelBRatings: number[] = [];

  comparisons.forEach((c) => {
    if (c.preferred_model === 'a') modelAWins++;
    else if (c.preferred_model === 'b') modelBWins++;
    else if (c.preferred_model === 'tie') ties++;

    if (c.model_a_latency_ms) modelALatencies.push(c.model_a_latency_ms);
    if (c.model_b_latency_ms) modelBLatencies.push(c.model_b_latency_ms);
    if (c.model_a_rating?.overall) modelARatings.push(c.model_a_rating.overall);
    if (c.model_b_rating?.overall) modelBRatings.push(c.model_b_rating.overall);
  });

  const config = testRun.config as DemoBatchTestConfig;

  const analyticsData: DemoAnalyticsData = {
    summary: {
      total_prompts: totalPrompts,
      completed_prompts: completedPrompts,
      failed_prompts: failedPrompts,
      success_rate: totalPrompts > 0 ? (completedPrompts / totalPrompts) * 100 : 0,
      avg_latency_ms: avgLatency,
      p95_latency_ms: p95Latency,
    },
    model_comparison: config.is_comparison_test ? {
      model_a: {
        model_id: config.model_id,
        model_name: config.model_name || config.model_id,
        avg_rating: modelARatings.length > 0
          ? modelARatings.reduce((a, b) => a + b, 0) / modelARatings.length
          : 0,
        avg_latency_ms: modelALatencies.length > 0
          ? modelALatencies.reduce((a, b) => a + b, 0) / modelALatencies.length
          : 0,
        success_rate: 100, // All completed in demo
        total_responses: modelARatings.length,
      },
      model_b: {
        model_id: config.comparison_model_id || '',
        model_name: config.comparison_model_name || config.comparison_model_id || '',
        avg_rating: modelBRatings.length > 0
          ? modelBRatings.reduce((a, b) => a + b, 0) / modelBRatings.length
          : 0,
        avg_latency_ms: modelBLatencies.length > 0
          ? modelBLatencies.reduce((a, b) => a + b, 0) / modelBLatencies.length
          : 0,
        success_rate: 100,
        total_responses: modelBRatings.length,
      },
      preference_breakdown: {
        model_a_wins: modelAWins,
        model_b_wins: modelBWins,
        ties,
      },
    } : undefined,
    rating_distribution: ratingDistribution,
    latency_distribution: [
      { bucket: '0-500ms', count: latencies.filter((l) => l <= 500).length },
      { bucket: '500-1000ms', count: latencies.filter((l) => l > 500 && l <= 1000).length },
      { bucket: '1-2s', count: latencies.filter((l) => l > 1000 && l <= 2000).length },
      { bucket: '2-5s', count: latencies.filter((l) => l > 2000 && l <= 5000).length },
      { bucket: '>5s', count: latencies.filter((l) => l > 5000).length },
    ],
  };

  // Cache the results
  await setDemoAnalyticsCache({
    cacheKey,
    testRunId,
    analyticsData,
    ttlMinutes: 30,
  });

  return analyticsData;
}

// ============================================================================
// Cleanup
// ============================================================================

export async function cleanupOldDemoData(): Promise<number> {
  // Call the cleanup function we created in the migration
  const { data, error } = await supabase.rpc('cleanup_old_demo_data');

  if (error) {
    console.error('[DemoQueries] Error cleaning up demo data:', error);
    return 0;
  }

  return data || 0;
}
