/**
 * API Route: GET /api/distributed/execute/[executionId]
 * Get execution status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStateStore } from '@/lib/training/state-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params;

    const stateStore = getStateStore();
    const executionState = await stateStore.getExecutionState(executionId);

    if (!executionState) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      execution: {
        executionId: executionState.executionId,
        workflowId: executionState.workflowId,
        status: executionState.status,
        startedAt: executionState.startedAt,
        completedAt: executionState.completedAt,
        progress: {
          total: executionState.completedJobs.length + executionState.failedJobs.length + executionState.currentJobs.length,
          completed: executionState.completedJobs.length,
          failed: executionState.failedJobs.length,
          running: executionState.currentJobs.length,
        },
        checkpointId: executionState.checkpointId,
      },
    });
  } catch (error) {
    console.error('[API] Failed to get execution status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get execution status' },
      { status: 500 }
    );
  }
}
