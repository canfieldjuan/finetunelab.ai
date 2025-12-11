/**
 * API Route: POST /api/distributed/queue/pause
 * Pause job processing
 */

import { NextResponse } from 'next/server';
import { getJobQueue } from '@/lib/training/job-queue';

export async function POST() {
  try {
    const jobQueue = getJobQueue();
    await jobQueue.pause();

    return NextResponse.json({
      success: true,
      message: 'Queue paused successfully',
    });
  } catch (error) {
    console.error('[API] Failed to pause queue:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to pause queue' },
      { status: 500 }
    );
  }
}
