/**
 * DAG Resume Endpoint
 * 
 * POST /api/training/dag/resume - Resume a paused execution or from checkpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import DAGOrchestrator from '@/lib/training/dag-orchestrator';
import { defaultHandlers } from '@/lib/training/job-handlers';
import type { JobType } from '@/lib/training/dag-orchestrator';

const orchestrators = new Map<string, DAGOrchestrator>();

function getOrchestrator(): DAGOrchestrator {
  const key = 'default';
  
  if (!orchestrators.has(key)) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    const orchestrator = new DAGOrchestrator(supabaseUrl, supabaseKey, {
      enabled: true,
      triggers: ['manual'],
    });

    Object.entries(defaultHandlers).forEach(([type, handler]) => {
      orchestrator.registerHandler(type as JobType, handler);
    });

    orchestrators.set(key, orchestrator);
  }

  return orchestrators.get(key)!;
}

/**
 * POST /api/training/dag/resume
 * Resume a paused execution or from checkpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId, checkpointId } = body;

    const orchestrator = getOrchestrator();

    // Resume from checkpoint if provided
    if (checkpointId) {
      console.log(`[RESUME] Resuming from checkpoint: ${checkpointId}`);
      
      const execution = await orchestrator.resumeFromCheckpoint(checkpointId);

      return NextResponse.json({
        success: true,
        executionId: execution.id,
        checkpointId,
        message: 'Execution resumed from checkpoint',
        status: execution.status,
        jobsRestored: execution.jobs.size,
      });
    }

    // Resume paused execution
    if (!executionId || typeof executionId !== 'string') {
      return NextResponse.json(
        { error: 'Missing executionId or checkpointId' },
        { status: 400 }
      );
    }

    const execution = orchestrator.getExecution(executionId);
    if (!execution) {
      return NextResponse.json(
        { error: `Execution ${executionId} not found` },
        { status: 404 }
      );
    }

    const isPaused = orchestrator.isPaused(executionId);
    if (!isPaused) {
      return NextResponse.json(
        {
          error: `Execution ${executionId} is not paused`,
          currentStatus: execution.status,
        },
        { status: 400 }
      );
    }

    console.log(`[RESUME] Resuming paused execution: ${executionId}`);

    await orchestrator.resume(executionId);

    return NextResponse.json({
      success: true,
      executionId,
      message: 'Execution resumed successfully',
      note: 'Full resume requires restart - see documentation',
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RESUME] Resume error:', errorMessage);
    
    return NextResponse.json(
      {
        error: 'Failed to resume execution',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
