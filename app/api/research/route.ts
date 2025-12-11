import { researchService } from '@/lib/tools/web-search/research.service';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Extract userId from auth (optional - research can work without auth)
    let userId: string | undefined;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (user && !authError) {
        userId = user.id;
        console.log(`[API /research/route] Authenticated user: ${userId}`);
      } else {
        console.log('[API /research/route] No authenticated user, proceeding without rate limiting');
      }
    } catch (authErr) {
      console.warn('[API /research/route] Auth check failed, proceeding without userId:', authErr);
    }

    const job = await researchService.startResearch(query, userId);

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  const job = await researchService.getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}