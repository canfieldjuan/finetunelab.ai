/**
 * Checkpoint Listing API
 *
 * GET /api/training/checkpoints/list?jobId=xxx
 * Returns list of available checkpoints for a training job
 *
 * Phase: Checkpoint Selection Feature
 * Date: 2025-10-31
 */

import { NextRequest, NextResponse } from 'next/server';
import type { CheckpointListResponse } from '@/lib/training/checkpoint.types';

export async function GET(req: NextRequest) {
  console.log('[CheckpointListAPI] Request received');

  try {
    // Get jobId from query parameters
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: jobId'
        } as CheckpointListResponse,
        { status: 400 }
      );
    }

    console.log('[CheckpointListAPI] Fetching checkpoints for job:', jobId);

    // Forward request to local training server
    const trainingServerUrl = process.env.TRAINING_SERVER_URL || 'http://localhost:8000';
    const response = await fetch(`${trainingServerUrl}/api/training/checkpoints/${jobId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CheckpointListAPI] Training server error:', response.status, errorText);

      // Handle 404 specifically
      if (response.status === 404) {
        return NextResponse.json(
          {
            success: false,
            job_id: jobId,
            checkpoints: [],
            error: `Job ${jobId} not found`
          } as CheckpointListResponse,
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          job_id: jobId,
          checkpoints: [],
          error: `Training server error: ${response.statusText}`
        } as CheckpointListResponse,
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[CheckpointListAPI] Received', data.checkpoints?.length || 0, 'checkpoints');

    // Transform response to match our type
    const result: CheckpointListResponse = {
      success: true,
      job_id: data.job_id || jobId,
      checkpoints: data.checkpoints || [],
      best_checkpoint: data.best_checkpoint,
      message: data.message
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('[CheckpointListAPI] Error:', error);

    return NextResponse.json(
      {
        success: false,
        job_id: '',
        checkpoints: [],
        error: error instanceof Error ? error.message : 'Internal server error'
      } as CheckpointListResponse,
      { status: 500 }
    );
  }
}
