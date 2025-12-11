import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfiguration: service role not available' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100));
    const status = searchParams.get('status');
    const q = searchParams.get('q');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    let query = supabaseAdmin
      .from('research_jobs')
      .select('id, query, status, report_title, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);
    if (q && q.trim()) query = query.ilike('query', `%${q.trim()}%`);
    if (start) query = query.gte('created_at', start);
    if (end) query = query.lte('created_at', end);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, jobs: data || [] });
  } catch (error) {
    console.error('[ResearchListAPI] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
