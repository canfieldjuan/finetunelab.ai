/**
 * DAG Validation Endpoint
 * 
 * POST /api/training/dag/validate - Validate a DAG configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { DAGValidator, JobConfig } from '@/lib/training/dag-orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobs } = body;

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid jobs array' },
        { status: 400 }
      );
    }

    console.log(`[DAG-VALIDATE] Validating ${jobs.length} jobs`);

    const validation = DAGValidator.validate(jobs as JobConfig[]);

    if (!validation.valid) {
      console.log(`[DAG-VALIDATE] Validation failed: ${validation.errors.join(', ')}`);
      return NextResponse.json({
        valid: false,
        errors: validation.errors,
      }, { status: 400 });
    }

    const executionLevels = DAGValidator.getExecutionLevels(jobs as JobConfig[]);
    const topologicalOrder = DAGValidator.topologicalSort(jobs as JobConfig[]);

    console.log(`[DAG-VALIDATE] Validation passed - ${executionLevels.length} execution levels`);

    return NextResponse.json({
      valid: true,
      executionLevels: executionLevels.map(level => 
        level.map(job => ({
          id: job.id,
          name: job.name,
          type: job.type,
        }))
      ),
      topologicalOrder: topologicalOrder.map(job => ({
        id: job.id,
        name: job.name,
        type: job.type,
      })),
      totalJobs: jobs.length,
      maxParallelJobs: Math.max(...executionLevels.map(level => level.length)),
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DAG-VALIDATE] Validation error:', errorMessage);
    
    return NextResponse.json(
      {
        valid: false,
        error: 'Validation failed',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
