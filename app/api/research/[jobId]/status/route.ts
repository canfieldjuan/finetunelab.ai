// Research Progress API - Get job status
import { NextRequest, NextResponse } from 'next/server';
import { researchService } from '@/lib/tools/web-search/research.service';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    console.log(`[API] Getting status for research job: ${jobId}`);
    const job = await researchService.getJob(jobId);

    if (!job) {
      console.warn(`[API] Research job not found: ${jobId}`);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const completedSteps = job.steps.filter((s: any) => s.status === 'completed').length;
    const currentStep = job.steps[job.steps.length - 1];

    // Map step types to user-friendly names
    const stepNames: Record<string, string> = {
      initial_search: 'Searching the web...',
      sub_query_generation: 'Analyzing results and generating follow-up questions...',
      sub_query_search: 'Performing deeper research...',
      report_generation: 'Generating final report...'
    };

    return NextResponse.json({
      status: job.status,
      currentStep: currentStep ? stepNames[currentStep.type] || currentStep.type : 'Starting...',
      completedSteps,
      totalSteps: 4,
      error: currentStep?.status === 'failed' ? currentStep.error : undefined
    });
  } catch (error) {
    console.error('[API] Error getting research status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
