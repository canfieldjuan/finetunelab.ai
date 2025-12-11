/**
 * API Route: POST /api/distributed/execute
 * Start distributed execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDistributedOrchestrator } from '@/lib/training/distributed-orchestrator';
import { JobConfig } from '@/lib/training/dag-orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.workflowId || !body.jobs) {
      return NextResponse.json(
        { error: 'Missing required fields: workflowId, jobs' },
        { status: 400 }
      );
    }

    // Initialize orchestrator if not already done
    const orchestrator = getDistributedOrchestrator({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
      orchestratorId: `api-orchestrator-${Date.now()}`,
    });

    try {
      await orchestrator.initialize();
    } catch {
      // Already initialized, continue
    }

    // Execute DAG
    const jobs: JobConfig[] = body.jobs;
    const result = await orchestrator.execute(body.workflowId, jobs, {
      parallelism: body.parallelism || 10,
    });

    return NextResponse.json({
      success: true,
      executionId: result.id,
      status: result.status,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      jobCount: result.jobs.size,
    });
  } catch (error) {
    console.error('[API] Distributed execution failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Distributed execution failed' },
      { status: 500 }
    );
  }
}
