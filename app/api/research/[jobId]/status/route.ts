// Research Progress API - Get job status
import { NextRequest, NextResponse } from 'next/server';
import { researchService } from '@/lib/tools/web-search/research.service';
import type { ResearchJob } from '@/lib/tools/web-search/types';
import { RESEARCH_STEP_STATUS, RESEARCH_STEP_NAMES } from '@/lib/constants';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    console.log(`[API] Getting status for research job: ${jobId}`);
    const job = (await researchService.getJob(jobId)) as ResearchJob | null;

    if (!job) {
      console.warn(`[API] Research job not found: ${jobId}`);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const completedSteps = job.steps.filter((s) => s.status === RESEARCH_STEP_STATUS.COMPLETED).length;
    const currentStep = job.steps[job.steps.length - 1];

    // Map step types to user-friendly names
    const stepNames: Record<string, string> = {
      [RESEARCH_STEP_NAMES.INITIAL_SEARCH]: 'Searching the web...',
      [RESEARCH_STEP_NAMES.SUB_QUERY_GENERATION]: 'Analyzing results and generating follow-up questions...',
      [RESEARCH_STEP_NAMES.SUB_QUERY_SEARCH]: 'Performing deeper research...',
      [RESEARCH_STEP_NAMES.REPORT_GENERATION]: 'Generating final report...'
    };

    return NextResponse.json({
      status: job.status,
      currentStep: currentStep ? stepNames[currentStep.type] || currentStep.type : 'Starting...',
      completedSteps,
      totalSteps: 4,
      error: currentStep?.status === RESEARCH_STEP_STATUS.FAILED ? currentStep.error : undefined
    });
  } catch (error) {
    console.error('[API] Error getting research status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
