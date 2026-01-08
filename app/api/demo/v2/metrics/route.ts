import { NextRequest, NextResponse } from 'next/server';
import { getDemoSessionMetrics } from '@/lib/demo/demo-analytics.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const session_id = searchParams.get('session_id');

    if (!session_id) {
      return NextResponse.json(
        { error: 'Missing session_id parameter' },
        { status: 400 }
      );
    }

    const metrics = await getDemoSessionMetrics(session_id);

    if (!metrics) {
      return NextResponse.json(
        { error: 'Failed to fetch metrics' },
        { status: 500 }
      );
    }

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('[API/demo/v2/metrics] Get error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
