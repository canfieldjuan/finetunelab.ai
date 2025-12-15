/**
 * Demo Data Service
 * High-level service for demo functionality
 * Date: December 15, 2025
 */

import * as queries from './queries';
import type {
  DemoTestSuite,
  DemoBatchTestRun,
  DemoComparison,
  DemoAnalyticsData,
  TaskDomain,
  ComparisonRating,
  PreferenceChoice,
  DisplayOrder,
  DemoBatchTestConfig,
  StartDemoTestRequest,
  StartDemoTestResponse,
} from './types';

// ============================================================================
// Test Suite Operations
// ============================================================================

/**
 * Get available test suites for demo
 */
export async function getAvailableTestSuites(taskDomain?: TaskDomain): Promise<DemoTestSuite[]> {
  return queries.getDemoTestSuites({ taskDomain, isActive: true });
}

/**
 * Get a specific test suite by ID
 */
export async function getTestSuite(id: string): Promise<DemoTestSuite | null> {
  return queries.getDemoTestSuite(id);
}

/**
 * Get task domains with their suite counts
 */
export async function getTaskDomainSummary(): Promise<Array<{
  domain: TaskDomain;
  displayName: string;
  description: string;
  suiteCount: number;
}>> {
  const suites = await queries.getDemoTestSuites({ isActive: true });

  const domains: Record<TaskDomain, { count: number }> = {
    customer_support: { count: 0 },
    code_generation: { count: 0 },
    qa: { count: 0 },
    creative: { count: 0 },
  };

  suites.forEach((suite) => {
    if (domains[suite.task_domain]) {
      domains[suite.task_domain].count++;
    }
  });

  const domainInfo: Record<TaskDomain, { displayName: string; description: string }> = {
    customer_support: {
      displayName: 'Customer Support',
      description: 'Handle support tickets, answer questions, resolve issues',
    },
    code_generation: {
      displayName: 'Code Generation',
      description: 'Write code, debug issues, explain algorithms',
    },
    qa: {
      displayName: 'Q&A / Knowledge',
      description: 'Answer factual questions, explain concepts',
    },
    creative: {
      displayName: 'Creative Writing',
      description: 'Write stories, marketing copy, creative content',
    },
  };

  return (Object.keys(domains) as TaskDomain[]).map((domain) => ({
    domain,
    displayName: domainInfo[domain].displayName,
    description: domainInfo[domain].description,
    suiteCount: domains[domain].count,
  }));
}

// ============================================================================
// Batch Test Operations
// ============================================================================

/**
 * Start a new demo comparison test
 */
export async function startDemoComparisonTest(
  request: StartDemoTestRequest
): Promise<StartDemoTestResponse | null> {
  // Get test suite
  const testSuite = await queries.getDemoTestSuite(request.test_suite_id);
  if (!testSuite) {
    console.error('[DemoDataService] Test suite not found:', request.test_suite_id);
    return null;
  }

  // Limit prompts
  const promptLimit = Math.min(request.prompt_limit || 10, testSuite.prompt_count, 15);

  // Create batch test run config
  const config: DemoBatchTestConfig = {
    model_id: request.model_a_id,
    model_name: request.model_a_id, // Will be resolved later
    test_suite_id: request.test_suite_id,
    test_suite_name: testSuite.name,
    prompt_limit: promptLimit,
    comparison_model_id: request.model_b_id,
    comparison_model_name: request.model_b_id,
    is_comparison_test: true,
    custom_name: `Demo: ${testSuite.name} (${request.model_a_id} vs ${request.model_b_id})`,
  };

  // Create batch test run
  const testRun = await queries.createDemoBatchTestRun({
    modelName: `${request.model_a_id} vs ${request.model_b_id}`,
    config,
    totalPrompts: promptLimit,
    demoUserId: request.demo_user_id,
  });

  if (!testRun) {
    return null;
  }

  // Create comparison records for each prompt (responses will be filled in later)
  const prompts = testSuite.prompts.slice(0, promptLimit);

  for (const promptObj of prompts) {
    // Randomize display order for blind comparison
    const displayOrder: DisplayOrder = Math.random() > 0.5 ? 'ab' : 'ba';

    await queries.createDemoComparison({
      testRunId: testRun.id,
      prompt: promptObj.prompt,
      modelAId: request.model_a_id,
      modelBId: request.model_b_id,
      displayOrder,
      demoUserId: request.demo_user_id,
    });
  }

  // Update status to running
  await queries.updateDemoBatchTestRun(testRun.id, { status: 'running' });

  return {
    test_run_id: testRun.id,
    status: 'running',
    total_prompts: promptLimit,
  };
}

/**
 * Get current test run status
 */
export async function getTestRunStatus(testRunId: string): Promise<DemoBatchTestRun | null> {
  return queries.getDemoBatchTestRun(testRunId);
}

/**
 * Get comparisons for a test run
 */
export async function getTestRunComparisons(testRunId: string): Promise<DemoComparison[]> {
  return queries.getDemoComparisons(testRunId);
}

/**
 * Update a comparison with responses from model calls
 */
export async function updateComparisonResponses(
  comparisonId: string,
  modelAResponse: string,
  modelALatencyMs: number,
  modelBResponse: string,
  modelBLatencyMs: number
): Promise<boolean> {
  // We need to update the comparison with responses
  // This is a bit awkward with the current query structure
  // Let's add a direct update
  const { supabase } = await import('@/lib/supabaseClient');

  const { error } = await supabase
    .from('demo_comparisons')
    .update({
      model_a_response: modelAResponse,
      model_a_latency_ms: modelALatencyMs,
      model_b_response: modelBResponse,
      model_b_latency_ms: modelBLatencyMs,
    })
    .eq('id', comparisonId);

  if (error) {
    console.error('[DemoDataService] Error updating comparison responses:', error);
    return false;
  }

  return true;
}

/**
 * Submit a rating for a comparison
 */
export async function submitComparisonRating(params: {
  comparisonId: string;
  preferredModel: PreferenceChoice;
  modelARating: ComparisonRating;
  modelBRating: ComparisonRating;
}): Promise<boolean> {
  return queries.updateDemoComparison(params.comparisonId, {
    preferredModel: params.preferredModel,
    modelARating: params.modelARating,
    modelBRating: params.modelBRating,
  });
}

/**
 * Reveal model identities for a comparison
 */
export async function revealComparison(comparisonId: string): Promise<boolean> {
  return queries.updateDemoComparison(comparisonId, { revealed: true });
}

/**
 * Mark test run as completed
 */
export async function completeTestRun(
  testRunId: string,
  completedPrompts: number,
  failedPrompts: number = 0
): Promise<boolean> {
  return queries.updateDemoBatchTestRun(testRunId, {
    status: 'completed',
    completedPrompts,
    failedPrompts,
    completedAt: new Date().toISOString(),
  });
}

// ============================================================================
// Analytics Operations
// ============================================================================

/**
 * Get analytics for a test run
 */
export async function getTestRunAnalytics(testRunId: string): Promise<DemoAnalyticsData | null> {
  return queries.computeDemoAnalytics(testRunId);
}

/**
 * Get sessions for analytics chat
 */
export async function getDemoSessions() {
  return queries.getDemoSessions();
}

// ============================================================================
// Model Helpers
// ============================================================================

/**
 * Get allowed models for demo
 */
export function getAllowedDemoModels(): Array<{
  id: string;
  name: string;
  provider: string;
  type: 'base' | 'tuned';
}> {
  return [
    // Base models
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', type: 'base' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', type: 'base' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', type: 'base' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'Anthropic', type: 'base' },
    // Demo "tuned" models (in reality, these could be the same or different prompting)
    { id: 'gpt-4o-mini-tuned-demo', name: 'GPT-4o Mini (Tuned)', provider: 'FineTuneLab', type: 'tuned' },
    { id: 'gpt-4o-tuned-demo', name: 'GPT-4o (Tuned)', provider: 'FineTuneLab', type: 'tuned' },
  ];
}

/**
 * Get default model pair for demo
 */
export function getDefaultModelPair(): { baseModel: string; tunedModel: string } {
  return {
    baseModel: 'gpt-4o-mini',
    tunedModel: 'gpt-4o-mini-tuned-demo',
  };
}

// ============================================================================
// Rate Limiting
// ============================================================================

const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if a demo user has exceeded rate limits
 */
export function checkRateLimit(demoUserId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
} {
  const MAX_TESTS_PER_HOUR = 10;
  const HOUR_MS = 60 * 60 * 1000;

  const now = Date.now();
  const cached = rateLimitCache.get(demoUserId);

  if (!cached || cached.resetAt < now) {
    // Reset or initialize
    rateLimitCache.set(demoUserId, {
      count: 1,
      resetAt: now + HOUR_MS,
    });
    return {
      allowed: true,
      remaining: MAX_TESTS_PER_HOUR - 1,
      resetAt: new Date(now + HOUR_MS),
    };
  }

  if (cached.count >= MAX_TESTS_PER_HOUR) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(cached.resetAt),
    };
  }

  cached.count++;
  return {
    allowed: true,
    remaining: MAX_TESTS_PER_HOUR - cached.count,
    resetAt: new Date(cached.resetAt),
  };
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up old demo data
 */
export async function cleanupDemoData(): Promise<number> {
  return queries.cleanupOldDemoData();
}
