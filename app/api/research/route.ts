import { researchService } from '@/lib/tools/web-search/research.service';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
// DEPRECATED: import { recordUsageEvent } from '@/lib/usage/checker';

export async function POST(request: NextRequest) {
  try {
    const { query }: { query: string } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Extract userId from auth (optional - research can work without auth)
    let userId: string | undefined;
    try {
      const {
        data: { user },
        error: authError,
      }: { data: { user: any }; error: any } = await supabase.auth.getUser();
      if (user && !authError) {
        userId = user.id;
        console.log(`[API /research/route] Authenticated user: ${userId}`);
      } else {
        console.log('[API /research/route] No authenticated user, proceeding without rate limiting');
      }
    } catch (authErr) {
      console.warn('[API /research/route] Auth check failed, proceeding without userId:', authErr);
    }

    const job: any = await researchService.startResearch(query, userId);

    // Validate job was created successfully
    if (!job || !job.id) {
      console.error('[API /research/route] Failed to create research job');
      return NextResponse.json(
        { error: 'Failed to create research job' },
        { status: 500 }
      );
    }

    // DEPRECATED: OLD usage tracking system
    // Now using usage_meters table via increment_root_trace_count()
    // if (userId) {
    //   await recordUsageEvent({
    //     userId,
    //     metricType: 'research_job',
    //     value: 1,
    //     resourceType: 'research_job',
    //     resourceId: job.id,
    //     metadata: {
    //       queryLength: query.length,
    //     },
    //   });
    // }

    // Execute research asynchronously (v2 format with SSE streaming)
    // Note: executeStructuredResearch not yet implemented, using executeResearch
    researchService.executeResearch(job.id).catch((error: Error) => {
      console.error(`[API /research/route] Research failed for job ${job.id}:`, error);
    });

    return NextResponse.json({
      status: 'deep_research_started',
      message: `Deep research process started for "${query}".`,
      jobId: job.id,
      streamUrl: `/api/research/stream?jobId=${job.id}`, // SSE stream endpoint
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /research/route] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId: string | null = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  const job: any = await researchService.getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}