/**
 * API Route: POST /api/distributed/queue/resume
 * Resume job processing
 */

import { NextResponse } from 'next/server';
import { getJobQueue } from '@/lib/training/job-queue';

export async function POST() {
  try {
    const jobQueue = getJobQueue();
    await jobQueue.resume();

    return NextResponse.json({
      success: true,
      message: 'Queue resumed successfully',
    });
  } catch (error) {
    console.error('[API] Failed to resume queue:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resume queue' },
      { status: 500 }
    );
  }
}
