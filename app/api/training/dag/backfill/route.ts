/**
 * DAG Backfill Endpoint
 *
 * POST /api/training/dag/backfill - Execute a DAG pipeline across a date range
 *
 * Enables bulk execution of DAG workflows across date ranges
 * Example: Backfill 30 days of training data with one command
 *
 * Phase: Phase 3 - Backfill System
 * Date: 2025-10-28
 */

import { NextRequest, NextResponse } from 'next/server';
import DAGOrchestrator, { JobConfig, JobType } from '@/lib/training/dag-orchestrator';
import { defaultHandlers } from '@/lib/training/job-handlers';
import {
  BackfillOrchestrator,
  BackfillConfig,
  BackfillInterval
} from '@/lib/training/backfill-orchestrator';

const orchestrators = new Map<string, DAGOrchestrator>();
const backfillOrchestrators = new Map<string, BackfillOrchestrator>();

function getOrchestrator(): DAGOrchestrator {
  const key = 'default';

  if (!orchestrators.has(key)) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const orchestrator = new DAGOrchestrator(supabaseUrl, supabaseKey);

    Object.entries(defaultHandlers).forEach(([type, handler]) => {
      orchestrator.registerHandler(type as JobType, handler);
    });

    orchestrators.set(key, orchestrator);
  }

  return orchestrators.get(key)!;
}

function getBackfillOrchestrator(): BackfillOrchestrator {
  const key = 'default';

  if (!backfillOrchestrators.has(key)) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const orchestrator = getOrchestrator();
    const backfillOrch = new BackfillOrchestrator(orchestrator, supabaseUrl, supabaseKey);

    backfillOrchestrators.set(key, backfillOrch);
  }

  return backfillOrchestrators.get(key)!;
}

/**
 * POST /api/training/dag/backfill
 * Execute a DAG pipeline across a date range
 *
 * Request body:
 * {
 *   templateName: string;        // Name for the backfill execution
 *   templateId: string;          // Template identifier
 *   jobs: JobConfig[];           // Jobs with date placeholders ({{DATE}}, {{ISO_DATE}}, etc.)
 *   startDate: string;           // ISO date string (start of range)
 *   endDate: string;             // ISO date string (end of range)
 *   interval: 'hour' | 'day' | 'week' | 'month';
 *   parallelism?: number;        // How many dates to process in parallel (default: 3)
 *   enableCache?: boolean;       // Enable caching for faster re-runs (default: true)
 * }
 *
 * Example:
 * {
 *   templateName: "training_pipeline",
 *   templateId: "daily_training",
 *   jobs: [
 *     {
 *       id: "fetch_data",
 *       name: "Fetch Data for {{ISO_DATE}}",
 *       type: "fetch",
 *       config: { date: "{{ISO_DATE}}" },
 *       dependsOn: []
 *     }
 *   ],
 *   startDate: "2025-10-01",
 *   endDate: "2025-10-30",
 *   interval: "day",
 *   parallelism: 5
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      templateName,
      templateId,
      jobs,
      startDate,
      endDate,
      interval,
      parallelism = parseInt(process.env.TRAINING_DAG_DEFAULT_PARALLELISM || '3', 10),
      enableCache = true
    } = body;

    // Validation
    if (!templateName || typeof templateName !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid templateName' },
        { status: 400 }
      );
    }

    if (!templateId || typeof templateId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid templateId' },
        { status: 400 }
      );
    }

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid jobs array' },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing startDate or endDate' },
        { status: 400 }
      );
    }

    if (!['hour', 'day', 'week', 'month'].includes(interval)) {
      return NextResponse.json(
        { error: 'Invalid interval. Must be: hour, day, week, or month' },
        { status: 400 }
      );
    }

    // Parse dates
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    if (startDateObj > endDateObj) {
      return NextResponse.json(
        { error: 'startDate must be before endDate' },
        { status: 400 }
      );
    }

    // Validate job structure
    for (const job of jobs) {
      if (!job.id || !job.name || !job.type || !job.config) {
        return NextResponse.json(
          { error: `Invalid job structure: ${JSON.stringify(job)}` },
          { status: 400 }
        );
      }

      if (!Array.isArray(job.dependsOn)) {
        return NextResponse.json(
          { error: `Job ${job.id} missing dependsOn array` },
          { status: 400 }
        );
      }
    }

    const backfillConfig: BackfillConfig = {
      templateId,
      startDate: startDateObj,
      endDate: endDateObj,
      interval: interval as BackfillInterval,
      parallelism,
      enableCache,
    };

    console.log(`[DAG-BACKFILL] Starting backfill: ${templateName}`);
    console.log(`[DAG-BACKFILL] Date range: ${startDate} to ${endDate}`);
    console.log(`[DAG-BACKFILL] Interval: ${interval}, Parallelism: ${parallelism}`);

    const backfillOrchestrator = getBackfillOrchestrator();

    const execution = await backfillOrchestrator.execute(
      templateName,
      jobs as JobConfig[],
      backfillConfig
    );

    return NextResponse.json({
      success: true,
      backfillId: execution.id,
      message: 'Backfill execution completed',
      templateName,
      status: execution.status,
      stats: {
        totalExecutions: execution.totalExecutions,
        completedExecutions: execution.completedExecutions,
        failedExecutions: execution.failedExecutions,
        startDate: execution.startDate.toISOString(),
        endDate: execution.endDate.toISOString(),
        interval: execution.interval,
      },
      executionIds: execution.executionIds,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DAG-BACKFILL] Backfill error:', errorMessage);

    return NextResponse.json(
      {
        error: 'Failed to execute backfill',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/training/dag/backfill
 * Get information about backfill capability
 */
export async function GET() {
  return NextResponse.json({
    message: 'DAG Backfill API',
    description: 'Execute DAG pipelines across date ranges',
    endpoint: 'POST /api/training/dag/backfill',
    supportedIntervals: ['hour', 'day', 'week', 'month'],
    dateParameters: [
      '{{DATE}}',      // Formatted date: 20251028, 20251028_1400, etc.
      '{{ISO_DATE}}',  // ISO date: 2025-10-28
      '{{YEAR}}',      // Year: 2025
      '{{MONTH}}',     // Month: 10
      '{{DAY}}',       // Day: 28
    ],
    example: {
      templateName: 'training_pipeline',
      templateId: 'daily_training',
      jobs: [
        {
          id: 'fetch_data',
          name: 'Fetch Data for {{ISO_DATE}}',
          type: 'fetch',
          config: { date: '{{ISO_DATE}}' },
          dependsOn: [],
        },
      ],
      startDate: '2025-10-01',
      endDate: '2025-10-30',
      interval: 'day',
      parallelism: 5,
      enableCache: true,
    },
  });
}
