import { NextRequest, NextResponse } from 'next/server';
import { researchService } from '@/lib/tools/web-search/research.service';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams?.id;
    if (!jobId) {
      return NextResponse.json({ error: 'Missing job id' }, { status: 400 });
    }

    // Prefer DB state if available; fallback to in-memory service
    if (supabaseAdmin) {
      const [jobRes, stepsRes] = await Promise.all([
        supabaseAdmin.from('research_jobs').select('*').eq('id', jobId).maybeSingle(),
        supabaseAdmin.from('research_steps').select('id, job_id, type, status, started_at, completed_at').eq('job_id', jobId).order('started_at', { ascending: true }),
      ]);
      const jobRow = jobRes?.data as any;
      if (jobRes?.error) {
        console.warn('[ResearchStatusAPI] DB job fetch error:', jobRes.error.message);
      }
      if (jobRow) {
        const steps = (stepsRes?.data as any[] | null) || [];
        const response = {
          success: true,
          id: jobRow.id,
          query: jobRow.query,
          status: jobRow.status,
          steps: steps.map(s => ({ id: s.id, type: s.type, status: s.status, startedAt: s.started_at, completedAt: s.completed_at })),
          collectedCount: 0,
          report: jobRow.report_body ? { title: jobRow.report_title, summary: jobRow.report_summary, body: jobRow.report_body } : null,
          updatedAt: jobRow.updated_at,
        };
        return NextResponse.json(response, { status: 200 });
      }
    }

    // Fallback to in-memory if DB not available or no row yet
    const job = await researchService.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    const response = {
      success: true,
      id: job.id,
      query: job.query,
      status: job.status,
      steps: job.steps?.map((s: any) => ({ id: s.id, type: s.type, status: s.status, startedAt: s.startedAt, completedAt: s.completedAt })) || [],
      collectedCount: job.collectedContent?.length || 0,
      report: job.report || null,
      updatedAt: job.updatedAt,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[ResearchStatusAPI] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
