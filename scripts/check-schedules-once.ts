/**
 * One-Shot Scheduler Check
 * For use with Render Cron Jobs or other scheduled task runners
 *
 * This script:
 * 1. Checks for due scheduled evaluations
 * 2. Executes any that are due
 * 3. Exits cleanly
 *
 * Unlike the always-on worker, this runs once and terminates.
 * Perfect for cron jobs that invoke every minute.
 *
 * Usage: npx tsx scripts/check-schedules-once.ts
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

import { createClient } from '@supabase/supabase-js';
import { isTimeDue, calculateNextRun } from '../lib/evaluation/schedule-calculator';
import type { ScheduledEvaluation } from '../lib/batch-testing/types';
import { recordUsageEvent } from '../lib/usage/checker';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const MAX_CONCURRENT_EVALS = 3;

/**
 * Check for due schedules and execute them
 */
async function checkAndExecuteSchedules() {
  const startTime = Date.now();
  console.log('[Scheduler] Starting one-shot schedule check...');
  console.log('[Scheduler] Timestamp:', new Date().toISOString());

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Scheduler] ERROR: Missing required environment variables');
    console.error('[Scheduler] NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'MISSING');
    console.error('[Scheduler] SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'MISSING');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get all active schedules that are due
    const now = new Date();
    const { data: dueSchedules, error: queryError } = await supabase
      .from('scheduled_evaluations')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', now.toISOString())
      .order('next_run_at', { ascending: true })
      .limit(MAX_CONCURRENT_EVALS);

    if (queryError) {
      console.error('[Scheduler] Database query error:', queryError);
      process.exit(1);
    }

    console.log(`[Scheduler] Found ${dueSchedules?.length || 0} due schedules`);

    if (!dueSchedules || dueSchedules.length === 0) {
      const elapsed = Date.now() - startTime;
      console.log(`[Scheduler] No schedules to execute. Check completed in ${elapsed}ms`);
      process.exit(0);
    }

    // Execute each due schedule
    const results = await Promise.allSettled(
      dueSchedules.map(schedule => executeSchedule(schedule, supabase))
    );

    // Log results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log('[Scheduler] Execution summary:');
    console.log(`  - Total schedules: ${dueSchedules.length}`);
    console.log(`  - Successful: ${successful}`);
    console.log(`  - Failed: ${failed}`);

    const elapsed = Date.now() - startTime;
    console.log(`[Scheduler] One-shot check completed in ${elapsed}ms`);

    // Exit with error code if any failed
    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('[Scheduler] Fatal error:', error);
    process.exit(1);
  }
}

/**
 * Execute a single scheduled evaluation
 */
async function executeSchedule(
  schedule: ScheduledEvaluation,
  supabase: ReturnType<typeof createClient>
) {
  console.log(`[Scheduler] Executing schedule: ${schedule.name} (${schedule.id})`);

  try {
    // Create run record
    const { data: run, error: runError } = await supabase
      .from('scheduled_evaluation_runs')
      .insert({
        scheduled_evaluation_id: schedule.id,
        status: 'triggered',
        triggered_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError || !run) {
      throw new Error(`Failed to create run record: ${runError?.message}`);
    }

    console.log(`[Scheduler] Created run record: ${run.id}`);

    // Record scheduled eval usage (fire-and-forget)
    recordUsageEvent({
      userId: schedule.user_id,
      metricType: 'scheduled_eval_run',
      value: 1,
      resourceType: 'scheduled_eval',
      resourceId: run.id,
      metadata: {
        schedule_id: schedule.id,
        schedule_name: schedule.name,
        test_suite_id: schedule.batch_test_config?.test_suite_id || null,
      }
    }).catch(err => {
      console.error('[Scheduler] Failed to record usage:', err);
      // Don't fail the execution if usage recording fails
    });

    // Trigger batch test via API
    // Use NEXT_PUBLIC_BASE_URL (defined in render.yaml) for worker-to-web communication
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    console.log(`[Scheduler] Calling batch test API at: ${baseUrl}/api/batch-testing/run`);

    const response = await fetch(`${baseUrl}/api/batch-testing/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        config: schedule.batch_test_config,
        userId: schedule.user_id,
        scheduledEvaluationRunId: run.id,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Batch test API failed: ${response.status} ${error}`);
    }

    const result = await response.json();
    console.log(`[Scheduler] Batch test triggered: ${result.runId}`);

    // Update run with batch test run ID
    await supabase
      .from('scheduled_evaluation_runs')
      .update({
        batch_test_run_id: result.runId,
        status: 'running',
      })
      .eq('id', run.id);

    // Calculate next run time
    const nextRunAt = calculateNextRun(
      schedule.schedule_type,
      schedule.timezone,
      new Date(),
      schedule.cron_expression
    );

    // Update schedule with next run time and reset consecutive failures
    await supabase
      .from('scheduled_evaluations')
      .update({
        next_run_at: nextRunAt.toISOString(),
        last_run_at: new Date().toISOString(),
        consecutive_failures: 0,
      })
      .eq('id', schedule.id);

    console.log(`[Scheduler] Updated next run to: ${nextRunAt.toISOString()}`);
    console.log(`[Scheduler] Successfully executed: ${schedule.name}`);

  } catch (error) {
    console.error(`[Scheduler] Error executing schedule ${schedule.name}:`, error);

    // Increment failure counter
    const newFailureCount = (schedule.consecutive_failures || 0) + 1;
    const shouldDisable = newFailureCount >= 3;

    await supabase
      .from('scheduled_evaluations')
      .update({
        consecutive_failures: newFailureCount,
        is_active: shouldDisable ? false : schedule.is_active,
      })
      .eq('id', schedule.id);

    if (shouldDisable) {
      console.log(`[Scheduler] Auto-disabled schedule ${schedule.name} after 3 failures`);
    }

    throw error;
  }
}

// Run the check
checkAndExecuteSchedules();
