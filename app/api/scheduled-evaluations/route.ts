/**
 * API Route - Scheduled Evaluations Management
 *
 * CRUD operations for scheduled batch test evaluations
 * GET /api/scheduled-evaluations - List user's scheduled evaluations
 * POST /api/scheduled-evaluations - Create new scheduled evaluation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateNextRun, isValidCronExpression, describeCronExpression } from '@/lib/evaluation/schedule-calculator';
import type { ScheduledEvaluation, ScheduleType, BatchTestConfig } from '@/lib/batch-testing/types';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET - List user's scheduled evaluations
 */
export async function GET(req: NextRequest) {
  console.log('[Scheduled Evaluations API] GET - List scheduled evaluations');

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

    // Block 2: Query scheduled evaluations (RLS enforces user isolation)
    const supabaseRead = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: schedules, error: queryError } = await supabaseRead
      .from('scheduled_evaluations')
      .select('*')
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('[Scheduled Evaluations API] Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled evaluations: ' + queryError.message },
        { status: 500 }
      );
    }

    console.log('[Scheduled Evaluations API] Found schedules:', schedules?.length || 0);

    return NextResponse.json({
      success: true,
      data: schedules as ScheduledEvaluation[],
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
 * POST - Create new scheduled evaluation
 */
export async function POST(req: NextRequest) {
  console.log('[Scheduled Evaluations API] POST - Create scheduled evaluation');

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

    // Block 2: Rate limiting - Check schedule count
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { count: scheduleCount, error: countError } = await supabaseAdmin
      .from('scheduled_evaluations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (countError) {
      console.error('[Scheduled Evaluations API] Error checking schedule count:', countError);
    } else if (scheduleCount !== null && scheduleCount >= 50) {
      console.log('[Scheduled Evaluations API] Rate limit exceeded for user:', user.id, 'count:', scheduleCount);
      return NextResponse.json(
        {
          error: 'Maximum active schedules reached',
          message: 'You have reached the maximum of 50 active scheduled evaluations. Please deactivate or delete existing schedules to create new ones.',
          current_count: scheduleCount,
          max_allowed: 50
        },
        { status: 429 }
      );
    }

    console.log('[Scheduled Evaluations API] Current active schedules:', scheduleCount, '/ 50');

    // Block 3: Parse and validate request
    const body = await req.json();

    if (!body.name || !body.schedule_type || !body.test_suite_id || !body.model_id) {
      console.log('[Scheduled Evaluations API] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: name, schedule_type, test_suite_id, model_id' },
        { status: 400 }
      );
    }

    // Validate schedule_type
    const validScheduleTypes: ScheduleType[] = ['hourly', 'daily', 'weekly', 'custom'];
    if (!validScheduleTypes.includes(body.schedule_type)) {
      return NextResponse.json(
        { error: `Invalid schedule_type. Must be one of: ${validScheduleTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate cron_expression for custom schedules
    if (body.schedule_type === 'custom') {
      if (!body.cron_expression) {
        return NextResponse.json(
          { error: 'cron_expression is required for custom schedule type' },
          { status: 400 }
        );
      }

      if (!isValidCronExpression(body.cron_expression)) {
        return NextResponse.json(
          {
            error: 'Invalid cron expression',
            message: 'Cron expression format is invalid. Supported patterns: "0 * * * *" (hourly), "0 H * * *" (daily at hour H), "0 H * * W" (weekly on weekday W at hour H), "*/M * * * *" (every M minutes)',
            provided: body.cron_expression,
            description: describeCronExpression(body.cron_expression)
          },
          { status: 400 }
        );
      }

      console.log('[Scheduled Evaluations API] Valid cron expression:', body.cron_expression, '-', describeCronExpression(body.cron_expression));
    }

    const timezone = body.timezone || 'UTC';

    console.log('[Scheduled Evaluations API] Creating schedule:', {
      name: body.name,
      schedule_type: body.schedule_type,
      timezone,
    });

    // Block 3: Calculate next run time
    let nextRunAt: Date;
    try {
      nextRunAt = calculateNextRun(
        body.schedule_type as ScheduleType,
        timezone,
        new Date(),
        body.cron_expression
      );
    } catch (error) {
      console.error('[Scheduled Evaluations API] Failed to calculate next run:', error);
      return NextResponse.json(
        { error: 'Invalid schedule configuration: ' + (error instanceof Error ? error.message : 'Unknown error') },
        { status: 400 }
      );
    }

    // Block 4: Verify test suite exists and user has access
    const supabaseRead = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: testSuite, error: suiteError } = await supabaseRead
      .from('test_suites')
      .select('id, name')
      .eq('id', body.test_suite_id)
      .single();

    if (suiteError || !testSuite) {
      console.error('[Scheduled Evaluations API] Test suite not found or access denied:', suiteError);
      return NextResponse.json(
        { error: 'Test suite not found or access denied' },
        { status: 404 }
      );
    }

    // Block 5: Prepare batch test config
    const batchTestConfig: BatchTestConfig = {
      model_name: body.model_id,
      prompt_limit: body.batch_test_config?.prompt_limit || 25,
      concurrency: body.batch_test_config?.concurrency || 1,
      delay_ms: body.batch_test_config?.delay_ms || 1000,
      source_path: `test_suite:${body.test_suite_id}`,
      test_suite_name: testSuite.name,
      ...(body.batch_test_config || {}),
    };

    // Block 6: Create scheduled evaluation (supabaseAdmin already created above)
    const { data: schedule, error: createError } = await supabaseAdmin
      .from('scheduled_evaluations')
      .insert({
        user_id: user.id,
        name: body.name,
        description: body.description || null,
        schedule_type: body.schedule_type,
        cron_expression: body.cron_expression || null,
        timezone,
        test_suite_id: body.test_suite_id,
        model_id: body.model_id,
        batch_test_config: batchTestConfig,
        is_active: body.is_active !== undefined ? body.is_active : true,
        next_run_at: nextRunAt.toISOString(),
        alert_on_failure: body.alert_on_failure !== undefined ? body.alert_on_failure : true,
        alert_on_regression: body.alert_on_regression !== undefined ? body.alert_on_regression : false,
        regression_threshold_percent: body.regression_threshold_percent || 10.0,
      })
      .select()
      .single();

    if (createError || !schedule) {
      console.error('[Scheduled Evaluations API] Create error:', createError);
      return NextResponse.json(
        { error: 'Failed to create scheduled evaluation: ' + createError?.message },
        { status: 500 }
      );
    }

    console.log('[Scheduled Evaluations API] Schedule created:', schedule.id);
    console.log('[Scheduled Evaluations API] Next run at:', schedule.next_run_at);

    return NextResponse.json({
      success: true,
      data: schedule as ScheduledEvaluation,
    }, { status: 201 });

  } catch (error) {
    console.error('[Scheduled Evaluations API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
