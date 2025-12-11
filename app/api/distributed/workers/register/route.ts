/**
 * API Route: POST /api/distributed/workers/register
 * Register a new worker in the distributed system
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkerManager, WorkerRegistration } from '@/lib/training/worker-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.workerId || !body.hostname || !body.capabilities || !body.maxConcurrency) {
      return NextResponse.json(
        { error: 'Missing required fields: workerId, hostname, capabilities, maxConcurrency' },
        { status: 400 }
      );
    }

    // Create worker registration
    const worker: WorkerRegistration = {
      workerId: body.workerId,
      hostname: body.hostname,
      pid: body.pid || 0,
      capabilities: body.capabilities,
      maxConcurrency: body.maxConcurrency,
      currentLoad: body.currentLoad || 0,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'idle',
      metadata: body.metadata || {
        cpuCores: 0,
        memoryGB: 0,
        gpuCount: 0,
        version: process.env.DISTRIBUTED_WORKER_VERSION || '1.0.0',
        platform: 'unknown',
      },
    };

    // Register worker
    const workerManager = getWorkerManager();
    await workerManager.registerWorker(worker);

    return NextResponse.json({
      success: true,
      workerId: worker.workerId,
      registeredAt: worker.registeredAt,
    });
  } catch (error) {
    console.error('[API] Worker registration failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Worker registration failed' },
      { status: 500 }
    );
  }
}
