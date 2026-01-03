// Evaluation Scheduler Worker
// Created: 2025-12-16
// Updated: 2025-12-25 - Added metric-based alert evaluation
// Purpose: Background worker to check and execute due scheduled evaluations + metric alert rules
// Deployment: Standalone process (Render background worker)

import { createClient } from '@supabase/supabase-js';
import { calculateNextRun, isTimeDue } from './schedule-calculator';
import type { ScheduledEvaluation, ScheduleType } from '../batch-testing/types';
import { sendScheduledEvaluationAlert } from '../alerts/alert.service';
import type { MetricAlertRule, MetricType, ComparisonOperator, AggregationMethod, AlertType } from '../alerts/alert.types';
import { AlertService } from '../alerts/alert.service';
import { recordUsageEvent } from '../usage/checker';

interface ScheduleUpdatePayload {
  last_run_at?: string;
  last_run_status?: string;
  last_run_id?: string | null;
  next_run_at?: string;
  consecutive_failures?: number;
  is_active?: boolean;
}

interface TraceData {
  duration_ms?: number;
  status?: string;
  cost?: number;
  ttft_ms?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  is_anomaly?: boolean;
  anomaly_score?: number;
}

// Configuration
const WORKER_INTERVAL_MS = 60000; // Check every minute
const MAX_CONCURRENT_EVALS = 3; // Concurrency limit to avoid overwhelming the system
const MAX_CONSECUTIVE_FAILURES = 3; // Auto-disable after this many failures
const BATCH_TEST_TIMEOUT_MS = 600000; // 10 minutes timeout for batch tests
const METRIC_ALERT_EVAL_INTERVAL_MS = 60000; // Evaluate metric alerts every minute

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
  private metricAlertLastEval: number = 0;

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
      // Evaluate metric alerts if due
      const now = Date.now();
      if (now - this.metricAlertLastEval >= METRIC_ALERT_EVAL_INTERVAL_MS) {
        this.evaluateMetricAlerts().catch((error) => {
          console.error('[EvalScheduler] Metric alert evaluation error:', error);
        });
        this.metricAlertLastEval = now;
      }

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

      // Record usage event for scheduled evaluation run
      await recordUsageEvent({
        userId: evaluation.user_id,
        metricType: 'scheduled_eval_run',
        value: 1,
        resourceType: 'scheduled_evaluation',
        resourceId: evalId,
        metadata: {
          batchTestRunId,
          scheduleType: evaluation.schedule_type,
          testSuiteId: evaluation.test_suite_id,
        },
      });

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
    batchTestConfig: unknown,
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
      const updates: ScheduleUpdatePayload = {
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

    const updates: ScheduleUpdatePayload = {
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

  /**
   * Evaluate metric alert rules
   */
  private async evaluateMetricAlerts(): Promise<void> {
    console.log('[EvalScheduler] Evaluating metric alert rules');

    try {
      // Get all enabled metric alert rules
      const { data: rules, error: rulesError } = await this.supabase
        .from('metric_alert_rules')
        .select('*')
        .eq('enabled', true);

      if (rulesError) {
        console.error('[EvalScheduler] Failed to fetch metric alert rules:', rulesError);
        return;
      }

      if (!rules || rules.length === 0) {
        console.log('[EvalScheduler] No enabled metric alert rules');
        return;
      }

      console.log('[EvalScheduler] Evaluating', rules.length, 'metric alert rules');

      // Evaluate each rule
      for (const rule of rules as MetricAlertRule[]) {
        try {
          await this.evaluateSingleMetricRule(rule);
        } catch (error) {
          console.error('[EvalScheduler] Error evaluating rule:', rule.id, error);
        }
      }

      console.log('[EvalScheduler] Metric alert evaluation completed');
    } catch (error) {
      console.error('[EvalScheduler] Metric alert evaluation error:', error);
    }
  }

  /**
   * Evaluate a single metric alert rule
   */
  private async evaluateSingleMetricRule(rule: MetricAlertRule): Promise<void> {
    const timeWindowEnd = new Date();
    const timeWindowStart = new Date(timeWindowEnd.getTime() - rule.time_window_minutes * 60 * 1000);

    console.log('[EvalScheduler] Evaluating rule:', rule.rule_name, 'for window:', timeWindowStart.toISOString(), 'to', timeWindowEnd.toISOString());

    // Build query for trace metrics
    let query = this.supabase
      .from('llm_traces')
      .select('*')
      .eq('user_id', rule.user_id)
      .gte('created_at', timeWindowStart.toISOString())
      .lte('created_at', timeWindowEnd.toISOString());

    // Apply filters
    if (rule.model_filter) {
      query = query.eq('model', rule.model_filter);
    }
    if (rule.operation_filter) {
      query = query.eq('operation', rule.operation_filter);
    }
    if (rule.status_filter) {
      query = query.eq('status', rule.status_filter);
    }

    const { data: traces, error: tracesError } = await query;

    if (tracesError) {
      console.error('[EvalScheduler] Failed to fetch traces for rule:', rule.id, tracesError);
      return;
    }

    if (!traces || traces.length === 0) {
      console.log('[EvalScheduler] No traces found for rule:', rule.rule_name);
      // Record evaluation with 0 samples
      await this.recordMetricEvaluation(rule, 0, rule.threshold_value, false, timeWindowStart, timeWindowEnd, 0, {});
      return;
    }

    // Calculate metric value based on aggregation method
    const metricValue = this.calculateMetricValue(traces, rule.metric_type, rule.aggregation_method);
    const sampleCount = traces.length;

    console.log('[EvalScheduler] Rule:', rule.rule_name, '| Metric:', rule.metric_type, '| Value:', metricValue, '| Threshold:', rule.threshold_value, '| Samples:', sampleCount);

    // Compare against threshold
    const triggered = this.compareValue(metricValue, rule.comparison_operator, rule.threshold_value);

    // Check cooldown period
    let shouldAlert = triggered;
    if (triggered && rule.last_triggered_at) {
      const lastTriggered = new Date(rule.last_triggered_at);
      const cooldownEnd = new Date(lastTriggered.getTime() + rule.cooldown_minutes * 60 * 1000);
      if (new Date() < cooldownEnd) {
        console.log('[EvalScheduler] Rule triggered but in cooldown period:', rule.rule_name);
        shouldAlert = false;
      }
    }

    // Record evaluation
    await this.recordMetricEvaluation(
      rule,
      metricValue,
      rule.threshold_value,
      triggered,
      timeWindowStart,
      timeWindowEnd,
      sampleCount,
      { metric_type: rule.metric_type, aggregation: rule.aggregation_method }
    );

    // Send alert if triggered and not in cooldown
    if (shouldAlert) {
      console.log('[EvalScheduler] ALERT TRIGGERED:', rule.rule_name, '| Value:', metricValue, rule.comparison_operator, rule.threshold_value);
      await this.sendMetricAlert(rule, metricValue, sampleCount, timeWindowStart, timeWindowEnd);

      // Update rule state
      await this.supabase
        .from('metric_alert_rules')
        .update({
          last_triggered_at: new Date().toISOString(),
          trigger_count: rule.trigger_count + 1,
        })
        .eq('id', rule.id);
    }
  }

  /**
   * Calculate metric value from traces
   */
  private calculateMetricValue(
    traces: TraceData[],
    metricType: MetricType,
    aggregationMethod: AggregationMethod
  ): number {
    // Extract metric values from traces
    let values: number[] = [];

    switch (metricType) {
      case 'latency':
        values = traces.map(t => t.duration_ms || 0).filter(v => v > 0);
        break;
      case 'error_rate':
        const errorCount = traces.filter(t => t.status === 'error' || t.status === 'failed').length;
        return traces.length > 0 ? (errorCount / traces.length) * 100 : 0;
      case 'cost':
        values = traces.map(t => t.cost || 0).filter(v => v > 0);
        break;
      case 'throughput':
        return traces.length; // Count of traces in time window
      case 'ttft':
        values = traces.map(t => t.ttft_ms || 0).filter(v => v > 0);
        break;
      case 'token_usage':
        values = traces.map(t => (t.prompt_tokens || 0) + (t.completion_tokens || 0)).filter(v => v > 0);
        break;
      case 'anomaly_severity':
        values = traces.filter(t => t.is_anomaly).map(t => t.anomaly_score || 0);
        break;
      default:
        return 0;
    }

    if (values.length === 0) {
      return 0;
    }

    // Calculate aggregation
    switch (aggregationMethod) {
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'max':
        return Math.max(...values);
      case 'min':
        return Math.min(...values);
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'count':
        return values.length;
      case 'p50':
        return this.percentile(values, 50);
      case 'p95':
        return this.percentile(values, 95);
      case 'p99':
        return this.percentile(values, 99);
      default:
        return 0;
    }
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Compare value against threshold
   */
  private compareValue(value: number, operator: ComparisonOperator, threshold: number): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Record metric evaluation in database
   */
  private async recordMetricEvaluation(
    rule: MetricAlertRule,
    metricValue: number,
    thresholdValue: number,
    triggered: boolean,
    timeWindowStart: Date,
    timeWindowEnd: Date,
    sampleCount: number,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('metric_alert_rule_evaluations')
        .insert({
          rule_id: rule.id,
          user_id: rule.user_id,
          metric_value: metricValue,
          threshold_value: thresholdValue,
          triggered,
          time_window_start: timeWindowStart.toISOString(),
          time_window_end: timeWindowEnd.toISOString(),
          sample_count: sampleCount,
          metadata,
        });

      if (error) {
        console.error('[EvalScheduler] Failed to record metric evaluation:', error);
      }
    } catch (error) {
      console.error('[EvalScheduler] Error recording metric evaluation:', error);
    }
  }

  /**
   * Send metric alert notification
   */
  private async sendMetricAlert(
    rule: MetricAlertRule,
    metricValue: number,
    sampleCount: number,
    timeWindowStart: Date,
    timeWindowEnd: Date
  ): Promise<void> {
    try {
      // Determine alert type based on metric
      const alertTypeMap: Record<MetricType, 'trace_latency_high' | 'trace_error_rate_high' | 'trace_cost_high' | 'trace_throughput_low' | 'trace_ttft_high' | 'anomaly_critical'> = {
        latency: 'trace_latency_high',
        error_rate: 'trace_error_rate_high',
        cost: 'trace_cost_high',
        throughput: 'trace_throughput_low',
        ttft: 'trace_ttft_high',
        token_usage: 'trace_latency_high', // Fallback
        anomaly_severity: 'anomaly_critical',
      };

      const alertType = alertTypeMap[rule.metric_type] as AlertType;

      // Create alert payload
      const alertPayload = {
        type: alertType,
        userId: rule.user_id,
        title: `Metric Alert: ${rule.rule_name}`,
        message: `${rule.metric_type} (${rule.aggregation_method}) is ${metricValue.toFixed(2)} ${rule.comparison_operator} threshold ${rule.threshold_value}`,
        metadata: {
          rule_id: rule.id,
          rule_name: rule.rule_name,
          metric_type: rule.metric_type,
          metric_value: metricValue,
          threshold_value: rule.threshold_value,
          comparison_operator: rule.comparison_operator,
          aggregation_method: rule.aggregation_method,
          time_window_minutes: rule.time_window_minutes,
          sample_count: sampleCount,
          time_window_start: timeWindowStart.toISOString(),
          time_window_end: timeWindowEnd.toISOString(),
          model_filter: rule.model_filter,
          operation_filter: rule.operation_filter,
        },
      };

      // Send via AlertService based on notification preferences
      const alertService = new AlertService();

      if (rule.notify_email) {
        await alertService.sendAlert(alertPayload);
      }

      if (rule.notify_webhooks) {
        // Webhooks will be sent by AlertService automatically
        await alertService.sendAlert(alertPayload);
      }

      console.log('[EvalScheduler] Metric alert sent:', rule.rule_name);
    } catch (error) {
      console.error('[EvalScheduler] Error sending metric alert:', error);
    }
  }
}
