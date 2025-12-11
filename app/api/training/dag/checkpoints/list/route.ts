/**
 * DAG Checkpoints List Endpoint
 * 
 * GET /api/training/dag/checkpoints/list - List checkpoints with optional filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { CheckpointManager } from '@/lib/training/checkpoint-manager';

let checkpointManager: CheckpointManager | null = null;

function getCheckpointManager(): CheckpointManager {
  if (!checkpointManager) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    checkpointManager = new CheckpointManager(supabaseUrl, supabaseKey, {
      enabled: true,
    });
  }

  return checkpointManager;
}

/**
 * GET /api/training/dag/checkpoints/list
 * List checkpoints with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const executionId = searchParams.get('executionId');
    const trigger = searchParams.get('trigger');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const manager = getCheckpointManager();

    const checkpoints = await manager.listCheckpoints({
      executionId: executionId || undefined,
      trigger: trigger as 'manual' | 'time-based' | 'job-completed' | 'level-completed' | 'before-critical' | undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });

    return NextResponse.json({
      success: true,
      count: checkpoints.length,
      checkpoints: checkpoints.map(cp => ({
        id: cp.id,
        executionId: cp.execution_id,
        name: cp.name,
        trigger: cp.trigger,
        createdAt: cp.created_at,
        jobCount: cp.state.jobs.length,
        status: cp.state.status,
        metadata: cp.metadata,
      })),
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CHECKPOINTS] List error:', errorMessage);
    
    return NextResponse.json(
      {
        error: 'Failed to list checkpoints',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
