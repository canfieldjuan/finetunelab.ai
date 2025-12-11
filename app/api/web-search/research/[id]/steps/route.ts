import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfiguration: service role not available' }, { status: 500 });
    }
    const resolvedParams = await params;
    const jobId = resolvedParams?.id;
    if (!jobId) {
      return NextResponse.json({ error: 'Missing job id' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('research_steps')
      .select('id, type, status, started_at, completed_at')
      .eq('job_id', jobId)
      .order('started_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, steps: data || [] });
  } catch (error) {
    console.error('[ResearchStepsAPI] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

