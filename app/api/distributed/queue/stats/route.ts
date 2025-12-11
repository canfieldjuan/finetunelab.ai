/**
 * API Route: GET /api/distributed/queue/stats
 * Get queue statistics
 */

import { NextResponse } from 'next/server';
import { getJobQueue } from '@/lib/training/job-queue';

export async function GET() {
  try {
    const jobQueue = getJobQueue();
    const stats = await jobQueue.getQueueStats();
    const health = await jobQueue.isHealthy();

    return NextResponse.json({
      success: true,
      healthy: health,
      stats: {
        waiting: stats.waiting,
        active: stats.active,
        completed: stats.completed,
        failed: stats.failed,
        delayed: stats.delayed,
        paused: stats.paused,
        total: stats.waiting + stats.active + stats.completed + stats.failed,
      },
    });
  } catch (error) {
    console.error('[API] Failed to get queue stats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get queue stats' },
      { status: 500 }
    );
  }
}
