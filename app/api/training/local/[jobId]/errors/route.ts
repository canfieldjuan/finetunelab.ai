/**
 * Training Errors API
 * GET /api/training/local/[jobId]/errors
 *
 * Purpose: Get structured error information from training log files
 * - Deduplicated error messages with counts
 * - Full traceback with parsed frames
 * - Error classification and phase information
 *
 * Date: 2025-12-12
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const TRAINING_SERVER_URL = process.env.TRAINING_SERVER_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[LocalTraining Errors] GET errors for job:', jobId);

  try {
    const url = `${TRAINING_SERVER_URL}/api/training/${jobId}/errors`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[LocalTraining Errors] Error from training server:', errorData);

      return NextResponse.json(
        { error: errorData.error || `Training server error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[LocalTraining Errors] Retrieved', data.unique_error_count || 0, 'unique errors');

    return NextResponse.json(data);

  } catch (error) {
    console.error('[LocalTraining Errors] Failed to connect to training server:', error);
    return NextResponse.json(
      {
        error: 'Failed to connect to local training server',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}
