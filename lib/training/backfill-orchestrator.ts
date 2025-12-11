/**
 * Backfill Orchestrator
 *
 * Enables bulk execution of DAG workflows across date ranges
 * Example: Backfill 30 days of training data with one command
 *
 * Phase: Phase 3 - Backfill System
 * Date: 2025-10-28
 */

import { DAGOrchestrator, JobConfig } from './dag-orchestrator';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export type BackfillInterval = 'hour' | 'day' | 'week' | 'month';

export type BackfillStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BackfillConfig {
  templateId: string;
  startDate: Date;
  endDate: Date;
  interval: BackfillInterval;
  parallelism?: number;
  enableCache?: boolean;
}

export interface BackfillExecution {
  id: string;
  templateId: string;
  startDate: Date;
  endDate: Date;
  interval: BackfillInterval;
  status: BackfillStatus;
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  executionIds: string[];
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

export interface DateExecutionResult {
  date: Date;
  executionId: string;
  status: 'completed' | 'failed';
  error?: string;
}

// ============================================================================
// Date Range Generation
// ============================================================================

export class DateRangeGenerator {
  /**
   * Generate array of dates between start and end with given interval
   */
  static generate(startDate: Date, endDate: Date, interval: BackfillInterval): Date[] {
    console.log('[BackfillDateRange] Generating dates:', {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      interval,
    });

    const dates: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      dates.push(new Date(current));

      switch (interval) {
        case 'hour':
          current.setHours(current.getHours() + 1);
          break;
        case 'day':
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    console.log('[BackfillDateRange] Generated', dates.length, 'dates');
    return dates;
  }

  /**
   * Format date for use in job names
   */
  static formatForJobName(date: Date, interval: BackfillInterval): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');

    switch (interval) {
      case 'hour':
        return `${year}${month}${day}_${hour}00`;
      case 'day':
        return `${year}${month}${day}`;
      case 'week':
        return `${year}W${this.getWeekNumber(date)}`;
      case 'month':
        return `${year}${month}`;
    }
  }

  /**
   * Get ISO week number
   */
  private static getWeekNumber(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return String(weekNum).padStart(2, '0');
  }
}

// ============================================================================
// Job Hydration (Date Parameter Injection)
// ============================================================================

export class JobHydrator {
  /**
   * Hydrate job configs with date parameters
   * Replaces placeholders like {{DATE}} with actual date values
   */
  static hydrateJobs(
    jobs: JobConfig[],
    date: Date,
    interval: BackfillInterval
  ): JobConfig[] {
    console.log('[BackfillHydrate] Hydrating jobs for date:', date.toISOString());

    const dateStr = DateRangeGenerator.formatForJobName(date, interval);
    const isoDate = date.toISOString().split('T')[0];

    return jobs.map(job => ({
      ...job,
      id: `${job.id}_${dateStr}`,
      name: this.interpolatePlaceholders(job.name, date, dateStr, isoDate),
      config: this.interpolateConfig(job.config, date, dateStr, isoDate),
    }));
  }

  /**
   * Interpolate placeholders in a string
   */
  private static interpolatePlaceholders(
    value: string,
    date: Date,
    dateStr: string,
    isoDate: string
  ): string {
    return value
      .replace(/\{\{DATE\}\}/g, dateStr)
      .replace(/\{\{ISO_DATE\}\}/g, isoDate)
      .replace(/\{\{YEAR\}\}/g, String(date.getFullYear()))
      .replace(/\{\{MONTH\}\}/g, String(date.getMonth() + 1).padStart(2, '0'))
      .replace(/\{\{DAY\}\}/g, String(date.getDate()).padStart(2, '0'));
  }

  /**
   * Recursively interpolate config object
   */
  private static interpolateConfig(
    config: Record<string, unknown>,
    date: Date,
    dateStr: string,
    isoDate: string
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        result[key] = this.interpolatePlaceholders(value, date, dateStr, isoDate);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.interpolateConfig(value as Record<string, unknown>, date, dateStr, isoDate);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}

// ============================================================================
// Backfill Orchestrator
// ============================================================================

export class BackfillOrchestrator {
  private orchestrator: DAGOrchestrator;
  private supabase: SupabaseClient;

  constructor(orchestrator: DAGOrchestrator, supabaseUrl: string, supabaseKey: string) {
    this.orchestrator = orchestrator;
    this.supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[BackfillOrchestrator] Initialized');
  }

  /**
   * Execute backfill across date range with controlled parallelism
   */
  async execute(
    templateName: string,
    templateJobs: JobConfig[],
    config: BackfillConfig
  ): Promise<BackfillExecution> {
    console.log('[Backfill] Starting backfill:', {
      template: templateName,
      start: config.startDate.toISOString(),
      end: config.endDate.toISOString(),
      interval: config.interval,
      parallelism: config.parallelism || 3,
    });

    const dates = DateRangeGenerator.generate(config.startDate, config.endDate, config.interval);

    const backfillId = `backfill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const backfillExecution: BackfillExecution = {
      id: backfillId,
      templateId: config.templateId,
      startDate: config.startDate,
      endDate: config.endDate,
      interval: config.interval,
      status: 'running',
      totalExecutions: dates.length,
      completedExecutions: 0,
      failedExecutions: 0,
      executionIds: [],
      createdAt: new Date(),
    };

    console.log('[Backfill] Processing', dates.length, 'dates');

    const results: DateExecutionResult[] = [];
    const parallelism = config.parallelism || 3;

    for (let i = 0; i < dates.length; i += parallelism) {
      const batch = dates.slice(i, i + parallelism);
      console.log('[Backfill] Processing batch', i / parallelism + 1, '/', Math.ceil(dates.length / parallelism));

      const batchResults = await Promise.allSettled(
        batch.map(date => this.executeForDate(templateName, templateJobs, date, config))
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const date = batch[j];

        if (result.status === 'fulfilled') {
          results.push({
            date,
            executionId: result.value,
            status: 'completed',
          });
          backfillExecution.executionIds.push(result.value);
          backfillExecution.completedExecutions++;
        } else {
          results.push({
            date,
            executionId: '',
            status: 'failed',
            error: result.reason?.message || 'Unknown error',
          });
          backfillExecution.failedExecutions++;
        }
      }

      console.log('[Backfill] Progress:', backfillExecution.completedExecutions, '/', dates.length, 'completed');
    }

    backfillExecution.status = backfillExecution.failedExecutions > 0 ? 'failed' : 'completed';
    backfillExecution.completedAt = new Date();
    backfillExecution.updatedAt = new Date();

    console.log('[Backfill] Backfill complete:', {
      total: dates.length,
      completed: backfillExecution.completedExecutions,
      failed: backfillExecution.failedExecutions,
    });

    return backfillExecution;
  }

  /**
   * Execute DAG for a specific date
   */
  private async executeForDate(
    templateName: string,
    templateJobs: JobConfig[],
    date: Date,
    config: BackfillConfig
  ): Promise<string> {
    const dateStr = DateRangeGenerator.formatForJobName(date, config.interval);
    console.log('[Backfill] Executing for date:', dateStr);

    const hydratedJobs = JobHydrator.hydrateJobs(templateJobs, date, config.interval);
    const executionName = `${templateName}_${dateStr}`;

    try {
      const execution = await this.orchestrator.execute(executionName, hydratedJobs, {
        parallelism: 3,
        enableCache: config.enableCache !== false,
      });

      console.log('[Backfill] Completed execution for', dateStr, '- ID:', execution.id);
      return execution.id;
    } catch (error) {
      console.error('[Backfill] Failed execution for', dateStr, ':', error);
      throw error;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let backfillInstance: BackfillOrchestrator | null = null;

export function getBackfillOrchestrator(orchestrator: DAGOrchestrator): BackfillOrchestrator {
  if (!backfillInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for BackfillOrchestrator');
    }

    backfillInstance = new BackfillOrchestrator(orchestrator, supabaseUrl, supabaseKey);
  }

  return backfillInstance;
}

export default BackfillOrchestrator;

