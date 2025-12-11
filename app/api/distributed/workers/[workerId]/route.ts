/**
 * API Route: DELETE /api/distributed/workers/[workerId]
 * Deregister a worker
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkerManager } from '@/lib/training/worker-manager';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  try {
    const { workerId } = await params;

    const workerManager = getWorkerManager();
    await workerManager.deregisterWorker(workerId);

    return NextResponse.json({
      success: true,
      workerId,
      message: 'Worker deregistered successfully',
    });
  } catch (error) {
    console.error('[API] Worker deregistration failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Worker deregistration failed' },
      { status: 500 }
    );
  }
}
