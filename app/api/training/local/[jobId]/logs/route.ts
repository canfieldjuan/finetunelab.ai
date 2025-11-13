/**
 * Local Training Job Logs API
 * GET /api/training/local/[jobId]/logs
 *
 * Purpose: Get training logs with pagination support
 * Proxies to Python training server (localhost:8000)
 *
 * Query Parameters:
 * - limit: Max number of lines to return (default: 100)
 * - offset: Line offset to start from (default: 0)
 *
 * Phase 2: API Endpoint Enhancements
 * Date: 2025-10-27
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

  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get('limit') || '100';
  const offset = searchParams.get('offset') || '0';

  console.log('[LocalTraining Logs] GET logs for job:', jobId, { limit, offset });

  try {
    const url = `${TRAINING_SERVER_URL}/api/training/logs/${jobId}?limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[LocalTraining Logs] Error from training server:', errorData);

      return NextResponse.json(
        { error: errorData.error || `Training server error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[LocalTraining Logs] Retrieved', data.logs?.length || 0, 'log lines');

    return NextResponse.json(data);

  } catch (error) {
    console.error('[LocalTraining Logs] Failed to connect to training server:', error);
    return NextResponse.json(
      {
        error: 'Failed to connect to local training server',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}
