// Research Results API - Get final research report
import { NextRequest, NextResponse } from 'next/server';
import { researchService } from '@/lib/tools/web-search/research.service';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    console.log(`[API] Getting results for research job: ${jobId}`);
    const job = await researchService.getJob(jobId);

    if (!job) {
      console.warn(`[API] Research job not found: ${jobId}`);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.status !== 'completed') {
      return NextResponse.json(
        { error: 'Research not yet completed', status: job.status },
        { status: 400 }
      );
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      report: job.report || 'No report generated',
      completedAt: job.completedAt
    });
  } catch (error) {
    console.error('[API] Error getting research results:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
