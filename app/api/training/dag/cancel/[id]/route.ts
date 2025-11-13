/**
 * DAG Execution Cancel Endpoint
 * 
 * POST /api/training/dag/cancel/[id] - Cancel a running execution
 */

import { NextRequest, NextResponse } from 'next/server';
import DAGOrchestrator from '@/lib/training/dag-orchestrator';
import { defaultHandlers } from '@/lib/training/job-handlers';

const orchestrators = new Map<string, DAGOrchestrator>();

function getOrchestrator(): DAGOrchestrator {
  const key = 'default';
  
  if (!orchestrators.has(key)) {
    const orchestrator = new DAGOrchestrator(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Register all handlers
    Object.entries(defaultHandlers).forEach(([type, handler]) => {
      orchestrator.registerHandler(type as any, handler);
    });

    orchestrators.set(key, orchestrator);
  }

  return orchestrators.get(key)!;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: executionId } = await params;

    if (!executionId) {
      return NextResponse.json(
        { error: 'Missing execution ID' },
        { status: 400 }
      );
    }

    const orchestrator = getOrchestrator();
    const execution = orchestrator.getExecution(executionId);

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    if (execution.status === 'completed' || execution.status === 'failed') {
      return NextResponse.json(
        { error: `Cannot cancel execution with status: ${execution.status}` },
        { status: 400 }
      );
    }

    console.log(`[DAG] Cancelling execution: ${executionId}`);
    await orchestrator.cancel(executionId);

    return NextResponse.json({
      success: true,
      message: 'Execution cancelled',
      executionId,
    });

  } catch (error: any) {
    console.error('[DAG] Cancel error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to cancel execution',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
