/**
 * API Route: GET /api/distributed/health
 * Health check for all distributed components
 */

import { NextResponse } from 'next/server';
import { getJobQueue } from '@/lib/training/job-queue';
import { getWorkerManager } from '@/lib/training/worker-manager';
import { getStateStore } from '@/lib/training/state-store';

export async function GET() {
  try {
    const jobQueue = getJobQueue();
    const workerManager = getWorkerManager();
    const stateStore = getStateStore();

    const [queueHealthy, workerManagerHealthy, stateStoreHealthy, workerStats] = await Promise.all([
      jobQueue.isHealthy(),
      workerManager.isHealthy(),
      stateStore.isHealthy(),
      workerManager.getWorkerStats(),
    ]);

    const overallHealthy = queueHealthy && workerManagerHealthy && stateStoreHealthy;

    return NextResponse.json({
      success: true,
      healthy: overallHealthy,
      components: {
        queue: {
          healthy: queueHealthy,
          name: 'Job Queue',
        },
        workerManager: {
          healthy: workerManagerHealthy,
          name: 'Worker Manager',
        },
        stateStore: {
          healthy: stateStoreHealthy,
          name: 'State Store',
        },
      },
      workers: {
        total: workerStats.total,
        active: workerStats.active,
        idle: workerStats.idle,
        busy: workerStats.busy,
        unhealthy: workerStats.unhealthy,
        utilizationPercent: workerStats.utilizationPercent,
      },
    });
  } catch (error) {
    console.error('[API] Health check failed:', error);
    return NextResponse.json(
      {
        success: false,
        healthy: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 500 }
    );
  }
}
