/**
 * DAG Checkpoint Endpoint
 * 
 * POST /api/training/dag/checkpoint - Create a checkpoint for an execution
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
      triggers: ['manual', 'job-completed'],
    });

    Object.entries(defaultHandlers).forEach(([type, handler]) => {
      orchestrator.registerHandler(type as JobType, handler);
    });

    orchestrators.set(key, orchestrator);
  }

  return orchestrators.get(key)!;
}

/**
 * POST /api/training/dag/checkpoint
 * Create a checkpoint for an execution
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId, name, metadata } = body;

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

    console.log(`[CHECKPOINT] Creating checkpoint for execution: ${executionId}`);

    const checkpointId = await orchestrator.createCheckpoint(
      executionId,
      name,
      metadata
    );

    return NextResponse.json({
      success: true,
      checkpointId,
      executionId,
      message: 'Checkpoint created successfully',
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CHECKPOINT] Create error:', errorMessage);
    
    return NextResponse.json(
      {
        error: 'Failed to create checkpoint',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/training/dag/checkpoint
 * Get help message (use /pause or /resume instead)
 */
export async function GET() {
  return NextResponse.json({
    message: 'Use POST to create a checkpoint',
    endpoints: {
      'POST /checkpoint': 'Create a checkpoint',
      'POST /pause': 'Pause execution and create checkpoint',
      'POST /resume': 'Resume paused execution',
      'GET /checkpoints/list': 'List checkpoints',
    },
  });
}
