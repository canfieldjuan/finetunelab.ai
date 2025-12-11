/**
 * Cohort Criteria Evaluator
 *
 * Evaluates complex user criteria for dynamic cohort assignment.
 * Supports AND/OR/NOT logical operators and multiple condition types.
 *
 * Phase 3.1: User Cohort Backend
 * Date: 2025-10-25
 */

import { createClient } from '@/lib/supabase/client';
import type { CohortCriteria } from './cohort.service';

// ==================== Type Definitions ====================

export interface UserMetrics {
  user_id: string;
  signup_date: Date;
  subscription_plan?: string;
  total_conversations: number;
  last_active: Date;
  average_rating: number;
  success_rate: number;
  total_cost: number;
  total_tokens: number;
  feature_usage: Record<string, number>;
  custom_fields: Record<string, unknown>;
}

// ==================== Main Evaluation Function ====================

/**
 * Evaluate if a user matches the given criteria
 */
export async function evaluateCriteria(
  userId: string,
  criteria: CohortCriteria
): Promise<boolean> {
  console.log('[CohortCriteriaEvaluator] Evaluating criteria for user:', userId);

  try {
    const userMetrics = await fetchUserMetrics(userId);
    if (!userMetrics) {
      console.log('[CohortCriteriaEvaluator] User metrics not found');
      return false;
    }

    const result = await evaluateCriteriaObject(userMetrics, criteria);
    console.log('[CohortCriteriaEvaluator] Evaluation result:', result);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Evaluation failed';
    console.error('[CohortCriteriaEvaluator] Error:', errorMsg);
    return false;
  }
}

/**
 * Evaluate criteria object (handles logical operators)
 */
async function evaluateCriteriaObject(
  metrics: UserMetrics,
  criteria: CohortCriteria
): Promise<boolean> {
  if (criteria.AND) {
    return evaluateAND(metrics, criteria.AND);
  }

  if (criteria.OR) {
    return evaluateOR(metrics, criteria.OR);
  }

  if (criteria.NOT) {
    const result = await evaluateCriteriaObject(metrics, criteria.NOT);
    return !result;
  }

  return evaluateConditions(metrics, criteria);
}

// ==================== Logical Operators ====================

/**
 * Evaluate AND operator - all criteria must match
 */
async function evaluateAND(
  metrics: UserMetrics,
  criteriaArray: CohortCriteria[]
): Promise<boolean> {
  for (const criteria of criteriaArray) {
    const result = await evaluateCriteriaObject(metrics, criteria);
    if (!result) return false;
  }
  return true;
}

/**
 * Evaluate OR operator - at least one criterion must match
 */
async function evaluateOR(
  metrics: UserMetrics,
  criteriaArray: CohortCriteria[]
): Promise<boolean> {
  for (const criteria of criteriaArray) {
    const result = await evaluateCriteriaObject(metrics, criteria);
    if (result) return true;
  }
  return false;
}

// ==================== Condition Evaluation ====================

/**
 * Evaluate all conditions in a criteria object
 */
function evaluateConditions(metrics: UserMetrics, criteria: CohortCriteria): boolean {
  const conditions: boolean[] = [];

  if (criteria.signup_date) {
    conditions.push(evaluateSignupDate(metrics.signup_date, criteria.signup_date));
  }

  if (criteria.subscription_plan) {
    conditions.push(evaluateSubscriptionPlan(metrics.subscription_plan, criteria.subscription_plan));
  }

  if (criteria.total_conversations) {
    conditions.push(evaluateNumericCondition(metrics.total_conversations, criteria.total_conversations));
  }

  if (criteria.activity_level) {
    conditions.push(evaluateActivityLevel(metrics, criteria.activity_level));
  }

  if (criteria.last_active) {
    conditions.push(evaluateLastActive(metrics.last_active, criteria.last_active));
  }

  if (criteria.feature_usage) {
    conditions.push(evaluateFeatureUsage(metrics.feature_usage, criteria.feature_usage));
  }

  if (criteria.average_rating) {
    conditions.push(evaluateNumericCondition(metrics.average_rating, criteria.average_rating));
  }

  if (criteria.success_rate) {
    conditions.push(evaluateNumericCondition(metrics.success_rate, criteria.success_rate));
  }

  if (criteria.total_cost) {
    conditions.push(evaluateNumericCondition(metrics.total_cost, criteria.total_cost));
  }

  if (criteria.custom_fields) {
    conditions.push(evaluateCustomFields(metrics.custom_fields, criteria.custom_fields));
  }

  return conditions.every(c => c === true);
}

// ==================== Specific Condition Evaluators ====================

/**
 * Evaluate signup date condition
 */
function evaluateSignupDate(
  signupDate: Date,
  condition: { before?: Date; after?: Date; between?: [Date, Date] }
): boolean {
  const timestamp = signupDate.getTime();

  if (condition.before) {
    if (timestamp >= new Date(condition.before).getTime()) return false;
  }

  if (condition.after) {
    if (timestamp <= new Date(condition.after).getTime()) return false;
  }

  if (condition.between) {
    const [start, end] = condition.between;
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    if (timestamp < startTime || timestamp > endTime) return false;
  }

  return true;
}

/**
 * Evaluate subscription plan condition
 */
function evaluateSubscriptionPlan(
  plan: string | undefined,
  condition: { in?: string[]; not_in?: string[] }
): boolean {
  if (!plan) return false;

  if (condition.in && condition.in.length > 0) {
    if (!condition.in.includes(plan)) return false;
  }

  if (condition.not_in && condition.not_in.length > 0) {
    if (condition.not_in.includes(plan)) return false;
  }

  return true;
}

/**
 * Evaluate numeric condition (gt, lt, eq)
 */
function evaluateNumericCondition(
  value: number,
  condition: { gt?: number; lt?: number; eq?: number }
): boolean {
  if (condition.gt !== undefined) {
    if (value <= condition.gt) return false;
  }

  if (condition.lt !== undefined) {
    if (value >= condition.lt) return false;
  }

  if (condition.eq !== undefined) {
    if (value !== condition.eq) return false;
  }

  return true;
}

/**
 * Evaluate activity level based on conversation count
 */
function evaluateActivityLevel(
  metrics: UserMetrics,
  level: 'low' | 'medium' | 'high' | 'very_high'
): boolean {
  const conversationCount = metrics.total_conversations;

  switch (level) {
    case 'low':
      return conversationCount < 10;
    case 'medium':
      return conversationCount >= 10 && conversationCount < 50;
    case 'high':
      return conversationCount >= 50 && conversationCount < 200;
    case 'very_high':
      return conversationCount >= 200;
    default:
      return false;
  }
}

/**
 * Evaluate last active condition
 */
function evaluateLastActive(
  lastActive: Date,
  condition: { days_ago?: number }
): boolean {
  if (!condition.days_ago) return true;

  const daysSinceActive = Math.floor(
    (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceActive <= condition.days_ago;
}

/**
 * Evaluate feature usage condition
 */
function evaluateFeatureUsage(
  usage: Record<string, number>,
  condition: { feature: string; min_uses?: number }
): boolean {
  const featureCount = usage[condition.feature] || 0;
  const minUses = condition.min_uses || 1;

  return featureCount >= minUses;
}

/**
 * Evaluate custom fields condition
 */
function evaluateCustomFields(
  fields: Record<string, unknown>,
  condition: Record<string, unknown>
): boolean {
  for (const [key, expectedValue] of Object.entries(condition)) {
    const actualValue = fields[key];

    if (typeof expectedValue === 'object' && expectedValue !== null) {
      if (Array.isArray(expectedValue)) {
        if (!expectedValue.includes(actualValue)) return false;
      } else {
        if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) return false;
      }
    } else {
      if (actualValue !== expectedValue) return false;
    }
  }

  return true;
}

// ==================== Data Fetching ====================

/**
 * Fetch user metrics for evaluation
 */
export async function fetchUserMetrics(userId: string): Promise<UserMetrics | null> {
  console.log('[CohortCriteriaEvaluator] Fetching metrics for user:', userId);

  try {
    const supabase = createClient();

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('created_at, metadata')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.log('[CohortCriteriaEvaluator] User not found');
      return null;
    }

    const { data: conversations } = await supabase
      .from('conversations')
      .select('metadata, created_at')
      .eq('user_id', userId);

    const metrics = calculateMetrics(user, conversations || []);

    console.log('[CohortCriteriaEvaluator] Metrics fetched successfully');
    return {
      user_id: userId,
      ...metrics
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to fetch metrics';
    console.error('[CohortCriteriaEvaluator] Fetch error:', errorMsg);
    return null;
  }
}

/**
 * Calculate metrics from user and conversation data
 */
function calculateMetrics(
  user: Record<string, unknown>,
  conversations: unknown[]
): Omit<UserMetrics, 'user_id'> {
  const signupDate = new Date(user.created_at as string | number | Date);
  const metadata = (user.metadata || {}) as Record<string, unknown>;

  let totalRating = 0;
  let ratingCount = 0;
  let totalSuccess = 0;
  let successCount = 0;
  let totalCost = 0;
  let totalTokens = 0;
  let lastActive = signupDate;
  const featureUsage: Record<string, number> = {};

  for (const conv of conversations) {
    const convRecord = conv as Record<string, unknown>;
    const convMeta = (convRecord.metadata || {}) as Record<string, unknown>;
    const convDate = new Date(convRecord.created_at as string | number | Date);

    if (convDate > lastActive) {
      lastActive = convDate;
    }

    if (typeof convMeta.rating === 'number') {
      totalRating += convMeta.rating;
      ratingCount++;
    }

    if (typeof convMeta.success === 'boolean') {
      totalSuccess += convMeta.success ? 1 : 0;
      successCount++;
    }

    if (typeof convMeta.cost === 'number') {
      totalCost += convMeta.cost;
    }

    if (typeof convMeta.tokens === 'number') {
      totalTokens += convMeta.tokens;
    }

    if (Array.isArray(convMeta.features_used)) {
      for (const feature of convMeta.features_used) {
        featureUsage[feature] = (featureUsage[feature] || 0) + 1;
      }
    }
  }

  return {
    signup_date: signupDate,
    subscription_plan: metadata.subscription_plan as string | undefined,
    total_conversations: conversations.length,
    last_active: lastActive,
    average_rating: ratingCount > 0 ? totalRating / ratingCount : 0,
    success_rate: successCount > 0 ? totalSuccess / successCount : 0,
    total_cost: totalCost,
    total_tokens: totalTokens,
    feature_usage: featureUsage,
    custom_fields: (metadata.custom_fields || {}) as Record<string, unknown>
  };
}

// ==================== Batch Evaluation ====================

/**
 * Evaluate criteria for multiple users
 */
export async function evaluateBatch(
  userIds: string[],
  criteria: CohortCriteria
): Promise<Map<string, boolean>> {
  console.log('[CohortCriteriaEvaluator] Batch evaluating', userIds.length, 'users');

  const results = new Map<string, boolean>();

  for (const userId of userIds) {
    try {
      const result = await evaluateCriteria(userId, criteria);
      results.set(userId, result);
    } catch {
      console.error('[CohortCriteriaEvaluator] Error evaluating user:', userId);
      results.set(userId, false);
    }
  }

  console.log('[CohortCriteriaEvaluator] Batch evaluation complete');
  return results;
}

/**
 * Find all users matching criteria
 */
export async function findMatchingUsers(criteria: CohortCriteria): Promise<string[]> {
  console.log('[CohortCriteriaEvaluator] Finding users matching criteria');

  try {
    const supabase = createClient();

    const { data: users } = await supabase
      .from('users')
      .select('id');

    if (!users || users.length === 0) {
      console.log('[CohortCriteriaEvaluator] No users found');
      return [];
    }

    const userIds = users.map(u => u.id);
    const results = await evaluateBatch(userIds, criteria);

    const matchingUsers = Array.from(results.entries())
      .filter(([, matches]) => matches)
      .map(([userId]) => userId);

    console.log('[CohortCriteriaEvaluator] Found', matchingUsers.length, 'matching users');
    return matchingUsers;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to find matching users';
    console.error('[CohortCriteriaEvaluator] Error:', errorMsg);
    return [];
  }
}
