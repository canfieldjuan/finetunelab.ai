/**
 * API Route - Individual Scheduled Evaluation Operations
 *
 * GET /api/scheduled-evaluations/[id] - Get specific scheduled evaluation
 * PATCH /api/scheduled-evaluations/[id] - Update scheduled evaluation
 * DELETE /api/scheduled-evaluations/[id] - Delete scheduled evaluation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateNextRun } from '@/lib/evaluation/schedule-calculator';
import type { ScheduledEvaluation, ScheduleType } from '@/lib/batch-testing/types';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY0NTE5MjgyMCwiZXhwIjoxOTYwNzY4ODIwfQ.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

/**
 * GET - Get specific scheduled evaluation by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Scheduled Evaluations API] GET - Get schedule:', id);

  try {
    // Block 1: Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('[Scheduled Evaluations API] No auth header');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[Scheduled Evaluations API] Invalid token:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    console.log('[Scheduled Evaluations API] User authenticated:', user.id);

    // Block 2: Fetch schedule (RLS enforces user ownership)
    const supabaseRead = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: schedule, error: queryError } = await supabaseRead
      .from('scheduled_evaluations')
      .select('*')
      .eq('id', id)
      .single();

    if (queryError || !schedule) {
      console.log('[Scheduled Evaluations API] Schedule not found:', queryError?.message);
      return NextResponse.json(
        { error: 'Scheduled evaluation not found or access denied' },
        { status: 404 }
      );
    }

    console.log('[Scheduled Evaluations API] Schedule found:', schedule.id);

    return NextResponse.json({
      success: true,
      data: schedule as ScheduledEvaluation,
    });

  } catch (error) {
    console.error('[Scheduled Evaluations API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update scheduled evaluation
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Scheduled Evaluations API] PATCH - Update schedule:', id);

  try {
    // Block 1: Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('[Scheduled Evaluations API] No auth header');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[Scheduled Evaluations API] Invalid token:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    console.log('[Scheduled Evaluations API] User authenticated:', user.id);

    // Block 2: Fetch existing schedule to verify ownership
    const supabaseRead = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: existingSchedule, error: fetchError } = await supabaseRead
      .from('scheduled_evaluations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingSchedule) {
      console.log('[Scheduled Evaluations API] Schedule not found:', fetchError?.message);
      return NextResponse.json(
        { error: 'Scheduled evaluation not found or access denied' },
        { status: 404 }
      );
    }

    // Block 3: Parse and prepare update payload
    const body = await req.json();
    const updates: any = {};

    // Allow updating these fields
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.schedule_type !== undefined) {
      const validScheduleTypes: ScheduleType[] = ['hourly', 'daily', 'weekly', 'custom'];
      if (!validScheduleTypes.includes(body.schedule_type)) {
        return NextResponse.json(
          { error: `Invalid schedule_type. Must be one of: ${validScheduleTypes.join(', ')}` },
          { status: 400 }
        );
      }
      updates.schedule_type = body.schedule_type;
    }
    if (body.cron_expression !== undefined) updates.cron_expression = body.cron_expression;
    if (body.timezone !== undefined) updates.timezone = body.timezone;
    if (body.model_id !== undefined) updates.model_id = body.model_id;
    if (body.batch_test_config !== undefined) updates.batch_test_config = body.batch_test_config;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.alert_on_failure !== undefined) updates.alert_on_failure = body.alert_on_failure;
    if (body.alert_on_regression !== undefined) updates.alert_on_regression = body.alert_on_regression;
    if (body.regression_threshold_percent !== undefined) {
      updates.regression_threshold_percent = body.regression_threshold_percent;
    }

    // Block 4: Recalculate next_run_at if schedule changed
    const scheduleChanged =
      body.schedule_type !== undefined ||
      body.cron_expression !== undefined ||
      body.timezone !== undefined;

    if (scheduleChanged) {
      const scheduleType = updates.schedule_type || existingSchedule.schedule_type;
      const timezone = updates.timezone || existingSchedule.timezone;
      const cronExpression = updates.cron_expression || existingSchedule.cron_expression;

      try {
        const nextRunAt = calculateNextRun(
          scheduleType as ScheduleType,
          timezone,
          new Date(),
          cronExpression
        );
        updates.next_run_at = nextRunAt.toISOString();
        console.log('[Scheduled Evaluations API] Recalculated next_run_at:', updates.next_run_at);
      } catch (error) {
        console.error('[Scheduled Evaluations API] Failed to calculate next run:', error);
        return NextResponse.json(
          { error: 'Invalid schedule configuration: ' + (error instanceof Error ? error.message : 'Unknown error') },
          { status: 400 }
        );
      }
    }

    // Block 5: Update schedule (use service key for write)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: updatedSchedule, error: updateError } = await supabaseAdmin
      .from('scheduled_evaluations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)  // Double-check ownership
      .select()
      .single();

    if (updateError || !updatedSchedule) {
      console.error('[Scheduled Evaluations API] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update scheduled evaluation: ' + updateError?.message },
        { status: 500 }
      );
    }

    console.log('[Scheduled Evaluations API] Schedule updated:', updatedSchedule.id);

    return NextResponse.json({
      success: true,
      data: updatedSchedule as ScheduledEvaluation,
    });

  } catch (error) {
    console.error('[Scheduled Evaluations API] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete scheduled evaluation
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Scheduled Evaluations API] DELETE - Delete schedule:', id);

  try {
    // Block 1: Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('[Scheduled Evaluations API] No auth header');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[Scheduled Evaluations API] Invalid token:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    console.log('[Scheduled Evaluations API] User authenticated:', user.id);

    // Block 2: Delete schedule (use service key, but verify ownership)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { error: deleteError } = await supabaseAdmin
      .from('scheduled_evaluations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);  // Ensure user owns this schedule

    if (deleteError) {
      console.error('[Scheduled Evaluations API] Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete scheduled evaluation: ' + deleteError.message },
        { status: 500 }
      );
    }

    console.log('[Scheduled Evaluations API] Schedule deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'Scheduled evaluation deleted successfully',
    });

  } catch (error) {
    console.error('[Scheduled Evaluations API] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
