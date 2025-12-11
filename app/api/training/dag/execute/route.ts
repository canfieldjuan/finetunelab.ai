/**
 * DAG Orchestrator Execute Endpoint
 * 
 * POST /api/training/dag/execute - Execute a DAG pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import DAGOrchestrator, { JobConfig, JobType } from '@/lib/training/dag-orchestrator';
import { defaultHandlers } from '@/lib/training/job-handlers';

const orchestrators = new Map<string, DAGOrchestrator>();

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

/**
 * POST /api/training/dag/execute
 * Execute a DAG pipeline
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, jobs, options = {} } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid pipeline name' },
        { status: 400 }
      );
    }

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid jobs array' },
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

    const orchestrator = getOrchestrator();

    console.log(`[DAG-EXECUTE] Starting execution: ${name}`);
    console.log(`[DAG-EXECUTE] Jobs: ${jobs.map((j: JobConfig) => j.id).join(' -> ')}`);

    const executionPromise = orchestrator.execute(name, jobs as JobConfig[], {
      parallelism: options.parallelism || 3,
      onJobComplete: (jobId, output) => {
        console.log(`[DAG-EXECUTE] Job ${jobId} completed:`, output);
      },
      onJobFail: (jobId, error) => {
        console.error(`[DAG-EXECUTE] Job ${jobId} failed:`, error);
      },
      onProgress: (completed, total) => {
        console.log(`[DAG-EXECUTE] Progress: ${completed}/${total}`);
      },
    });

    const execution = await executionPromise;

    return NextResponse.json({
      success: true,
      executionId: execution.id,
      message: 'Pipeline execution started',
      name: execution.name,
      status: execution.status,
      totalJobs: jobs.length,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DAG-EXECUTE] Execution error:', errorMessage);
    
    return NextResponse.json(
      {
        error: 'Failed to execute pipeline',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/training/dag/execute
 * Get list of recent executions (redirects to /api/training/dag/list)
 */
export async function GET() {
  return NextResponse.json({
    error: 'Use /api/training/dag/list to get executions',
    redirectTo: '/api/training/dag/list',
  }, { status: 400 });
}
