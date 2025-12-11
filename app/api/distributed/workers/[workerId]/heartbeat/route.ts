/**
 * API Route: POST /api/distributed/workers/[workerId]/heartbeat
 * Send heartbeat for a worker
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkerManager } from '@/lib/training/worker-manager';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  try {
    const { workerId } = await params;
    const body = await request.json();
    const currentLoad = body.currentLoad;

    const workerManager = getWorkerManager();
    await workerManager.heartbeat(workerId, currentLoad);

    const worker = await workerManager.getWorker(workerId);

    return NextResponse.json({
      success: true,
      workerId,
      status: worker?.status,
      currentLoad: worker?.currentLoad,
      lastHeartbeat: worker?.lastHeartbeat,
    });
  } catch (error) {
    console.error('[API] Heartbeat failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Heartbeat failed' },
      { status: 500 }
    );
  }
}
