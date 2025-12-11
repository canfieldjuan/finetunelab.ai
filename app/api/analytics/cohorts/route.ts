/**
 * Cohorts API Route
 *
 * Handles CRUD operations for user cohorts.
 *
 * Endpoints:
 * - GET: List cohorts with optional filtering
 * - POST: Create a new cohort
 * - PATCH: Update an existing cohort
 * - DELETE: Delete a cohort (non-system only)
 *
 * Phase 3.1: User Cohort Backend
 * Date: 2025-10-25
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createCohort,
  listCohorts,
  updateCohort,
  deleteCohort,
  type CohortType,
  type CohortCriteria
} from '@/lib/services/cohort.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ==================== GET: List Cohorts ====================

export async function GET(request: NextRequest) {
  console.log('[Cohorts API] GET request received');

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
      console.log('[Cohorts API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const cohortType = searchParams.get('cohort_type') as CohortType | null;
    const isActiveParam = searchParams.get('is_active');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const filters = {
      cohort_type: cohortType || undefined,
      is_active: isActiveParam ? isActiveParam === 'true' : undefined,
      limit: limitParam ? parseInt(limitParam) : 50,
      offset: offsetParam ? parseInt(offsetParam) : 0
    };

    console.log('[Cohorts API] Fetching cohorts with filters:', filters);

    const result = await listCohorts(filters);

    console.log('[Cohorts API] Found', result.cohorts.length, 'cohorts');

    return NextResponse.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Cohorts API] GET error:', errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

// ==================== POST: Create Cohort ====================

export async function POST(request: NextRequest) {
  console.log('[Cohorts API] POST request received');

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
      console.log('[Cohorts API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!body.name || !body.cohort_type) {
      console.log('[Cohorts API] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: name, cohort_type' },
        { status: 400 }
      );
    }

    const validTypes: CohortType[] = ['static', 'dynamic', 'behavioral', 'subscription', 'custom'];
    if (!validTypes.includes(body.cohort_type)) {
      console.log('[Cohorts API] Invalid cohort type:', body.cohort_type);
      return NextResponse.json(
        { error: 'Invalid cohort_type. Must be one of: ' + validTypes.join(', ') },
        { status: 400 }
      );
    }

    console.log('[Cohorts API] Creating cohort:', body.name);

    const cohort = await createCohort({
      name: body.name,
      description: body.description,
      cohort_type: body.cohort_type,
      criteria: body.criteria as CohortCriteria
    });

    console.log('[Cohorts API] Cohort created successfully:', cohort.id);

    return NextResponse.json({ cohort }, { status: 201 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Cohorts API] POST error:', errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

// ==================== PATCH: Update Cohort ====================

export async function PATCH(request: NextRequest) {
  console.log('[Cohorts API] PATCH request received');

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
      console.log('[Cohorts API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!body.cohort_id) {
      console.log('[Cohorts API] Missing cohort_id');
      return NextResponse.json(
        { error: 'Missing required field: cohort_id' },
        { status: 400 }
      );
    }

    console.log('[Cohorts API] Updating cohort:', body.cohort_id);

    type CohortUpdate = {
      name?: string;
      description?: string;
      criteria?: CohortCriteria;
      is_active?: boolean;
    };

    const updates: CohortUpdate = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.criteria !== undefined) updates.criteria = body.criteria as CohortCriteria;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const cohort = await updateCohort(body.cohort_id, updates);

    console.log('[Cohorts API] Cohort updated successfully');

    return NextResponse.json({ cohort });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Cohorts API] PATCH error:', errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

// ==================== DELETE: Delete Cohort ====================

export async function DELETE(request: NextRequest) {
  console.log('[Cohorts API] DELETE request received');

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
      console.log('[Cohorts API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohort_id');

    if (!cohortId) {
      console.log('[Cohorts API] Missing cohort_id');
      return NextResponse.json(
        { error: 'Missing required parameter: cohort_id' },
        { status: 400 }
      );
    }

    console.log('[Cohorts API] Deleting cohort:', cohortId);

    await deleteCohort(cohortId);

    console.log('[Cohorts API] Cohort deleted successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Cohorts API] DELETE error:', errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
