/**
 * API Route: GET /api/distributed/workers
 * List all registered workers
 */

import { NextResponse } from 'next/server';
import { getWorkerManager } from '@/lib/training/worker-manager';

export async function GET() {
  try {
    const workerManager = getWorkerManager();
    const workers = await workerManager.getAllWorkers();

    return NextResponse.json({
      success: true,
      count: workers.length,
      workers: workers.map(w => ({
        workerId: w.workerId,
        hostname: w.hostname,
        capabilities: w.capabilities,
        status: w.status,
        currentLoad: w.currentLoad,
        maxConcurrency: w.maxConcurrency,
        utilization: w.maxConcurrency > 0 ? (w.currentLoad / w.maxConcurrency) * 100 : 0,
        lastHeartbeat: w.lastHeartbeat,
        uptime: Date.now() - w.registeredAt,
      })),
    });
  } catch (error) {
    console.error('[API] Failed to list workers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list workers' },
      { status: 500 }
    );
  }
}
