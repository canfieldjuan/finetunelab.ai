// Evaluation Scheduler Worker
// Created: 2025-12-16
// Purpose: Background worker to check and execute due scheduled evaluations
// Deployment: Standalone process (Render background worker)

import { createClient } from '@supabase/supabase-js';
import { calculateNextRun, isTimeDue } from './schedule-calculator';
import type { ScheduledEvaluation, ScheduleType } from '../batch-testing/types';
import { sendScheduledEvaluationAlert } from '../alerts/alert.service';

// Configuration
const WORKER_INTERVAL_MS = 60000; // Check every minute
const MAX_CONCURRENT_EVALS = 3; // Concurrency limit to avoid overwhelming the system
const MAX_CONSECUTIVE_FAILURES = 3; // Auto-disable after this many failures
const BATCH_TEST_TIMEOUT_MS = 600000; // 10 minutes timeout for batch tests

/**
 * Evaluation Scheduler Worker
 *
 * Background process that:
 * 1. Checks for due scheduled evaluations every minute
 * 2. Executes batch tests for due schedules
 * 3. Updates next_run_at and status
 * 4. Handles failures and auto-disables after consecutive failures
 */
export class EvaluationSchedulerWorker {
  private supabase;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private runningEvaluations = new Set<string>();
  private appUrl: string;

  constructor(
    supabaseUrl: string,
    supabaseServiceKey: string,
    appUrl: string
  ) {
    if (!supabaseUrl || !supabaseServiceKey || !appUrl) {
      throw new Error('Missing required configuration: supabaseUrl, supabaseServiceKey, or appUrl');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.appUrl = appUrl;

    console.log('[EvalScheduler] Worker initialized');
    console.log('[EvalScheduler] App URL:', this.appUrl);
    console.log('[EvalScheduler] Check interval:', WORKER_INTERVAL_MS, 'ms');
    console.log('[EvalScheduler] Max concurrent evaluations:', MAX_CONCURRENT_EVALS);
  }

  /**
   * Start the worker loop
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[EvalScheduler] Worker already running');
      return;
    }

    this.isRunning = true;
    console.log('[EvalScheduler] Worker started');

    // Run immediately on start
    this.tick();

    // Then run every interval
    this.intervalId = setInterval(() => {
      this.tick();
    }, WORKER_INTERVAL_MS);
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('[EvalScheduler] Worker not running');
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('[EvalScheduler] Worker stopped');
  }

  /**
   * Single tick - check for due evaluations and execute
   */
  private async tick(): Promise<void> {
    const tickStart = Date.now();
    console.log('[EvalScheduler] Tick started at', new Date().toISOString());

    try {
      // Check if we're at capacity
      if (this.runningEvaluations.size >= MAX_CONCURRENT_EVALS) {
        console.log('[EvalScheduler] At capacity:', this.runningEvaluations.size, '/', MAX_CONCURRENT_EVALS);
        return;
      }

      // Get due evaluations
      const dueEvaluations = await this.getDueEvaluations();

      if (dueEvaluations.length === 0) {
        console.log('[EvalScheduler] No due evaluations');
        return;
      }

      console.log('[EvalScheduler] Found', dueEvaluations.length, 'due evaluations');

      // Execute evaluations (respecting concurrency limit)
      const availableSlots = MAX_CONCURRENT_EVALS - this.runningEvaluations.size;
      const toExecute = dueEvaluations.slice(0, availableSlots);

      for (const evaluation of toExecute) {
        // Fire-and-forget execution
        this.executeEvaluation(evaluation).catch((error) => {
          console.error('[EvalScheduler] Unhandled error in executeEvaluation:', error);
        });
      }

      const tickDuration = Date.now() - tickStart;
      console.log('[EvalScheduler] Tick completed in', tickDuration, 'ms');

    } catch (error) {
      console.error('[EvalScheduler] Tick error:', error);
    }
  }

  /**
   * Query database for due evaluations
   */
  private async getDueEvaluations(): Promise<ScheduledEvaluation[]> {
    const now = new Date();

    const { data, error } = await this.supabase
      .from('scheduled_evaluations')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', now.toISOString())
      .order('next_run_at', { ascending: true })
      .limit(MAX_CONCURRENT_EVALS * 2); // Fetch more than we need in case some are already running

    if (error) {
      console.error('[EvalScheduler] Failed to query due evaluations:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Filter out already running evaluations
    const notRunning = data.filter(
      (evaluation) => !this.runningEvaluations.has(evaluation.id)
    );

    // Double-check with isTimeDue utility
    const actuallyDue = notRunning.filter((evaluation) =>
      isTimeDue(new Date(evaluation.next_run_at), now)
    );

    return actuallyDue as ScheduledEvaluation[];
  }

  /**
   * Execute a scheduled evaluation
   */
  private async executeEvaluation(evaluation: ScheduledEvaluation): Promise<void> {
    const evalId = evaluation.id;
    console.log('[EvalScheduler] Executing evaluation:', evalId, '-', evaluation.name);

    // Mark as running
    this.runningEvaluations.add(evalId);

    try {
      // Prepare batch test config
      const batchTestConfig = {
        ...evaluation.batch_test_config,
        model_id: evaluation.model_id,
        test_suite_id: evaluation.test_suite_id,
      };

      // Call batch testing API with scheduled headers
      const response = await this.callBatchTestAPI(
        evaluation.user_id,
        batchTestConfig,
        evalId
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Batch test API failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const batchTestRunId = result.test_run_id || null;

      console.log('[EvalScheduler] Batch test started:', batchTestRunId);

      // Schedule next run and update status
      await this.scheduleNextRun(evaluation, 'success', batchTestRunId);

      console.log('[EvalScheduler] Successfully executed:', evalId);

    } catch (error) {
      console.error('[EvalScheduler] Execution failed:', evalId, error);
      await this.handleFailure(evaluation, error);

    } finally {
      // Mark as no longer running
      this.runningEvaluations.delete(evalId);
    }
  }

  /**
   * Call batch testing API with service role authentication
   */
  private async callBatchTestAPI(
    userId: string,
    batchTestConfig: any,
    scheduledEvalId: string
  ): Promise<Response> {
    const url = `${this.appUrl}/api/batch-testing/run`;

    // Use service role key directly for background worker operations
    // The batch testing API supports both session auth and service role auth
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-role-key': serviceRoleKey,
        'x-user-id': userId,
        'x-scheduled-evaluation': 'true',
        'x-scheduled-evaluation-id': scheduledEvalId,
      },
      body: JSON.stringify({
        config: batchTestConfig,
      }),
      signal: AbortSignal.timeout(BATCH_TEST_TIMEOUT_MS),
    });

    return response;
  }

  /**
   * Update schedule after successful execution
   */
  private async scheduleNextRun(
    evaluation: ScheduledEvaluation,
    status: 'success' | 'failed',
    batchTestRunId: string | null
  ): Promise<void> {
    try {
      // Calculate next run time
      const nextRunAt = calculateNextRun(
        evaluation.schedule_type as ScheduleType,
        evaluation.timezone,
        new Date(),
        evaluation.cron_expression || undefined
      );

      // Update schedule
      const updates: any = {
        last_run_at: new Date().toISOString(),
        last_run_status: status,
        last_run_id: batchTestRunId,
        next_run_at: nextRunAt.toISOString(),
      };

      // Reset consecutive failures on success
      if (status === 'success') {
        updates.consecutive_failures = 0;
      }

      const { error } = await this.supabase
        .from('scheduled_evaluations')
        .update(updates)
        .eq('id', evaluation.id);

      if (error) {
        console.error('[EvalScheduler] Failed to update schedule:', error);
      } else {
        console.log('[EvalScheduler] Next run scheduled for:', nextRunAt.toISOString());
      }

      // Send completion alert on success (user preferences will filter)
      if (status === 'success') {
        try {
          await sendScheduledEvaluationAlert('scheduled_eval_completed', {
            scheduledEvaluationId: evaluation.id,
            userId: evaluation.user_id,
            scheduleName: evaluation.name,
            modelId: evaluation.model_id,
            status: 'triggered',
            errorMessage: null,
          });
        } catch (alertError) {
          console.error('[EvalScheduler] Failed to send completion alert:', alertError);
        }
      }

    } catch (error) {
      console.error('[EvalScheduler] Error calculating next run:', error);
    }
  }

  /**
   * Handle execution failure
   */
  private async handleFailure(
    evaluation: ScheduledEvaluation,
    error: unknown
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const newConsecutiveFailures = evaluation.consecutive_failures + 1;

    console.log('[EvalScheduler] Handling failure:', evaluation.id);
    console.log('[EvalScheduler] Consecutive failures:', newConsecutiveFailures);

    const updates: any = {
      last_run_at: new Date().toISOString(),
      last_run_status: 'failed',
      consecutive_failures: newConsecutiveFailures,
    };

    // Send failure alert if enabled
    if (evaluation.alert_on_failure) {
      try {
        await sendScheduledEvaluationAlert('scheduled_eval_failed', {
          scheduledEvaluationId: evaluation.id,
          userId: evaluation.user_id,
          scheduleName: evaluation.name,
          modelId: evaluation.model_id,
          status: 'failed',
          errorMessage: errorMessage,
          consecutiveFailures: newConsecutiveFailures,
        });
      } catch (alertError) {
        console.error('[EvalScheduler] Failed to send failure alert:', alertError);
      }
    }

    // Auto-disable after max consecutive failures
    if (newConsecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      updates.is_active = false;
      console.warn(
        '[EvalScheduler] Auto-disabling schedule after',
        MAX_CONSECUTIVE_FAILURES,
        'consecutive failures:',
        evaluation.id
      );

      // Send auto-disabled alert if enabled
      if (evaluation.alert_on_failure) {
        try {
          await sendScheduledEvaluationAlert('scheduled_eval_disabled', {
            scheduledEvaluationId: evaluation.id,
            userId: evaluation.user_id,
            scheduleName: evaluation.name,
            modelId: evaluation.model_id,
            status: 'auto_disabled',
            errorMessage: `Auto-disabled after ${newConsecutiveFailures} consecutive failures`,
            consecutiveFailures: newConsecutiveFailures,
          });
        } catch (alertError) {
          console.error('[EvalScheduler] Failed to send disabled alert:', alertError);
        }
      }
    } else {
      // Calculate next retry time (use same schedule)
      try {
        const nextRunAt = calculateNextRun(
          evaluation.schedule_type as ScheduleType,
          evaluation.timezone,
          new Date(),
          evaluation.cron_expression || undefined
        );
        updates.next_run_at = nextRunAt.toISOString();
      } catch (calcError) {
        console.error('[EvalScheduler] Error calculating next run after failure:', calcError);
      }
    }

    // Update schedule
    const { error: updateError } = await this.supabase
      .from('scheduled_evaluations')
      .update(updates)
      .eq('id', evaluation.id);

    if (updateError) {
      console.error('[EvalScheduler] Failed to update schedule after failure:', updateError);
    }

    // Update run record with error
    const { error: runError } = await this.supabase
      .from('scheduled_evaluation_runs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        error_details: {
          timestamp: new Date().toISOString(),
          consecutive_failures: newConsecutiveFailures,
        },
        completed_at: new Date().toISOString(),
      })
      .eq('scheduled_evaluation_id', evaluation.id)
      .eq('status', 'triggered')
      .order('created_at', { ascending: false })
      .limit(1);

    if (runError) {
      console.error('[EvalScheduler] Failed to update run record:', runError);
    }
  }

  /**
   * Get worker status
   */
  getStatus(): {
    isRunning: boolean;
    runningEvaluations: number;
    capacity: number;
  } {
    return {
      isRunning: this.isRunning,
      runningEvaluations: this.runningEvaluations.size,
      capacity: MAX_CONCURRENT_EVALS,
    };
  }
}
