/**
 * Cohort Refresh API Route
 *
 * Handles refreshing dynamic cohort membership based on criteria.
 *
 * Endpoints:
 * - POST: Refresh cohort membership by re-evaluating criteria
 *
 * Phase 3.1: User Cohort Backend
 * Date: 2025-10-25
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getCohort,
  getCohortMembers,
  addCohortMember,
  removeCohortMember,
  updateCohort
} from '@/lib/services/cohort.service';
import { findMatchingUsers } from '@/lib/services/cohort-criteria-evaluator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ==================== POST: Refresh Cohort ====================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Cohort Refresh API] POST request for cohort:', id);

  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Cohort Refresh API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const cohort = await getCohort(id);

    if (!cohort) {
      console.log('[Cohort Refresh API] Cohort not found');
      return NextResponse.json(
        { error: 'Cohort not found' },
        { status: 404 }
      );
    }

    if (cohort.cohort_type !== 'dynamic' && cohort.cohort_type !== 'behavioral') {
      console.log('[Cohort Refresh API] Invalid cohort type:', cohort.cohort_type);
      return NextResponse.json(
        { error: 'Can only refresh dynamic or behavioral cohorts' },
        { status: 400 }
      );
    }

    if (!cohort.criteria || Object.keys(cohort.criteria).length === 0) {
      console.log('[Cohort Refresh API] No criteria defined');
      return NextResponse.json(
        { error: 'Cohort has no criteria defined' },
        { status: 400 }
      );
    }

    console.log('[Cohort Refresh API] Finding matching users');

    const matchingUserIds = await findMatchingUsers(cohort.criteria);

    console.log('[Cohort Refresh API] Found', matchingUserIds.length, 'matching users');

    const { members: currentMembers } = await getCohortMembers(id, {
      is_active: true
    });

    const currentUserIds = new Set(currentMembers.map(m => m.user_id));
    const matchingUserIdSet = new Set(matchingUserIds);

    const usersToAdd = matchingUserIds.filter(id => !currentUserIds.has(id));
    const usersToRemove = currentMembers
      .filter(m => !matchingUserIdSet.has(m.user_id))
      .map(m => m.user_id);

    console.log('[Cohort Refresh API] Adding', usersToAdd.length, 'members');
    console.log('[Cohort Refresh API] Removing', usersToRemove.length, 'members');

    for (const userId of usersToAdd) {
      try {
        await addCohortMember(id, userId, 'criteria_match');
      } catch (error) {
        console.error('[Cohort Refresh API] Failed to add user:', userId, error);
      }
    }

    for (const userId of usersToRemove) {
      try {
        await removeCohortMember(id, userId, 'No longer matches criteria');
      } catch (error) {
        console.error('[Cohort Refresh API] Failed to remove user:', userId, error);
      }
    }

    await updateCohort(id, {
      last_calculated_at: new Date().toISOString()
    });

    console.log('[Cohort Refresh API] Refresh completed successfully');

    return NextResponse.json({
      members_added: usersToAdd.length,
      members_removed: usersToRemove.length,
      total_members: matchingUserIds.length
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Cohort Refresh API] POST error:', errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
