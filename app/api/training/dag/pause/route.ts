/**
 * DAG Pause Endpoint
 * 
 * POST /api/training/dag/pause - Pause a running execution
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
 * POST /api/training/dag/pause
 * Pause a running execution
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId, createCheckpoint = true } = body;

    if (!executionId || typeof executionId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid executionId' },
        { status: 400 }
      );
    }

    const orchestrator = getOrchestrator();

    // Check if execution exists
    const execution = orchestrator.getExecution(executionId);
    if (!execution) {
      return NextResponse.json(
        { error: `Execution ${executionId} not found` },
        { status: 404 }
      );
    }

    // Check if execution is running
    if (execution.status !== 'running') {
      return NextResponse.json(
        {
          error: `Cannot pause execution ${executionId}: status is ${execution.status}`,
          currentStatus: execution.status,
        },
        { status: 400 }
      );
    }

    console.log(`[PAUSE] Pausing execution: ${executionId}`);

    await orchestrator.pause(executionId, createCheckpoint);

    const isPaused = orchestrator.isPaused(executionId);

    return NextResponse.json({
      success: true,
      executionId,
      paused: isPaused,
      message: 'Execution paused successfully',
      checkpointCreated: createCheckpoint,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PAUSE] Pause error:', errorMessage);
    
    return NextResponse.json(
      {
        error: 'Failed to pause execution',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
