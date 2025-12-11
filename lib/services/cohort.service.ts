/**
 * Cohort Service
 *
 * Handles user cohort operations including CRUD, member management,
 * metrics calculation, and snapshot management.
 *
 * Phase 3.1: User Cohort Backend
 * Phase 4.1: Performance Optimization
 * Date: 2025-10-25
 */

import { createClient } from '@/lib/supabase/client';
import {
  calculatePaginationRange,
  buildPaginatedResult,
  type PaginationResult
} from '@/lib/utils/query-optimizer';

// ==================== Type Definitions ====================

export type CohortType = 'static' | 'dynamic' | 'behavioral' | 'subscription' | 'custom';

export interface CohortCriteria {
  signup_date?: {
    before?: Date;
    after?: Date;
    between?: [Date, Date];
  };
  subscription_plan?: {
    in?: string[];
    not_in?: string[];
  };
  total_conversations?: {
    gt?: number;
    lt?: number;
    eq?: number;
  };
  activity_level?: 'low' | 'medium' | 'high' | 'very_high';
  last_active?: {
    days_ago?: number;
  };
  feature_usage?: {
    feature: string;
    min_uses?: number;
  };
  average_rating?: {
    gt?: number;
    lt?: number;
  };
  success_rate?: {
    gt?: number;
    lt?: number;
  };
  total_cost?: {
    gt?: number;
    lt?: number;
  };
  custom_fields?: Record<string, unknown>;
  AND?: CohortCriteria[];
  OR?: CohortCriteria[];
  NOT?: CohortCriteria;
}

export interface Cohort {
  id: string;
  created_by: string;
  name: string;
  description?: string;
  cohort_type: CohortType;
  criteria?: CohortCriteria;
  member_count: number;
  last_calculated_at?: string;
  average_rating?: number;
  average_success_rate?: number;
  average_cost_per_session?: number;
  average_tokens_per_conversation?: number;
  rating_vs_baseline?: number;
  success_rate_vs_baseline?: number;
  cost_vs_baseline?: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface CohortMember {
  id: string;
  cohort_id: string;
  user_id: string;
  added_at: string;
  added_method: 'manual' | 'automatic' | 'criteria_match' | 'import';
  user_metrics_snapshot?: Record<string, unknown>;
  is_active: boolean;
  removed_at?: string;
  removal_reason?: string;
  created_at: string;
}

export interface CohortMetrics {
  cohort_id: string;
  member_count: number;
  average_rating: number;
  average_success_rate: number;
  average_cost_per_session: number;
  average_tokens_per_conversation: number;
  total_conversations: number;
  active_members: number;
}

export interface BaselineMetrics {
  average_rating: number;
  average_success_rate: number;
  average_cost_per_session: number;
  average_tokens_per_conversation: number;
}

export interface ComparisonMetrics {
  cohort_metrics: CohortMetrics;
  baseline_metrics: BaselineMetrics;
  rating_vs_baseline: number;
  success_rate_vs_baseline: number;
  cost_vs_baseline: number;
}

export interface CohortSnapshot {
  id: string;
  cohort_id: string;
  snapshot_date: string;
  snapshot_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  member_count: number;
  active_members: number;
  new_members: number;
  churned_members: number;
  average_rating: number;
  average_success_rate: number;
  average_cost_per_session?: number;
  total_conversations: number;
  total_cost: number;
  total_tokens: number;
  rating_distribution?: Record<string, number>;
  success_distribution?: Record<string, number>;
  activity_distribution?: Record<string, number>;
  key_insights?: string[];
  created_at: string;
}

// ==================== CRUD Operations ====================

/**
 * Create a new cohort
 */
export async function createCohort(cohortData: {
  name: string;
  description?: string;
  cohort_type: CohortType;
  criteria?: CohortCriteria;
}): Promise<Cohort> {
  console.log('[CohortService] Creating cohort:', cohortData.name);

  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('user_cohorts')
      .insert({
        created_by: user.id,
        name: cohortData.name,
        description: cohortData.description,
        cohort_type: cohortData.cohort_type,
        criteria: cohortData.criteria || {},
        member_count: 0,
        is_active: true,
        is_system: false
      })
      .select()
      .single();

    if (error) throw error;

    console.log('[CohortService] Cohort created successfully:', data.id);
    return data as Cohort;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to create cohort';
    console.error('[CohortService] Create error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Get a cohort by ID
 */
export async function getCohort(cohortId: string): Promise<Cohort | null> {
  console.log('[CohortService] Fetching cohort:', cohortId);

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('user_cohorts')
      .select('*')
      .eq('id', cohortId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('[CohortService] Cohort not found:', cohortId);
        return null;
      }
      throw error;
    }

    console.log('[CohortService] Cohort fetched successfully');
    return data as Cohort;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to fetch cohort';
    console.error('[CohortService] Fetch error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * List cohorts with optional filtering
 */
export async function listCohorts(filters?: {
  cohort_type?: CohortType;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ cohorts: Cohort[]; total: number }> {
  console.log('[CohortService] Listing cohorts with filters:', filters);

  try {
    const supabase = createClient();

    let query = supabase
      .from('user_cohorts')
      .select('*', { count: 'exact' });

    if (filters?.cohort_type) {
      query = query.eq('cohort_type', filters.cohort_type);
    }

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    console.log('[CohortService] Listed', data?.length || 0, 'cohorts');
    return {
      cohorts: (data as Cohort[]) || [],
      total: count || 0
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to list cohorts';
    console.error('[CohortService] List error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Update a cohort
 */
export async function updateCohort(
  cohortId: string,
  updates: Partial<Cohort>
): Promise<Cohort> {
  console.log('[CohortService] Updating cohort:', cohortId);

  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('user_cohorts')
      .update(updates)
      .eq('id', cohortId)
      .eq('created_by', user.id)
      .select()
      .single();

    if (error) throw error;

    console.log('[CohortService] Cohort updated successfully');
    return data as Cohort;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to update cohort';
    console.error('[CohortService] Update error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Delete a cohort (only non-system cohorts)
 */
export async function deleteCohort(cohortId: string): Promise<void> {
  console.log('[CohortService] Deleting cohort:', cohortId);

  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('user_cohorts')
      .delete()
      .eq('id', cohortId)
      .eq('created_by', user.id)
      .eq('is_system', false);

    if (error) throw error;

    console.log('[CohortService] Cohort deleted successfully');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to delete cohort';
    console.error('[CohortService] Delete error:', errorMsg);
    throw new Error(errorMsg);
  }
}

// ==================== Member Management ====================

/**
 * Add a member to a cohort
 */
export async function addCohortMember(
  cohortId: string,
  userId: string,
  addedMethod: CohortMember['added_method']
): Promise<void> {
  console.log('[CohortService] Adding member to cohort:', cohortId, userId);

  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('user_cohort_members')
      .insert({
        cohort_id: cohortId,
        user_id: userId,
        added_method: addedMethod,
        is_active: true
      });

    if (error) {
      if (error.code === '23505') {
        console.log('[CohortService] Member already in cohort');
        return;
      }
      throw error;
    }

    await incrementMemberCount(cohortId);
    console.log('[CohortService] Member added successfully');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to add member';
    console.error('[CohortService] Add member error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Remove a member from a cohort
 */
export async function removeCohortMember(
  cohortId: string,
  userId: string,
  reason?: string
): Promise<void> {
  console.log('[CohortService] Removing member from cohort:', cohortId, userId);

  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('user_cohort_members')
      .update({
        is_active: false,
        removed_at: new Date().toISOString(),
        removal_reason: reason
      })
      .eq('cohort_id', cohortId)
      .eq('user_id', userId);

    if (error) throw error;

    await decrementMemberCount(cohortId);
    console.log('[CohortService] Member removed successfully');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to remove member';
    console.error('[CohortService] Remove member error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Get cohort members
 */
export async function getCohortMembers(
  cohortId: string,
  options?: { is_active?: boolean; limit?: number; offset?: number }
): Promise<{ members: CohortMember[]; total: number }> {
  console.log('[CohortService] Fetching cohort members:', cohortId);

  try {
    const supabase = createClient();

    let query = supabase
      .from('user_cohort_members')
      .select('*', { count: 'exact' })
      .eq('cohort_id', cohortId);

    if (options?.is_active !== undefined) {
      query = query.eq('is_active', options.is_active);
    }

    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    query = query
      .order('added_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    console.log('[CohortService] Fetched', data?.length || 0, 'members');
    return {
      members: (data as CohortMember[]) || [],
      total: count || 0
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to fetch members';
    console.error('[CohortService] Fetch members error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Get cohorts for a user
 */
export async function getUserCohorts(userId: string): Promise<Cohort[]> {
  console.log('[CohortService] Fetching cohorts for user:', userId);

  try {
    const supabase = createClient();

    const { data: memberships, error: memberError } = await supabase
      .from('user_cohort_members')
      .select('cohort_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (memberError) throw memberError;

    if (!memberships || memberships.length === 0) {
      console.log('[CohortService] User not in any cohorts');
      return [];
    }

    const cohortIds = memberships.map(m => m.cohort_id);

    const { data: cohorts, error: cohortError } = await supabase
      .from('user_cohorts')
      .select('*')
      .in('id', cohortIds)
      .eq('is_active', true);

    if (cohortError) throw cohortError;

    console.log('[CohortService] Found', cohorts?.length || 0, 'cohorts');
    return (cohorts as Cohort[]) || [];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to fetch user cohorts';
    console.error('[CohortService] Fetch user cohorts error:', errorMsg);
    throw new Error(errorMsg);
  }
}

// ==================== Helper Functions ====================

/**
 * Increment cohort member count
 */
async function incrementMemberCount(cohortId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.rpc('increment_cohort_members', {
    cohort_id: cohortId
  });

  if (error) {
    console.error('[CohortService] Failed to increment member count:', error);
  }
}

/**
 * Decrement cohort member count
 */
async function decrementMemberCount(cohortId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.rpc('decrement_cohort_members', {
    cohort_id: cohortId
  });

  if (error) {
    console.error('[CohortService] Failed to decrement member count:', error);
  }
}

// ==================== Metrics Calculation ====================

/**
 * Calculate metrics for a cohort
 */
export async function calculateCohortMetrics(cohortId: string): Promise<CohortMetrics> {
  console.log('[CohortService] Calculating metrics for cohort:', cohortId);

  try {
    const supabase = createClient();

    const { data: members } = await supabase
      .from('user_cohort_members')
      .select('user_id')
      .eq('cohort_id', cohortId)
      .eq('is_active', true);

    if (!members || members.length === 0) {
      console.log('[CohortService] No members in cohort');
      return {
        cohort_id: cohortId,
        member_count: 0,
        average_rating: 0,
        average_success_rate: 0,
        average_cost_per_session: 0,
        average_tokens_per_conversation: 0,
        total_conversations: 0,
        active_members: 0
      };
    }

    const userIds = members.map(m => m.user_id);

    const { data: conversations } = await supabase
      .from('conversations')
      .select('user_id, metadata')
      .in('user_id', userIds);

    const metrics = calculateMetricsFromConversations(conversations || []);

    console.log('[CohortService] Metrics calculated successfully');
    return {
      cohort_id: cohortId,
      member_count: members.length,
      active_members: members.length,
      ...metrics
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to calculate metrics';
    console.error('[CohortService] Calculate metrics error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Calculate baseline metrics from recent conversations
 * Phase 4.1: Optimized with sampling limit to prevent performance issues
 * Uses most recent 10,000 conversations as representative sample
 */
export async function calculateBaselineMetrics(): Promise<BaselineMetrics> {
  console.log('[CohortService] Calculating baseline metrics');

  try {
    const supabase = createClient();
    const sampleSize = 10000;

    console.log('[CohortService] Sampling', sampleSize, 'recent conversations');

    const { data: conversations } = await supabase
      .from('conversations')
      .select('metadata')
      .order('created_at', { ascending: false })
      .limit(sampleSize);

    const metrics = calculateMetricsFromConversations(conversations || []);

    console.log('[CohortService] Baseline metrics calculated from',
      conversations?.length || 0, 'conversations');
    return {
      average_rating: metrics.average_rating,
      average_success_rate: metrics.average_success_rate,
      average_cost_per_session: metrics.average_cost_per_session,
      average_tokens_per_conversation: metrics.average_tokens_per_conversation
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to calculate baseline';
    console.error('[CohortService] Calculate baseline error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Compare cohort metrics to baseline
 */
export async function compareToBaseline(cohortId: string): Promise<ComparisonMetrics> {
  console.log('[CohortService] Comparing cohort to baseline:', cohortId);

  try {
    const [cohortMetrics, baselineMetrics] = await Promise.all([
      calculateCohortMetrics(cohortId),
      calculateBaselineMetrics()
    ]);

    const comparison: ComparisonMetrics = {
      cohort_metrics: cohortMetrics,
      baseline_metrics: baselineMetrics,
      rating_vs_baseline: calculatePercentageDiff(
        cohortMetrics.average_rating,
        baselineMetrics.average_rating
      ),
      success_rate_vs_baseline: calculatePercentageDiff(
        cohortMetrics.average_success_rate,
        baselineMetrics.average_success_rate
      ),
      cost_vs_baseline: calculatePercentageDiff(
        cohortMetrics.average_cost_per_session,
        baselineMetrics.average_cost_per_session
      )
    };

    console.log('[CohortService] Comparison completed');
    return comparison;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to compare to baseline';
    console.error('[CohortService] Compare error:', errorMsg);
    throw new Error(errorMsg);
  }
}

// ==================== Snapshot Management ====================

/**
 * Create a snapshot of cohort metrics
 */
export async function createSnapshot(
  cohortId: string,
  snapshotType: CohortSnapshot['snapshot_type']
): Promise<CohortSnapshot> {
  console.log('[CohortService] Creating snapshot for cohort:', cohortId);

  try {
    const supabase = createClient();
    const metrics = await calculateCohortMetrics(cohortId);

    const { data, error } = await supabase
      .from('user_cohort_snapshots')
      .insert({
        cohort_id: cohortId,
        snapshot_date: new Date().toISOString().split('T')[0],
        snapshot_type: snapshotType,
        member_count: metrics.member_count,
        active_members: metrics.active_members,
        new_members: 0,
        churned_members: 0,
        average_rating: metrics.average_rating,
        average_success_rate: metrics.average_success_rate,
        total_conversations: metrics.total_conversations,
        total_cost: metrics.average_cost_per_session * metrics.total_conversations,
        total_tokens: metrics.average_tokens_per_conversation * metrics.total_conversations
      })
      .select()
      .single();

    if (error) throw error;

    console.log('[CohortService] Snapshot created successfully');
    return data as CohortSnapshot;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to create snapshot';
    console.error('[CohortService] Create snapshot error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Get snapshots for a cohort with pagination
 * Phase 4.1: Added pagination support
 */
export async function getSnapshots(
  cohortId: string,
  options?: {
    dateRange?: { start: Date; end: Date };
    page?: number;
    pageSize?: number;
  }
): Promise<PaginationResult<CohortSnapshot>> {
  console.log('[CohortService] Fetching snapshots for cohort:', cohortId);

  try {
    const supabase = createClient();
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;
    const { from, to } = calculatePaginationRange(page, pageSize);

    let query = supabase
      .from('user_cohort_snapshots')
      .select('*', { count: 'exact' })
      .eq('cohort_id', cohortId);

    if (options?.dateRange) {
      query = query
        .gte('snapshot_date', options.dateRange.start.toISOString().split('T')[0])
        .lte('snapshot_date', options.dateRange.end.toISOString().split('T')[0]);
    }

    query = query
      .order('snapshot_date', { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    console.log('[CohortService] Fetched', data?.length || 0, 'snapshots, total:', count);
    return buildPaginatedResult(
      (data as CohortSnapshot[]) || [],
      count || 0,
      page,
      pageSize
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to fetch snapshots';
    console.error('[CohortService] Fetch snapshots error:', errorMsg);
    throw new Error(errorMsg);
  }
}

// ==================== Utility Functions ====================

/**
 * Calculate metrics from conversation data
 */
function calculateMetricsFromConversations(
  conversations: Array<{ metadata?: Record<string, unknown> }>
): Omit<CohortMetrics, 'cohort_id' | 'member_count' | 'active_members'> {
  if (conversations.length === 0) {
    return {
      average_rating: 0,
      average_success_rate: 0,
      average_cost_per_session: 0,
      average_tokens_per_conversation: 0,
      total_conversations: 0
    };
  }

  let totalRating = 0;
  let ratingCount = 0;
  let totalSuccess = 0;
  let successCount = 0;
  let totalCost = 0;
  let totalTokens = 0;

  for (const conv of conversations) {
    const meta = conv.metadata || {};

    if (typeof meta.rating === 'number') {
      totalRating += meta.rating;
      ratingCount++;
    }

    if (typeof meta.success === 'boolean') {
      totalSuccess += meta.success ? 1 : 0;
      successCount++;
    }

    if (typeof meta.cost === 'number') {
      totalCost += meta.cost;
    }

    if (typeof meta.tokens === 'number') {
      totalTokens += meta.tokens;
    }
  }

  return {
    average_rating: ratingCount > 0 ? totalRating / ratingCount : 0,
    average_success_rate: successCount > 0 ? totalSuccess / successCount : 0,
    average_cost_per_session: conversations.length > 0 ? totalCost / conversations.length : 0,
    average_tokens_per_conversation: conversations.length > 0 ? totalTokens / conversations.length : 0,
    total_conversations: conversations.length
  };
}

/**
 * Calculate percentage difference between two values
 */
function calculatePercentageDiff(value: number, baseline: number): number {
  if (baseline === 0) return value > 0 ? 100 : 0;
  return ((value - baseline) / baseline) * 100;
}
