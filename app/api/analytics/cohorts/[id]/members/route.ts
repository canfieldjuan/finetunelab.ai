/**
 * Cohort Members API Route
 *
 * Handles member management for cohorts.
 *
 * Endpoints:
 * - GET: List cohort members
 * - POST: Add members to cohort
 * - DELETE: Remove member from cohort
 *
 * Phase 3.1: User Cohort Backend
 * Date: 2025-10-25
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getCohortMembers,
  addCohortMember,
  removeCohortMember
} from '@/lib/services/cohort.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

// ==================== GET: List Members ====================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Cohort Members API] GET request for cohort:', id);

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
      console.log('[Cohort Members API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const isActiveParam = searchParams.get('is_active');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const options = {
      is_active: isActiveParam ? isActiveParam === 'true' : undefined,
      limit: limitParam ? parseInt(limitParam) : 100,
      offset: offsetParam ? parseInt(offsetParam) : 0
    };

    console.log('[Cohort Members API] Fetching members with options:', options);

    const result = await getCohortMembers(id, options);

    console.log('[Cohort Members API] Found', result.members.length, 'members');

    return NextResponse.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Cohort Members API] GET error:', errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

// ==================== POST: Add Members ====================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Cohort Members API] POST request for cohort:', id);

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
      console.log('[Cohort Members API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!Array.isArray(body.user_ids) || body.user_ids.length === 0) {
      console.log('[Cohort Members API] Invalid user_ids');
      return NextResponse.json(
        { error: 'user_ids must be a non-empty array' },
        { status: 400 }
      );
    }

    const addedMethod = body.added_method || 'manual';
    const validMethods = ['manual', 'automatic', 'criteria_match', 'import'];

    if (!validMethods.includes(addedMethod)) {
      console.log('[Cohort Members API] Invalid added_method');
      return NextResponse.json(
        { error: 'Invalid added_method. Must be one of: ' + validMethods.join(', ') },
        { status: 400 }
      );
    }

    console.log('[Cohort Members API] Adding', body.user_ids.length, 'members');

    let added = 0;
    let failed = 0;

    for (const userId of body.user_ids) {
      try {
        await addCohortMember(id, userId, addedMethod);
        added++;
      } catch (error) {
        console.error('[Cohort Members API] Failed to add user:', userId, error);
        failed++;
      }
    }

    console.log('[Cohort Members API] Added:', added, 'Failed:', failed);

    return NextResponse.json({
      added,
      failed,
      total: body.user_ids.length
    }, { status: 201 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Cohort Members API] POST error:', errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

// ==================== DELETE: Remove Member ====================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Cohort Members API] DELETE request for cohort:', id);

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
      console.log('[Cohort Members API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');

    if (!userId) {
      console.log('[Cohort Members API] Missing user_id');
      return NextResponse.json(
        { error: 'Missing required parameter: user_id' },
        { status: 400 }
      );
    }

    const reason = searchParams.get('removal_reason') || undefined;

    console.log('[Cohort Members API] Removing member:', userId);

    await removeCohortMember(id, userId, reason);

    console.log('[Cohort Members API] Member removed successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Cohort Members API] DELETE error:', errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
